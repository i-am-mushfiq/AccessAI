import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { donorOrganizations, donorFundingScopes } from '@/lib/db/schema';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireStaff, canManageUsers } from '@/lib/http/session';
import { recordAudit } from '@/modules/admin/admin.service';

/**
 * GET  /api/v1/admin/donors — list donor organisations, for the civic-roles
 *      assignment screen to attach a user to one.
 * POST /api/v1/admin/donors — create a donor org and the programme codes it
 *      funds (SJ-27's scoping — see modules/oversight/oversight.service.ts).
 */

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  nameBn: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  programCodes: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
});

export async function GET() {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const orgs = await db.select().from(donorOrganizations);
    const scopes = await db.select().from(donorFundingScopes);
    const scopesByOrg = new Map<string, string[]>();
    for (const s of scopes) {
      const list = scopesByOrg.get(s.donorOrgId) ?? [];
      list.push(s.programCode);
      scopesByOrg.set(s.donorOrgId, list);
    }

    return ok({ items: orgs.map((org) => ({ ...org, programCodes: scopesByOrg.get(org.id) ?? [] })) });
  }, 'admin/donors:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;
    if (!canManageUsers(guard.session.role)) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only an administrator can create a donor organisation.');
    }

    const body = createSchema.parse(await readJson(request));

    const [org] = await db
      .insert(donorOrganizations)
      .values({ name: body.name, nameBn: body.nameBn, description: body.description ?? null })
      .returning();

    await db.insert(donorFundingScopes).values(body.programCodes.map((programCode) => ({ donorOrgId: org!.id, programCode })));

    await recordAudit({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: 'donor_org.create',
      entityType: 'donor_organization',
      entityId: org!.id,
      after: { name: org!.name, programCodes: body.programCodes },
    });

    return ok({ org, programCodes: body.programCodes });
  }, 'admin/donors:post');
}

export const dynamic = 'force-dynamic';
