/**
 * SJ-17/18 — pure threshold logic, kept separate from the database so it is
 * directly testable. The BRD names "50%" as the example threshold; the
 * minimum-flag floor is this build's own addition (see docs/DEVIATIONS.md):
 * without it, a union with a single verified resident would escalate to an
 * officer on that one person's first flag, which is a ratio doing the work
 * of a headcount.
 */

export const ESCALATION_THRESHOLD_RATIO = 0.5;
export const ESCALATION_MIN_FLAGS = 2;

export function flagRatio(flagCount: number, verifiedResidentCount: number): number {
  if (verifiedResidentCount <= 0) return 0;
  return flagCount / verifiedResidentCount;
}

export function shouldEscalate(flagCount: number, verifiedResidentCount: number): boolean {
  if (flagCount < ESCALATION_MIN_FLAGS) return false;
  if (verifiedResidentCount <= 0) return false;
  return flagRatio(flagCount, verifiedResidentCount) >= ESCALATION_THRESHOLD_RATIO;
}
