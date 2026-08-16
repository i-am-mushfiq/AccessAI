import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userProfiles } from '@/lib/db/schema';
import { handle, HttpError, ERROR_CODES, ok } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { hasMinimumOnboardingProfile } from '@/modules/onboarding/onboarding';

/** POST /api/v1/users/onboarding/complete — idempotent first-run completion. */
export async function POST() {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const profile = guard.session.profile;
    if (!hasMinimumOnboardingProfile(profile)) {
      throw new HttpError(
        ERROR_CODES.VALIDATION_FAILED,
        'Choose your district and occupation before continuing.',
        422,
        { district: 'required', occupation: 'required' },
      );
    }

    if (profile?.onboardingCompletedAt) {
      return ok({ onboardingCompletedAt: profile.onboardingCompletedAt });
    }

    const completedAt = new Date();
    const [updated] = await db
      .update(userProfiles)
      .set({ onboardingCompletedAt: completedAt, updatedAt: completedAt })
      .where(eq(userProfiles.userId, guard.session.userId))
      .returning({ onboardingCompletedAt: userProfiles.onboardingCompletedAt });

    if (!updated) throw new Error('Onboarding completion did not return a profile row.');
    return ok(updated);
  }, 'users/onboarding:complete');
}

export const dynamic = 'force-dynamic';
