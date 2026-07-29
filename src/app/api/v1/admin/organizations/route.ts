import type { NextRequest } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { organizations, opportunities } from '@/lib/db/schema';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireStaff } from '@/lib/http/session';
import { upsertOrganizationSchema } from '@/lib/validation/schemas';
import { recordAudit } from '@/modules/admin/admin.service';

/**
 * GET  /api/v1/admin/organizations
 * POST /api/v1/admin/organizations
 * PATCH /api/v1/admin/organizations?id=…
 */

export async function GET() {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const items = await db
      .select({
        organization: organizations,
        programmeCount: sql<number>`(SELECT count(*) FROM ${opportunities} WHERE ${opportunities.organizationId} = ${organizations.id})`,
      })
      .from(organizations)
      .orderBy(asc(organizations.name));

    return ok({ items }, { meta: { total: items.length } });
  }, 'admin/organizations:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const body = upsertOrganizationSchema.parse(await readJson(request));

    const [created] = await db
      .insert(organizations)
      .values({
        ...body,
        // `verified` asserts the ENTITY is genuine; verificationStatus tracks
        // whether its details have been checked. They are set separately.
        verified: body.verified ?? false,
        verificationStatus: 'unverified_sample',
      })
      .returning();

    await recordAudit({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: 'organization.create',
      entityType: 'organization',
      entityId: created!.id,
      after: created as unknown as Record<string, unknown>,
    });

    return ok({ organization: created }, { status: 201 });
  }, 'admin/organizations:post');
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return fail(ERROR_CODES.VALIDATION_FAILED, 'Specify which organisation to update.');

    const body = upsertOrganizationSchema.partial().parse(await readJson(request));
    const [before] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!before) return fail(ERROR_CODES.NOT_FOUND, 'That organisation could not be found.');

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) patch[key] = value;
    }

    const [updated] = await db.update(organizations).set(patch).where(eq(organizations.id, id)).returning();

    await recordAudit({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: 'organization.update',
      entityType: 'organization',
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return ok({ organization: updated });
  }, 'admin/organizations:patch');
}

export const dynamic = 'force-dynamic';
