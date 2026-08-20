import type { NextRequest } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireStaff, canManageUsers } from '@/lib/http/session';
import { recordAudit } from '@/modules/admin/admin.service';
import { ROLE_RANK, USER_ROLES, CIVIC_ROLES } from '@/lib/domain/enums';
import { logoutEverywhere } from '@/modules/auth/auth.service';

const patchSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  /** SJ-31–34. A separate axis from `role` — see modules/civic/roles.ts. */
  civicRole: z.enum(CIVIC_ROLES).optional(),
  civicUnionId: z.string().uuid().nullish(),
  civicUpazila: z.string().trim().min(1).max(120).nullish(),
  civicDistrict: z.string().trim().min(1).max(120).nullish(),
  /** SJ-27. Presence makes an account a donor representative — see modules/oversight. */
  donorOrgId: z.string().uuid().nullish(),
});

/**
 * GET   /api/v1/admin/users
 * PATCH /api/v1/admin/users — change a role or suspend an account
 *
 * Guard rails that matter:
 *  • Nobody can grant a role at or above their own rank — otherwise a
 *    moderator could promote themselves to super admin.
 *  • Nobody can change their own role or suspend themselves, which prevents
 *    both accidental self-lockout and a deliberate privilege escalation via a
 *    two-step self-edit.
 *  • A demotion or suspension revokes the target's sessions immediately, so the
 *    change takes effect now rather than when their token happens to expire.
 */

export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const search = url.searchParams.get('q');

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        email: users.email,
        role: users.role,
        status: users.status,
        district: users.district,
        language: users.language,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        civicRole: users.civicRole,
        civicUnionId: users.civicUnionId,
        civicUpazila: users.civicUpazila,
        civicDistrict: users.civicDistrict,
        donorOrgId: users.donorOrgId,
      })
      .from(users)
      .where(
        search
          ? sql`(lower(${users.name}) LIKE ${`%${search.toLowerCase()}%`} OR ${users.phone} LIKE ${`%${search}%`})`
          : undefined,
      )
      .orderBy(desc(users.createdAt))
      .limit(100);

    const counts = await db.select({ role: users.role, n: sql<number>`count(*)` }).from(users).groupBy(users.role);

    return ok({
      items: rows,
      counts: Object.fromEntries(counts.map((c) => [c.role, Number(c.n)])),
      canManage: canManageUsers(guard.session.role),
    });
  }, 'admin/users:get');
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;
    if (!canManageUsers(guard.session.role)) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only an administrator can change roles.');
    }

    const body = patchSchema.parse(await readJson(request));

    if (body.userId === guard.session.userId) {
      return fail(
        ERROR_CODES.FORBIDDEN,
        'You cannot change your own role or status. Ask another administrator.',
      );
    }

    const [target] = await db.select().from(users).where(eq(users.id, body.userId)).limit(1);
    if (!target) return fail(ERROR_CODES.NOT_FOUND, 'That user could not be found.');

    if (body.role) {
      if (ROLE_RANK[body.role] >= ROLE_RANK[guard.session.role]) {
        return fail(ERROR_CODES.FORBIDDEN, 'You cannot grant a role at or above your own.');
      }
      if (ROLE_RANK[target.role] >= ROLE_RANK[guard.session.role]) {
        return fail(ERROR_CODES.FORBIDDEN, 'You cannot change the role of someone at or above your own rank.');
      }
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.role) patch.role = body.role;
    if (body.status) patch.status = body.status;
    if (body.civicRole) {
      patch.civicRole = body.civicRole;
      // Only the scope column that matches the new title is kept — assigning
      // someone as an upazila officer must not leave a stale union/district
      // behind that a later check could mistakenly read as still valid.
      patch.civicUnionId = body.civicRole === 'union_chairman' || body.civicRole === 'union_staff' ? (body.civicUnionId ?? null) : null;
      patch.civicUpazila = body.civicRole === 'upazila_officer' ? (body.civicUpazila ?? null) : null;
      patch.civicDistrict = body.civicRole === 'zila_officer' ? (body.civicDistrict ?? null) : null;
    }
    if (body.donorOrgId !== undefined) patch.donorOrgId = body.donorOrgId ?? null;

    const [updated] = await db.update(users).set(patch).where(eq(users.id, body.userId)).returning();

    // Take effect immediately rather than at token expiry.
    const demoted = body.role && ROLE_RANK[body.role] < ROLE_RANK[target.role];
    if (demoted || body.status === 'suspended') {
      await logoutEverywhere(body.userId);
    }

    await recordAudit({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: 'user.update',
      entityType: 'user',
      entityId: body.userId,
      before: { role: target.role, status: target.status, civicRole: target.civicRole, donorOrgId: target.donorOrgId },
      after: { role: updated!.role, status: updated!.status, civicRole: updated!.civicRole, donorOrgId: updated!.donorOrgId },
    });

    return ok({
      user: {
        id: updated!.id,
        name: updated!.name,
        role: updated!.role,
        status: updated!.status,
        civicRole: updated!.civicRole,
        civicUnionId: updated!.civicUnionId,
        civicUpazila: updated!.civicUpazila,
        civicDistrict: updated!.civicDistrict,
        donorOrgId: updated!.donorOrgId,
      },
      sessionsRevoked: Boolean(demoted || body.status === 'suspended'),
    });
  }, 'admin/users:patch');
}

export const dynamic = 'force-dynamic';
