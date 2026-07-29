import { z } from 'zod';
import { RULE_OPERATORS, type RuleOperator } from './enums';

/**
 * Eligibility rule AST.
 *
 * PRD §24 mandates that this module "must not use an LLM" and specifies only
 * "Store rules as JSON". The concrete grammar below is authored here (see
 * docs/DEVIATIONS.md §4) with three properties the PRD's own acceptance
 * criteria demand but do not define:
 *
 *  1. THREE-VALUED LOGIC. A missing profile field yields `unknown`, never
 *     `false`. PRD §17 lists "Unknown" as a first-class output and §22 requires
 *     the system to ask rather than guess — so a rule engine that treats absent
 *     data as failure would silently deny benefits people are entitled to.
 *     `unknown` therefore propagates: all-of with any unknown and no failure is
 *     unknown, not eligible.
 *
 *  2. EXPLANATION AS DATA. Every node carries the citizen-facing reason for
 *     both outcomes, in both locales. The LLM never invents a reason; it only
 *     re-voices the strings the engine emits (PRD Principle 4, §30, §33).
 *
 *  3. VERSIONING. Rules are evaluated by version and the evaluation is stored
 *     with the version that produced it, so a later rule change cannot
 *     retroactively alter a citizen's recorded result (PRD §122).
 */

/** Profile fields a rule may read. Closed set — a typo becomes a type error. */
export const RULE_FIELDS = [
  'age',
  'gender',
  'district',
  'division',
  'monthlyIncome',
  'annualIncome',
  'occupation',
  'education',
  'cgpa',
  'hasDisability',
  'disabilityType',
  'maritalStatus',
  'householdSize',
  'dependents',
  'landOwnershipDecimals',
  'isStudent',
  'hasBusiness',
  'businessType',
  'employees',
  'farmSizeDecimals',
  'crops',
  'livestock',
  'isPregnant',
  'medicalConditions',
  'citizenship',
  'university',
  'department',
  'preferredCountry',
  'ieltsScore',
  'hasNid',
  'hasBankAccount',
  'isFreedomFighterFamily',
  'lifeEvents',
] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export interface LocalisedText {
  readonly en: string;
  readonly bn: string;
}

/** A single testable condition. */
export interface RuleCondition {
  readonly kind: 'condition';
  readonly id: string;
  readonly field: RuleField;
  readonly operator: RuleOperator;
  /** Absent for `exists` / `not_exists`; a 2-tuple for `between`. */
  readonly value?: string | number | boolean | readonly (string | number)[];
  /** Shown when the condition passes, e.g. "Your age is above 65". */
  readonly whenMet: LocalisedText;
  /** Shown when it fails, e.g. "This programme starts at age 65". */
  readonly whenFailed: LocalisedText;
  /** Shown when the profile lacks the field, phrased as a question prompt. */
  readonly whenUnknown?: LocalisedText;
  /**
   * A soft condition never blocks eligibility; failing it downgrades the
   * result to `partially_eligible`. Used for preferences and tie-breakers
   * rather than statutory bars.
   */
  readonly soft?: boolean;
  /** Relative weight for the eligibility component of the ranking score. */
  readonly weight?: number;
  /** Provenance for this specific condition — the clause it came from. */
  readonly citation?: string;
}

export interface RuleGroup {
  readonly kind: 'all' | 'any' | 'none';
  readonly id: string;
  readonly children: readonly RuleNode[];
  readonly label?: LocalisedText;
}

export type RuleNode = RuleCondition | RuleGroup;

export interface RuleSet {
  /** Grammar version, so an old stored rule can still be read correctly. */
  readonly schemaVersion: 1;
  readonly root: RuleNode;
  /** Fields that must be known before a verdict is meaningful (PRD §22). */
  readonly requiredFields: readonly RuleField[];
  readonly notes?: LocalisedText;
}

/* ----------------------------------------------------------- validation */

const localisedTextSchema = z.object({
  en: z.string().min(1),
  bn: z.string().min(1),
});

const conditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

const conditionSchema: z.ZodType<RuleCondition> = z.object({
  kind: z.literal('condition'),
  id: z.string().min(1),
  field: z.enum(RULE_FIELDS),
  operator: z.enum(RULE_OPERATORS),
  value: conditionValueSchema.optional(),
  whenMet: localisedTextSchema,
  whenFailed: localisedTextSchema,
  whenUnknown: localisedTextSchema.optional(),
  soft: z.boolean().optional(),
  weight: z.number().min(0).max(100).optional(),
  citation: z.string().optional(),
});

const nodeSchema: z.ZodType<RuleNode> = z.lazy(() =>
  z.union([
    conditionSchema,
    z.object({
      kind: z.enum(['all', 'any', 'none']),
      id: z.string().min(1),
      children: z.array(nodeSchema).min(1),
      label: localisedTextSchema.optional(),
    }),
  ]),
);

export const ruleSetSchema: z.ZodType<RuleSet> = z.object({
  schemaVersion: z.literal(1),
  root: nodeSchema,
  requiredFields: z.array(z.enum(RULE_FIELDS)),
  notes: localisedTextSchema.optional(),
});

/**
 * Structural validation used by the admin rule editor before a rule can be
 * saved. Catches the mistakes a rule author actually makes: an operator that
 * needs a value with none supplied, a `between` without exactly two bounds,
 * and set operators given a scalar.
 */
export function validateRuleSet(input: unknown): { ok: true; value: RuleSet } | { ok: false; errors: string[] } {
  const parsed = ruleSetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  const errors: string[] = [];
  const seen = new Set<string>();

  const walk = (node: RuleNode): void => {
    if (seen.has(node.id)) errors.push(`Duplicate node id "${node.id}".`);
    seen.add(node.id);

    if (node.kind === 'condition') {
      const needsValue: RuleOperator[] = [
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'between', 'contains_any', 'contains_all',
      ];
      if (needsValue.includes(node.operator) && node.value === undefined) {
        errors.push(`Condition "${node.id}" uses "${node.operator}" but has no value.`);
      }
      if (node.operator === 'between') {
        if (!Array.isArray(node.value) || node.value.length !== 2) {
          errors.push(`Condition "${node.id}" uses "between" and needs exactly two bounds.`);
        } else {
          const [lo, hi] = node.value as [number, number];
          if (typeof lo === 'number' && typeof hi === 'number' && lo > hi) {
            errors.push(`Condition "${node.id}": lower bound ${lo} exceeds upper bound ${hi}.`);
          }
        }
      }
      const setOps: RuleOperator[] = ['in', 'not_in', 'contains_any', 'contains_all'];
      if (setOps.includes(node.operator) && !Array.isArray(node.value)) {
        errors.push(`Condition "${node.id}" uses "${node.operator}" and needs an array value.`);
      }
      const numericOps: RuleOperator[] = ['gt', 'gte', 'lt', 'lte'];
      if (numericOps.includes(node.operator) && typeof node.value === 'boolean') {
        errors.push(`Condition "${node.id}" compares a boolean with "${node.operator}".`);
      }
      return;
    }
    node.children.forEach(walk);
  };

  walk(parsed.data.root);
  return errors.length ? { ok: false, errors } : { ok: true, value: parsed.data };
}

/** Every field the rule set actually reads — drives the follow-up questions. */
export function collectFields(node: RuleNode, acc: Set<RuleField> = new Set()): Set<RuleField> {
  if (node.kind === 'condition') {
    acc.add(node.field);
    return acc;
  }
  node.children.forEach((child) => collectFields(child, acc));
  return acc;
}
