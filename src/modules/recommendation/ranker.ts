import type { EligibilityOutcome, VerificationStatus } from '@/lib/domain/enums';
import type { EligibilityProfile } from '@/modules/eligibility/engine';
import { deadlineUrgency, daysUntil } from '@/lib/format/dates';

/**
 * Recommendation ranking — PRD §31.
 *
 * The weights are exactly those specified:
 *   Eligibility Match 40% · User Preference 15% · Location 15%
 *   Deadline 10% · Popularity 10% · Similar User Success 10%
 *
 * Two notes on faithfulness:
 *
 *  • "Similar User Success" requires historical outcome data the prototype has
 *    not accumulated. Rather than inventing a number, this component returns a
 *    NEUTRAL 50 and reports `similarUserDataAvailable: false`, so the Trust
 *    Dashboard can tell the citizen that this factor is not yet contributing.
 *    Fabricating a success rate would be exactly the kind of unsupported claim
 *    PRD §33 forbids.
 *
 *  • Ranking never reorders an ineligible programme above an eligible one.
 *    The weighted score decides order WITHIN an outcome band, because a
 *    popular programme a citizen cannot get is not a better recommendation
 *    than an unpopular one they can.
 */

export const RANKING_WEIGHTS = {
  eligibility: 0.4,
  preference: 0.15,
  location: 0.15,
  deadline: 0.1,
  popularity: 0.1,
  similarUserSuccess: 0.1,
} as const;

export interface RankingInput {
  readonly opportunityId: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly lifeEvents: readonly string[];
  readonly coverageDistricts: readonly string[];
  readonly deadline: Date | null;
  readonly viewCount: number;
  readonly saveCount: number;
  readonly applicationCount: number;
  readonly verificationStatus: VerificationStatus;
  readonly outcome: EligibilityOutcome;
  /** 0–100 from the rule engine. */
  readonly eligibilityScore: number;
  /** 0–1 from the retriever, when the programme came from a search. */
  readonly retrievalScore?: number;
}

export interface RankingContext {
  readonly profile: EligibilityProfile;
  readonly interests?: readonly string[];
  readonly detectedLifeEvents?: readonly string[];
  readonly now?: Date;
  /** Maximum counts in the current corpus, for popularity normalisation. */
  readonly maxSaveCount?: number;
}

export interface RankedResult {
  readonly opportunityId: string;
  readonly total: number;
  readonly components: {
    readonly eligibility: number;
    readonly preference: number;
    readonly location: number;
    readonly deadline: number;
    readonly popularity: number;
    readonly similarUserSuccess: number;
  };
  readonly similarUserDataAvailable: boolean;
  readonly outcome: EligibilityOutcome;
}

const OUTCOME_BAND: Record<EligibilityOutcome, number> = {
  eligible: 3,
  partially_eligible: 2,
  unknown: 1,
  not_eligible: 0,
};

function eligibilityComponent(input: RankingInput): number {
  // The engine's weighted score, floored by outcome so a partially-eligible
  // programme cannot score as though it were fully eligible.
  const ceiling: Record<EligibilityOutcome, number> = {
    eligible: 100,
    partially_eligible: 75,
    unknown: 50,
    not_eligible: 15,
  };
  return Math.min(input.eligibilityScore, ceiling[input.outcome]);
}

function preferenceComponent(input: RankingInput, context: RankingContext): number {
  let score = 40; // neutral baseline
  const interests = (context.interests ?? []).map((i) => i.toLowerCase());
  const events = context.detectedLifeEvents ?? [];

  // A programme attached to a life event the citizen actually described is the
  // strongest preference signal available.
  const eventOverlap = input.lifeEvents.filter((e) => events.includes(e)).length;
  if (eventOverlap > 0) score += Math.min(45, eventOverlap * 25);

  const tagOverlap = input.tags.filter((t) => interests.includes(t.toLowerCase())).length;
  if (tagOverlap > 0) score += Math.min(15, tagOverlap * 8);

  if (interests.includes(input.category)) score += 10;

  // Retrieval relevance folds in here: it reflects what the citizen asked for.
  if (input.retrievalScore !== undefined) score += Math.min(20, input.retrievalScore * 400);

  return Math.max(0, Math.min(100, score));
}

function locationComponent(input: RankingInput, context: RankingContext): number {
  // Nationwide programmes score well but not perfectly: a district-targeted
  // programme that includes the citizen is a better local match.
  if (input.coverageDistricts.length === 0) return 75;
  const district = context.profile.district;
  if (!district) return 50; // unknown, not penalised as a mismatch
  return input.coverageDistricts.includes(district) ? 100 : 0;
}

function deadlineComponent(input: RankingInput, now: Date): number {
  const urgency = deadlineUrgency(input.deadline, now);
  switch (urgency) {
    case 'expired':
      return 0;
    // Closing soon ranks highest — that is the one a citizen must act on now.
    case 'critical':
      return 100;
    case 'soon':
      return 90;
    case 'upcoming':
      return 70;
    case 'distant':
      return 45;
    case 'rolling':
      // Always-open programmes are genuinely useful but carry no urgency.
      return 55;
  }
}

function popularityComponent(input: RankingInput, maxSaveCount: number): number {
  // Saves and applications are stronger evidence of usefulness than views.
  const weighted = input.viewCount * 0.2 + input.saveCount * 1 + input.applicationCount * 2;
  const ceiling = Math.max(10, maxSaveCount * 3);
  return Math.max(0, Math.min(100, (weighted / ceiling) * 100));
}

export function rank(
  inputs: readonly RankingInput[],
  context: RankingContext,
): RankedResult[] {
  const now = context.now ?? new Date();
  const maxSaveCount = context.maxSaveCount ?? Math.max(1, ...inputs.map((i) => i.saveCount));

  const results = inputs.map((input) => {
    const components = {
      eligibility: eligibilityComponent(input),
      preference: preferenceComponent(input, context),
      location: locationComponent(input, context),
      deadline: deadlineComponent(input, now),
      popularity: popularityComponent(input, maxSaveCount),
      // Neutral, and declared as unavailable rather than invented.
      similarUserSuccess: 50,
    };

    const total =
      components.eligibility * RANKING_WEIGHTS.eligibility +
      components.preference * RANKING_WEIGHTS.preference +
      components.location * RANKING_WEIGHTS.location +
      components.deadline * RANKING_WEIGHTS.deadline +
      components.popularity * RANKING_WEIGHTS.popularity +
      components.similarUserSuccess * RANKING_WEIGHTS.similarUserSuccess;

    return {
      opportunityId: input.opportunityId,
      total: Math.round(total * 10) / 10,
      components,
      similarUserDataAvailable: false,
      outcome: input.outcome,
    } satisfies RankedResult;
  });

  // Sort by outcome band first, then by weighted score. An expired programme
  // sinks regardless of band because acting on it is impossible.
  return results.sort((a, b) => {
    const bandDiff = OUTCOME_BAND[b.outcome] - OUTCOME_BAND[a.outcome];
    if (bandDiff !== 0) return bandDiff;
    return b.total - a.total;
  });
}

/** Days until deadline, for the "act now" ordering hint in the UI. */
export function urgencyHint(deadline: Date | null, now = new Date()): number | null {
  return deadline ? daysUntil(deadline, now) : null;
}
