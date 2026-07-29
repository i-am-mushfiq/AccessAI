import type { VerificationStatus } from '@/lib/domain/enums';
import type { EvaluationResult } from '@/modules/eligibility/engine';
import type { RetrievedChunk } from '@/modules/knowledge/retrieval';

/**
 * Confidence scoring — PRD §32.
 *
 * Factors, exactly as specified: retrieval quality, rule completeness, number
 * of supporting sources, data freshness, metadata quality.
 *
 * The scorer is deliberately PESSIMISTIC about unverified data. The seeded
 * corpus is authored sample data, so an honest system must not report 96%
 * confidence about it — a high number next to unverified content is precisely
 * the false assurance PRD §33 exists to prevent. `unverified_sample` therefore
 * applies a hard ceiling that no other factor can lift.
 */

export interface ConfidenceInput {
  readonly retrieved: readonly RetrievedChunk[];
  /**
   * Set when confidence is scored for a DIRECT check against one named
   * programme (the detail page, the what-if panel) rather than for a
   * retrieval-backed answer.
   *
   * Without this, an empty `retrieved` list is indistinguishable from "we
   * searched and found nothing", so a direct check would report "no supporting
   * document was found" about a programme whose own record it just read. That is
   * a false statement in the one place a citizen is most likely to read it.
   */
  readonly directRecord?: { readonly indexedDocuments: number };
  readonly evaluation?: EvaluationResult | null;
  readonly verificationStatus: VerificationStatus;
  readonly lastVerifiedAt: Date | null;
  readonly hasSourceUrl: boolean;
  readonly hasRequiredDocuments: boolean;
  readonly hasApplicationSteps: boolean;
  readonly now?: Date;
}

export interface ConfidenceBreakdown {
  readonly score: number;
  readonly band: 'high' | 'medium' | 'low';
  readonly factors: {
    readonly retrievalQuality: number;
    readonly ruleCompleteness: number;
    readonly supportingSources: number;
    readonly dataFreshness: number;
    readonly metadataQuality: number;
  };
  /** Plain-language reasons, shown verbatim in the Trust panel. */
  readonly reasons: readonly { readonly en: string; readonly bn: string }[];
  readonly ceilingApplied: boolean;
}

const WEIGHTS = {
  retrievalQuality: 0.25,
  ruleCompleteness: 0.3,
  supportingSources: 0.15,
  dataFreshness: 0.15,
  metadataQuality: 0.15,
} as const;

/** Ceilings by trust state. `unverified_sample` cannot exceed 65. */
const VERIFICATION_CEILING: Record<VerificationStatus, number> = {
  verified: 100,
  pending_review: 75,
  unverified_sample: 65,
  outdated: 45,
  disputed: 25,
};

const MS_PER_DAY = 86_400_000;

