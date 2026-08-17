import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userProfiles, auditLog } from '@/lib/db/schema';
import { ok, readJson, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { updateProfileSchema } from '@/lib/validation/schemas';
import { toEligibilityProfile, profileCompleteness } from '@/modules/eligibility/profile-mapper';
import { normalizeConditionalProfilePatch } from '@/modules/eligibility/profile-safety';
import { getDistrict } from '@/lib/domain/geography';

/**
 * GET   /api/v1/users/profile
 * PATCH /api/v1/users/profile
 *
 * A PATCH here changes future eligibility decisions, so it is audited. Health
 * fields are only stored when `shareHealthData` is true, and switching that flag
 * off ERASES the stored conditions rather than merely hiding them — PRD §121
 * gives the citizen control over their data, and hiding is not control.
 */

export async function GET() {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    return ok({
      profile: guard.session.profile,
      completeness: profileCompleteness(
        toEligibilityProfile({ user: guard.session.user, profile: guard.session.profile }),
      ),
    });
  }, 'users/profile:get');
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const body = updateProfileSchema.partial().parse(await readJson(request));
    const before = guard.session.profile;

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) continue;
      patch[key] = value;
    }

    // The API accepts life-event codes, while the database keeps provenance
    // and detection time. Explicit onboarding/profile choices are manual and
    // replace the current list so stale selections cannot survive a save.
    if (body.lifeEvents !== undefined) {
      patch.lifeEvents = body.lifeEvents === null
        ? null
        : body.lifeEvents.map((event) => ({ event, detectedAt: Date.now(), source: 'manual' as const }));
    }

    // Derive division from district so a rule written against either works.
    if (typeof body.district === 'string') {
      patch.division = getDistrict(body.district)?.division ?? null;
    }

    Object.assign(
      patch,
      normalizeConditionalProfilePatch(patch, before?.gender, before?.hasFarmingActivity),
    );

    // Withdrawing health consent deletes the data it covered.
    if (body.shareHealthData === false) {
      patch.medicalConditions = null;
    }
    if (body.medicalConditions && before && !before.shareHealthData && body.shareHealthData !== true) {
      // Refuse to store health data without consent, rather than storing it
      // and relying on a downstream reader to respect the flag.
      delete patch.medicalConditions;
    }

    let updated;
    if (before) {
      [updated] = await db
        .update(userProfiles)
        .set(patch)
        .where(eq(userProfiles.userId, guard.session.userId))
        .returning();
    } else {
      [updated] = await db
        .insert(userProfiles)
        .values({ userId: guard.session.userId, ...patch })
        .returning();
    }

    // A successful mutation must always carry the row that was actually
    // written. This is the canonical source used to reconcile client state.
    if (!updated) throw new Error('Profile update did not return a row.');

    await db.insert(auditLog).values({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: 'profile.update',
      entityType: 'user_profile',
      entityId: guard.session.userId,
      before: before ? (before as unknown as Record<string, unknown>) : null,
      after: updated as unknown as Record<string, unknown>,
    });

    return ok({
      profile: updated,
      completeness: profileCompleteness(
        toEligibilityProfile({ user: guard.session.user, profile: updated ?? null }),
      ),
    });
  }, 'users/profile:patch');
}

export const dynamic = 'force-dynamic';
