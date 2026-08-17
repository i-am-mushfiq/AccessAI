/**
 * Server-side normalization for profile fields whose meaning depends on an
 * explicit answer elsewhere in the profile. Keeping this pure makes the
 * invariants easy to test and lets route handlers enforce them consistently.
 */
export function normalizeConditionalProfilePatch(
  patch: Record<string, unknown>,
  currentGender: string | null | undefined,
  currentFarmingActivity: boolean | null | undefined = undefined,
): Record<string, unknown> {
  const normalized = { ...patch };
  const effectiveGender =
    Object.prototype.hasOwnProperty.call(patch, 'gender') ? patch.gender : currentGender;

  if (effectiveGender === 'male') {
    // `null` is the canonical representation for “not applicable/unknown” in
    // this nullable profile field. Do not coerce it to false: false means a
    // relevant user explicitly answered that they are not pregnant.
    normalized.isPregnant = null;
  }

  const effectiveFarmingActivity = Object.prototype.hasOwnProperty.call(patch, 'hasFarmingActivity')
    ? patch.hasFarmingActivity
    : currentFarmingActivity;

  // `false` is the canonical explicit “not involved” state. Clearing the
  // dependent values also when an old inconsistent row is merely edited keeps
  // stale farm details from surviving unrelated profile saves.
  if (effectiveFarmingActivity === false) {
    normalized.farmSizeDecimals = null;
    normalized.crops = null;
    normalized.livestock = null;
  }

  return normalized;
}
