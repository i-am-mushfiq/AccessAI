export interface OnboardingProfileLike {
  readonly district?: string | null;
  readonly occupation?: string | null;
  readonly onboardingCompletedAt?: Date | null;
}

export function hasCompletedOnboarding(profile: OnboardingProfileLike | null | undefined): boolean {
  return Boolean(profile?.onboardingCompletedAt);
}

export function hasMinimumOnboardingProfile(profile: OnboardingProfileLike | null | undefined): boolean {
  return Boolean(profile?.district && profile?.occupation);
}

export type OnboardingRouteDecision = 'form' | 'results' | 'redirect_dashboard' | 'redirect_onboarding';

/** Keeps direct URL and refresh behaviour explicit and independently testable. */
export function onboardingRouteDecision(
  profile: OnboardingProfileLike | null | undefined,
  showResults: boolean,
): OnboardingRouteDecision {
  if (hasCompletedOnboarding(profile) && !showResults) return 'redirect_dashboard';
  if (!hasCompletedOnboarding(profile) && showResults) return 'redirect_onboarding';
  return showResults ? 'results' : 'form';
}
