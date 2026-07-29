import { describe, it, expect } from 'vitest';
import { evaluateEligibility, type EligibilityProfile } from '@/modules/eligibility/engine';
import { validateRuleSet, type RuleCondition, type RuleNode, type RuleSet, type RuleField } from '@/lib/domain/rules';
import type { RuleOperator } from '@/lib/domain/enums';

/* ------------------------------------------------------------- builders */

let seq = 0;
function cond(
  field: RuleField,
  operator: RuleOperator,
  value?: RuleCondition['value'],
  extra: Partial<RuleCondition> = {},
): RuleCondition {
  seq += 1;
  return {
    kind: 'condition',
    id: `c${seq}`,
    field,
    operator,
    value,
    whenMet: { en: 'met', bn: 'পূরণ হয়েছে' },
    whenFailed: { en: 'failed', bn: 'পূরণ হয়নি' },
    whenUnknown: { en: 'unknown', bn: 'জানা নেই' },
    ...extra,
  };
}

function ruleSet(root: RuleNode, requiredFields: RuleField[] = []): RuleSet {
  return { schemaVersion: 1, root, requiredFields };
}

function all(...children: RuleNode[]): RuleNode {
  seq += 1;
  return { kind: 'all', id: `g${seq}`, children };
}
function any(...children: RuleNode[]): RuleNode {
  seq += 1;
  return { kind: 'any', id: `g${seq}`, children };
}
function none(...children: RuleNode[]): RuleNode {
  seq += 1;
  return { kind: 'none', id: `g${seq}`, children };
}

/* ------------------------------------------------------ core semantics */

describe('three-valued logic', () => {
  it('returns eligible when every hard condition is met', () => {
    const rs = ruleSet(all(cond('age', 'gte', 65), cond('gender', 'eq', 'female')), ['age', 'gender']);
    const result = evaluateEligibility(rs, { age: 70, gender: 'female' });
    expect(result.outcome).toBe('eligible');
    expect(result.matched).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.ruleCoverage).toBe(100);
  });

  it('treats a missing field as unknown, never as false', () => {
    const rs = ruleSet(all(cond('age', 'gte', 65), cond('monthlyIncome', 'lt', 5000)), ['age', 'monthlyIncome']);
    const result = evaluateEligibility(rs, { age: 70 });
    expect(result.outcome).toBe('unknown');
    expect(result.unknown.map((u) => u.field)).toEqual(['monthlyIncome']);
    expect(result.missingFields).toEqual(['monthlyIncome']);
    // Critically: it must NOT be reported as a failure.
    expect(result.failed).toHaveLength(0);
  });

  it('lets a hard statutory bar decide even when other data is missing', () => {
    // A men-only applicant to a women-only programme is not "unknown" merely
    // because income has not been entered yet.
    const rs = ruleSet(all(cond('gender', 'eq', 'female'), cond('monthlyIncome', 'lt', 5000)), [
      'gender',
      'monthlyIncome',
    ]);
    const result = evaluateEligibility(rs, { gender: 'male' });
    expect(result.outcome).toBe('not_eligible');
    expect(result.failed.map((f) => f.field)).toEqual(['gender']);
  });

  it('reports unknown when a required field is absent even if all tested conditions pass', () => {
    const rs = ruleSet(all(cond('age', 'gte', 18)), ['age', 'district']);
    const result = evaluateEligibility(rs, { age: 30 });
    expect(result.outcome).toBe('unknown');
    expect(result.missingFields).toEqual(['district']);
  });

  it('downgrades to partially_eligible when only soft conditions fail', () => {
    const rs = ruleSet(
      all(cond('age', 'gte', 18), cond('district', 'eq', 'dhaka', { soft: true })),
      ['age'],
    );
    const result = evaluateEligibility(rs, { age: 30, district: 'sylhet' });
    expect(result.outcome).toBe('partially_eligible');
    expect(result.softFailed).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
  });
});

