import { describe, it, expect } from 'vitest';
import { flagRatio, shouldEscalate, ESCALATION_MIN_FLAGS, ESCALATION_THRESHOLD_RATIO } from '@/modules/budget/escalation-rules';

describe('flagRatio', () => {
  it('computes flags over verified residents', () => {
    expect(flagRatio(2, 4)).toBe(0.5);
    expect(flagRatio(1, 3)).toBeCloseTo(0.333, 3);
  });

  it('returns 0 rather than dividing by zero when there are no verified residents', () => {
    expect(flagRatio(5, 0)).toBe(0);
  });
});

describe('shouldEscalate', () => {
  it('does not escalate below the minimum flag floor even at 100% ratio', () => {
    expect(ESCALATION_MIN_FLAGS).toBeGreaterThan(1);
    expect(shouldEscalate(1, 1)).toBe(false);
  });

  it('does not escalate below the ratio threshold even with enough flags', () => {
    expect(shouldEscalate(2, 10)).toBe(false); // 20%, below 50%
  });

  it('escalates once both the floor and the ratio are met', () => {
    expect(shouldEscalate(ESCALATION_MIN_FLAGS, ESCALATION_MIN_FLAGS * 2)).toBe(true); // exactly 50%
    expect(shouldEscalate(3, 4)).toBe(true); // 75%
  });

  it('never escalates against zero verified residents', () => {
    expect(shouldEscalate(10, 0)).toBe(false);
  });

  it('is consistent with the documented threshold constant', () => {
    expect(ESCALATION_THRESHOLD_RATIO).toBe(0.5);
  });
});
