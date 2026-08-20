import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userProfiles, auditLog } from '@/lib/db/schema';
import { ok, readJson, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { updateProfileSchema } from '@/lib/validation/schemas';
import { toEligibilityProfile, profileCompleteness } from '@/modules/eligibility/profile-mapper';
import { getDistrict } from '@/lib/domain/geography';
import { encryptStringArray, decryptStringArray } from '@/lib/security/field-encryption';

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

    // Derive division from district so a rule written against either works.
    if (typeof body.district === 'string') {
      patch.division = getDistrict(body.district)?.division ?? null;
    }

    // Withdrawing health consent deletes the data it covered.
    if (body.shareHealthData === false) {
      patch.medicalConditions = null;
    }
    if (body.medicalConditions && before && !before.shareHealthData && body.shareHealthData !== true) {
      // Refuse to store health data without consent, rather than storing it
      // and relying on a downstream reader to respect the flag.
      delete patch.medicalConditions;
    }
    // SJ-44 — encrypt at rest. `patch.medicalConditions` up to here is either
    // absent, `null` (explicit clear), or the plaintext array the client sent.
    if ('medicalConditions' in patch) {
      patch.medicalConditions = encryptStringArray(patch.medicalConditions as string[] | null);
    }

    let updatedRaw;
    if (before) {
      [updatedRaw] = await db
        .update(userProfiles)
        .set(patch)
        .where(eq(userProfiles.userId, guard.session.userId))
        .returning();
    } else {
      [updatedRaw] = await db
        .insert(userProfiles)
        .values({ userId: guard.session.userId, ...patch })
        .returning();
    }
    const updated = updatedRaw
      ? { ...updatedRaw, medicalConditions: decryptStringArray(updatedRaw.medicalConditions) }
      : undefined;

    // Redacted, not the real before/after: the audit log is a separate,
    // unencrypted table, and copying decrypted health data into it would
    // undo the point of encrypting the column in the first place.
    const redact = (p: typeof before | typeof updated) =>
      p ? ({ ...p, medicalConditions: p.medicalConditions ? '[redacted]' : p.medicalConditions } as unknown as Record<string, unknown>) : null;

    await db.insert(auditLog).values({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: 'profile.update',
      entityType: 'user_profile',
      entityId: guard.session.userId,
      before: redact(before),
      after: redact(updated),
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
