import { describe, expect, it } from 'vitest';
import { hasCompletedOnboarding, hasMinimumOnboardingProfile, onboardingRouteDecision } from '@/modules/onboarding/onboarding';
import { destinationAfterAuth } from '@/modules/onboarding/routing';

describe('onboarding route state', () => {
  it('does not treat an incomplete profile as completed', () => {
    expect(hasCompletedOnboarding({ district: 'dhaka', occupation: 'farmer', onboardingCompletedAt: null })).toBe(false);
    expect(hasMinimumOnboardingProfile({ district: 'dhaka', occupation: 'farmer' })).toBe(true);
  });

  it('recognises durable completion and requires the minimum recommendation inputs', () => {
    expect(hasCompletedOnboarding({ onboardingCompletedAt: new Date() })).toBe(true);
    expect(hasMinimumOnboardingProfile({ district: 'dhaka', occupation: null })).toBe(false);
    expect(hasMinimumOnboardingProfile(null)).toBe(false);
  });

  it('routes new registration into onboarding while preserving returning login destinations', () => {
    expect(destinationAfterAuth('register')).toBe('/onboarding');
    expect(destinationAfterAuth('login', '/opportunities')).toBe('/opportunities');
    expect(destinationAfterAuth('login')).toBe('/dashboard');
  });

  it('keeps direct URLs and refreshes consistent with the durable marker', () => {
    expect(onboardingRouteDecision({ onboardingCompletedAt: null }, false)).toBe('form');
    expect(onboardingRouteDecision({ onboardingCompletedAt: new Date() }, false)).toBe('redirect_dashboard');
    expect(onboardingRouteDecision({ onboardingCompletedAt: new Date() }, true)).toBe('results');
    expect(onboardingRouteDecision({ onboardingCompletedAt: null }, true)).toBe('redirect_onboarding');
  });
});
