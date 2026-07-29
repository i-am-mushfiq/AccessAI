import type { EligibilityOutcome, Intent, LifeEvent } from '@/lib/domain/enums';
import type { RuleField, LocalisedText } from '@/lib/domain/rules';

/**
 * The structured plan for one assistant turn.
 *
 * This is the key architectural decision in the AI layer: the pipeline decides
 * WHAT to say — which programmes, which outcome, which reasons, which next step
 * — entirely deterministically, and only then chooses how to render it.
 *
 * A live model renders the plan into fluent prose. The deterministic composer
 * renders the same plan into template prose. Both say the same facts, because
 * the facts were fixed before either was involved. That is what makes
 * "Simulated AI" an honest degradation rather than a different product, and it
 * is also what stops a live model from inventing a programme: everything it is
 * allowed to mention is already enumerated here.
 */

export interface PlannedOpportunity {
  readonly id: string;
  readonly slug: string;
  readonly title: LocalisedText;
  readonly summary: LocalisedText;
  readonly organisation: LocalisedText;
  readonly category: string;
  readonly outcome: EligibilityOutcome;
  readonly benefitAmount: number | null;
  readonly benefitPeriod: string | null;
  readonly deadline: Date | null;
  readonly relevance: number;
  readonly confidence: number;
  readonly isUnverified: boolean;
  /** Reasons taken verbatim from the rule engine — never model-authored. */
  readonly metReasons: readonly LocalisedText[];
  readonly failedReasons: readonly LocalisedText[];
  readonly unknownReasons: readonly LocalisedText[];
  readonly nextStep: LocalisedText | null;
  readonly sourceUrl: string | null;
}

export type PlanKind =
  | 'recommendations'
  | 'clarification'
  | 'no_results'
  | 'answer'
  | 'greeting'
  | 'out_of_scope';

export interface ResponsePlan {
  readonly kind: PlanKind;
  readonly locale: 'bn' | 'en';
  readonly intents: readonly Intent[];
  readonly lifeEvents: readonly LifeEvent[];
  readonly opportunities: readonly PlannedOpportunity[];
  /** Field to ask about, when `kind` is `clarification`. */
  readonly missingField?: RuleField;
  readonly missingFieldLabel?: LocalisedText;
  readonly missingFieldReason?: LocalisedText;
  /** Retrieved passages the answer is grounded in. */
  readonly citations: readonly {
    readonly chunkId: string;
    readonly opportunityId: string | null;
    readonly title: string;
    readonly excerpt: string;
    readonly sourceUrl: string | null;
  }[];
  readonly overallConfidence: number;
  /** Set when nothing was retrieved — the model must not answer from memory. */
  readonly ungrounded: boolean;
}

export function pickLocalised(text: LocalisedText, locale: 'bn' | 'en'): string {
  return locale === 'bn' ? text.bn : text.en;
}