export function scoreConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const now = input.now ?? new Date();
  const reasons: { en: string; bn: string }[] = [];

  /* ---- retrieval quality ---- */
  const topScore = input.retrieved[0]?.score ?? 0;
  const hasSemantic = input.retrieved.some((c) => c.semanticScore > 0);
  let retrievalQuality: number;

  if (input.retrieved.length > 0) {
    retrievalQuality = Math.min(100, 40 + topScore * 1600);
    if (!hasSemantic) {
      // Lexical-only retrieval is weaker at paraphrase, so cap it honestly.
      retrievalQuality = Math.min(retrievalQuality, 78);
    }
  } else if (input.directRecord) {
    // A direct check reads the programme's own record, so there is no retrieval
    // step to be uncertain about — but it is also not stronger evidence than a
    // well-matched passage, so it does not score 100.
    retrievalQuality = input.directRecord.indexedDocuments > 0 ? 85 : 65;
    reasons.push({
      en: 'This answer comes from the programme’s own record, not from a search result.',
      bn: 'এই উত্তর কর্মসূচির নিজের তথ্য থেকে এসেছে, কোনো অনুসন্ধানের ফল থেকে নয়।',
    });
  } else {
    retrievalQuality = 0;
    reasons.push({
      en: 'No supporting document was found for this answer.',
      bn: 'এই উত্তরের সমর্থনে কোনো নথি পাওয়া যায়নি।',
    });
  }

  /* ---- rule completeness ---- */
  let ruleCompleteness = 30;
  if (input.evaluation) {
    ruleCompleteness = input.evaluation.ruleCoverage;
    if (input.evaluation.missingFields.length > 0) {
      ruleCompleteness = Math.min(ruleCompleteness, 55);
      reasons.push({
        en: `${input.evaluation.missingFields.length} piece(s) of information are still missing, so this decision is provisional.`,
        bn: `${input.evaluation.missingFields.length}টি তথ্য এখনো জানা নেই, তাই এই সিদ্ধান্ত সাময়িক।`,
      });
    } else if (input.evaluation.outcome === 'eligible') {
      reasons.push({
        en: 'Every condition was checked against the information you provided.',
        bn: 'আপনার দেওয়া তথ্যের সঙ্গে প্রতিটি শর্ত মিলিয়ে দেখা হয়েছে।',
      });
    }
  }

  /* ---- supporting sources ---- */
  const distinctDocuments =
    input.retrieved.length > 0
      ? new Set(input.retrieved.map((c) => c.documentId)).size
      : (input.directRecord?.indexedDocuments ?? 0);
  const supportingSources = Math.min(100, distinctDocuments * 30 + (input.hasSourceUrl ? 25 : 0));
  if (distinctDocuments > 0) {
    reasons.push({
      en: `${distinctDocuments} source document${distinctDocuments === 1 ? '' : 's'} used.`,
      bn: `${distinctDocuments}টি নথি ব্যবহার করা হয়েছে।`,
    });
  }
  if (!input.hasSourceUrl) {
    reasons.push({
      en: 'No official web address is recorded for this programme yet.',
      bn: 'এই কর্মসূচির জন্য এখনো কোনো সরকারি ওয়েব ঠিকানা সংরক্ষিত নেই।',
    });
  }

  /* ---- data freshness ---- */
  let dataFreshness: number;
  if (!input.lastVerifiedAt) {
    dataFreshness = 25;
    reasons.push({
      en: 'This record has never been verified by a reviewer.',
      bn: 'এই তথ্য কোনো পর্যালোচক এখনো যাচাই করেননি।',
    });
  } else {
    const ageDays = (now.getTime() - input.lastVerifiedAt.getTime()) / MS_PER_DAY;
    dataFreshness = ageDays <= 30 ? 100 : ageDays <= 90 ? 85 : ageDays <= 180 ? 65 : ageDays <= 365 ? 40 : 20;
    if (ageDays > 180) {
      reasons.push({
        en: `Last verified ${Math.round(ageDays)} days ago — rules may have changed since.`,
        bn: `সর্বশেষ যাচাই ${Math.round(ageDays)} দিন আগে — এরপর নিয়ম বদলে থাকতে পারে।`,
      });
    }
  }

  /* ---- metadata quality ---- */
  const metadataQuality =
    (input.hasRequiredDocuments ? 40 : 0) +
    (input.hasApplicationSteps ? 40 : 0) +
    (input.hasSourceUrl ? 20 : 0);

  const factors = {
    retrievalQuality: Math.round(retrievalQuality),
    ruleCompleteness: Math.round(ruleCompleteness),
    supportingSources: Math.round(supportingSources),
    dataFreshness: Math.round(dataFreshness),
    metadataQuality: Math.round(metadataQuality),
  };

  const raw =
    factors.retrievalQuality * WEIGHTS.retrievalQuality +
    factors.ruleCompleteness * WEIGHTS.ruleCompleteness +
    factors.supportingSources * WEIGHTS.supportingSources +
    factors.dataFreshness * WEIGHTS.dataFreshness +
    factors.metadataQuality * WEIGHTS.metadataQuality;

  const ceiling = VERIFICATION_CEILING[input.verificationStatus];
  const score = Math.round(Math.min(raw, ceiling));
  const ceilingApplied = raw > ceiling;

  if (ceilingApplied && input.verificationStatus === 'unverified_sample') {
    reasons.unshift({
      en: 'Confidence is capped because this is unverified sample data, not a confirmed official rule.',
      bn: 'এটি যাচাই না করা নমুনা তথ্য, নিশ্চিত সরকারি নিয়ম নয় — তাই আস্থার মাত্রা সীমিত রাখা হয়েছে।',
    });
  }

  return {
    score,
    band: score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low',
    factors,
    reasons,
    ceilingApplied,
  };
}

export function bandLabel(band: 'high' | 'medium' | 'low', locale: 'bn' | 'en'): string {
  if (locale === 'bn') {
    return band === 'high' ? 'উচ্চ আস্থা' : band === 'medium' ? 'মধ্যম আস্থা' : 'কম আস্থা';
  }
  return band === 'high' ? 'High confidence' : band === 'medium' ? 'Medium confidence' : 'Low confidence';
}
