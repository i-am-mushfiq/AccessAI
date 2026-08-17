import type { AuthMode } from '@/components/auth/AuthFlow';

/** Registration must always start the durable first-run flow. */
export function destinationAfterAuth(mode: AuthMode, nextPath?: string): string {
  return mode === 'register' ? '/onboarding' : nextPath ?? '/dashboard';
}
