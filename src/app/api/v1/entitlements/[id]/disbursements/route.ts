import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { entitlements, beneficiaries } from '@/lib/db/schema';
import { ok, fail, ERROR_CODES, readJson, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { recordDisbursementSchema } from '@/lib/validation/schemas';
import { recordDisbursement } from '@/modules/entitlements/entitlement.service';
import { isUnionOfficialOf } from '@/modules/civic/roles';

/** POST /api/v1/entitlements/:id/disbursements — record one, anchored into the ledger (SJ-14). */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;
    const { id } = await context.params;

    const [row] = await db
      .select({ unionId: beneficiaries.unionId })
      .from(entitlements)
      .innerJoin(beneficiaries, eq(entitlements.beneficiaryId, beneficiaries.id))
      .where(eq(entitlements.id, id))
      .limit(1);
    if (!row) return fail(ERROR_CODES.NOT_FOUND, 'That entitlement could not be found.');
    if (!isUnionOfficialOf(guard.session.user, row.unionId)) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only that union’s chairman or office staff can record a disbursement.');
    }

    const body = recordDisbursementSchema.parse(await readJson(request));
    const disbursement = await recordDisbursement({
      entitlementId: id,
      amount: body.amount,
      scheduledFor: body.scheduledFor,
      status: body.status,
      recordedBy: guard.session.userId,
    });

    return ok({ disbursement }, { status: 201 });
  }, 'entitlements/[id]/disbursements:post');
}

export const dynamic = 'force-dynamic';
