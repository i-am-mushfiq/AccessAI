import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, userProfiles } from '@/lib/db/schema';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { updateUserSchema } from '@/lib/validation/schemas';
import { deleteAccount } from '@/modules/auth/auth.service';
import { clearAuthCookies } from '@/lib/http/cookies';
import { toEligibilityProfile, profileCompleteness, suggestNextFields } from '@/modules/eligibility/profile-mapper';
import { fieldLabel } from '@/modules/eligibility/engine';

/**
 * GET    /api/v1/users/me — account + profile completeness
 * PATCH  /api/v1/users/me — update account fields
 * DELETE /api/v1/users/me — delete the account (PRD §69, §121)
 */

export async function GET() {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;
    const { user, profile, settings } = guard.session;

    const eligibilityProfile = toEligibilityProfile({ user, profile });

    return ok({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        language: user.language,
        district: user.district,
        hasPin: Boolean(user.pinHash),
        phoneVerified: Boolean(user.phoneVerifiedAt),
        createdAt: user.createdAt,
      },
      profile,
      settings,
      completeness: profileCompleteness(eligibilityProfile),
      // Which questions would most improve their recommendations, so the UI can
      // prompt for the highest-value field rather than a random empty one.
      suggestedFields: suggestNextFields(eligibilityProfile, 3).map((field) => ({
        field,
        label: fieldLabel(field),
      })),
    });
  }, 'users/me:get');
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const body = updateUserSchema.parse(await readJson(request));
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) patch.name = body.name;
    if (body.email !== undefined) patch.email = body.email ?? null;
    if (body.language !== undefined) patch.language = body.language;
    if (body.district !== undefined) patch.district = body.district ?? null;

    const [updated] = await db.update(users).set(patch).where(eq(users.id, guard.session.userId)).returning();

    // Keep the district on the profile in step, since eligibility reads it there.
    if (body.district !== undefined) {
      await db
        .update(userProfiles)
        .set({ district: body.district ?? null, updatedAt: new Date() })
        .where(eq(userProfiles.userId, guard.session.userId));
    }

    return ok({
      user: {
        id: updated!.id,
        name: updated!.name,
        email: updated!.email,
        language: updated!.language,
        district: updated!.district,
      },
    });
  }, 'users/me:patch');
}

export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    // Destructive and irreversible, so it requires an explicit confirmation
    // token in the body rather than being triggerable by a stray request.
    const body = (await request.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== 'DELETE') {
      return fail(
        ERROR_CODES.VALIDATION_FAILED,
        'Account deletion needs an explicit confirmation.',
        { fields: { confirm: 'Type DELETE to confirm.' } },
      );
    }

    await deleteAccount(guard.session.userId);
    const response = ok({ deleted: true });
    clearAuthCookies(response);
    return response;
  }, 'users/me:delete');
}

export const dynamic = 'force-dynamic';