describe('group combinators', () => {
  it('any: one met is decisive', () => {
    const rs = ruleSet(any(cond('occupation', 'eq', 'farmer'), cond('occupation', 'eq', 'student')));
    expect(evaluateEligibility(rs, { occupation: 'student' }).outcome).toBe('eligible');
  });

  it('any: all failed is not_eligible', () => {
    const rs = ruleSet(any(cond('occupation', 'eq', 'farmer'), cond('occupation', 'eq', 'student')));
    expect(evaluateEligibility(rs, { occupation: 'teacher' }).outcome).toBe('not_eligible');
  });

  it('any: unknown blocks a verdict when nothing has matched', () => {
    const rs = ruleSet(any(cond('occupation', 'eq', 'farmer'), cond('cgpa', 'gte', 3.5)));
    const r = evaluateEligibility(rs, { occupation: 'teacher' });
    expect(r.outcome).toBe('unknown');
  });

  it('none: a match becomes a failure', () => {
    const rs = ruleSet(none(cond('occupation', 'eq', 'government_employee')));
    expect(evaluateEligibility(rs, { occupation: 'government_employee' }).outcome).toBe('not_eligible');
    expect(evaluateEligibility(rs, { occupation: 'farmer' }).outcome).toBe('eligible');
  });

  it('nests groups correctly', () => {
    // age >= 65 AND (income < 5000 OR no land)
    const rs = ruleSet(
      all(cond('age', 'gte', 65), any(cond('monthlyIncome', 'lt', 5000), cond('landOwnershipDecimals', 'lte', 0))),
      ['age'],
    );
    expect(evaluateEligibility(rs, { age: 70, monthlyIncome: 9000, landOwnershipDecimals: 0 }).outcome).toBe('eligible');
    expect(evaluateEligibility(rs, { age: 70, monthlyIncome: 9000, landOwnershipDecimals: 50 }).outcome).toBe('not_eligible');
  });
});

describe('operators', () => {
  const p: EligibilityProfile = {
    age: 40,
    education: 'hsc',
    crops: ['rice', 'jute'],
    district: 'dhaka',
    monthlyIncome: 8000,
    hasNid: true,
  };

  it('handles comparison operators', () => {
    expect(evaluateEligibility(ruleSet(all(cond('age', 'gt', 39))), p).outcome).toBe('eligible');
    expect(evaluateEligibility(ruleSet(all(cond('age', 'gt', 40))), p).outcome).toBe('not_eligible');
    expect(evaluateEligibility(ruleSet(all(cond('age', 'gte', 40))), p).outcome).toBe('eligible');
    expect(evaluateEligibility(ruleSet(all(cond('age', 'lte', 40))), p).outcome).toBe('eligible');
    expect(evaluateEligibility(ruleSet(all(cond('age', 'lt', 40))), p).outcome).toBe('not_eligible');
  });

  it('handles between inclusively', () => {
    expect(evaluateEligibility(ruleSet(all(cond('age', 'between', [40, 50]))), p).outcome).toBe('eligible');
    expect(evaluateEligibility(ruleSet(all(cond('age', 'between', [18, 39]))), p).outcome).toBe('not_eligible');
  });

  it('handles in / not_in', () => {
    expect(evaluateEligibility(ruleSet(all(cond('district', 'in', ['dhaka', 'gazipur']))), p).outcome).toBe('eligible');
    expect(evaluateEligibility(ruleSet(all(cond('district', 'not_in', ['dhaka']))), p).outcome).toBe('not_eligible');
  });

  it('handles contains_any / contains_all on arrays', () => {
    expect(evaluateEligibility(ruleSet(all(cond('crops', 'contains_any', ['rice', 'wheat']))), p).outcome).toBe('eligible');
    expect(evaluateEligibility(ruleSet(all(cond('crops', 'contains_all', ['rice', 'wheat']))), p).outcome).toBe('not_eligible');
    expect(evaluateEligibility(ruleSet(all(cond('crops', 'contains_all', ['rice', 'jute']))), p).outcome).toBe('eligible');
  });

  it('handles exists / not_exists as the only absence-decidable operators', () => {
    expect(evaluateEligibility(ruleSet(all(cond('cgpa', 'exists'))), p).outcome).toBe('not_eligible');
    expect(evaluateEligibility(ruleSet(all(cond('cgpa', 'not_exists'))), p).outcome).toBe('eligible');
    expect(evaluateEligibility(ruleSet(all(cond('age', 'exists'))), p).outcome).toBe('eligible');
  });

  it('compares education ordinally, not alphabetically', () => {
    // 'hsc' > 'bachelor' alphabetically, but must be LOWER by rank.
    expect(evaluateEligibility(ruleSet(all(cond('education', 'gte', 'ssc'))), p).outcome).toBe('eligible');
    expect(evaluateEligibility(ruleSet(all(cond('education', 'gte', 'bachelor'))), p).outcome).toBe('not_eligible');
    expect(evaluateEligibility(ruleSet(all(cond('education', 'in', ['hsc', 'diploma']))), p).outcome).toBe('eligible');
  });
});

describe('scoring and trace', () => {
  it('weights the eligibility score by condition weight', () => {
    const rs = ruleSet(
      all(cond('age', 'gte', 18, { weight: 3 }), cond('district', 'eq', 'dhaka', { weight: 1 })),
    );
    const r = evaluateEligibility(rs, { age: 30, district: 'sylhet' });
    expect(r.score).toBe(75); // 3 of 4 weight earned
  });

  it('excludes unknowns from the score so incomplete profiles are not punished', () => {
    const rs = ruleSet(all(cond('age', 'gte', 18, { weight: 1 }), cond('cgpa', 'gte', 3, { weight: 1 })));
    const r = evaluateEligibility(rs, { age: 30 });
    // 1 of 2 weight met, cgpa unknown — reported honestly rather than as 0.
    expect(r.score).toBe(50);
    expect(r.ruleCoverage).toBe(50);
  });

  it('emits a renderable reason for every condition in the locale requested', () => {
    const rs = ruleSet(all(cond('age', 'gte', 65)));
    const r = evaluateEligibility(rs, { age: 20 });
    expect(r.failed[0]?.reason.bn).toBe('পূরণ হয়নি');
    expect(r.failed[0]?.reason.en).toBe('failed');
    expect(r.failed[0]?.actual).toBe(20);
    expect(r.failed[0]?.expected).toBe(65);
  });

  it('produces a fallback unknown reason when the author omitted one', () => {
    const bare: RuleCondition = {
      kind: 'condition',
      id: 'bare',
      field: 'cgpa',
      operator: 'gte',
      value: 3,
      whenMet: { en: 'ok', bn: 'ঠিক' },
      whenFailed: { en: 'no', bn: 'না' },
    };
    const r = evaluateEligibility(ruleSet(all(bare)), {});
    expect(r.unknown[0]?.reason.en).toContain('CGPA');
    expect(r.unknown[0]?.reason.bn).toContain('সিজিপিএ');
  });

  it('is deterministic — identical input yields identical output', () => {
    const rs = ruleSet(all(cond('age', 'gte', 65), cond('monthlyIncome', 'lt', 5000)), ['age']);
    const profile = { age: 70, monthlyIncome: 3000 };
    const a = evaluateEligibility(rs, profile);
    const b = evaluateEligibility(rs, profile);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

/* ------------------------------------------------------ rule validation */

describe('validateRuleSet', () => {
  it('accepts a well-formed rule set', () => {
    const result = validateRuleSet(ruleSet(all(cond('age', 'gte', 65)), ['age']));
    expect(result.ok).toBe(true);
  });

  it('rejects an operator that needs a value but has none', () => {
    const result = validateRuleSet(ruleSet(all(cond('age', 'gte', undefined))));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('has no value');
  });

  it('rejects between with the wrong arity', () => {
    const result = validateRuleSet(ruleSet(all(cond('age', 'between', [18]))));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('exactly two bounds');
  });

  it('rejects inverted between bounds', () => {
    const result = validateRuleSet(ruleSet(all(cond('age', 'between', [60, 20]))));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('exceeds upper bound');
  });

  it('rejects a set operator given a scalar', () => {
    const result = validateRuleSet(ruleSet(all(cond('district', 'in', 'dhaka'))));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('needs an array value');
  });

  it('rejects duplicate node ids', () => {
    const a = cond('age', 'gte', 18);
    const dup: RuleCondition = { ...a };
    const result = validateRuleSet(ruleSet(all(a, dup)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('Duplicate node id');
  });

  it('rejects a missing localisation', () => {
    const broken = {
      schemaVersion: 1,
      requiredFields: [],
      root: {
        kind: 'condition',
        id: 'x',
        field: 'age',
        operator: 'gte',
        value: 18,
        whenMet: { en: 'ok' },
        whenFailed: { en: 'no', bn: 'না' },
      },
    };
    expect(validateRuleSet(broken).ok).toBe(false);
  });
});
