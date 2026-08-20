import type { NextRequest } from 'next/server';
import { ok, fail, ERROR_CODES, readJson, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { createAllocationSchema } from '@/lib/validation/schemas';
import { createAllocation, listAllocationsForUnion } from '@/modules/budget/budget.service';
import { isUnionOfficialOf } from '@/modules/civic/roles';

/**
 * GET  /api/v1/budget/allocations — the citizen's own union's allocations
 * POST /api/v1/budget/allocations — a chairman/union-staff member posts one
 *
 * Both scoped to the caller's OWN union — GET from their verified residency
 * (Phase 1), POST from their assigned civicUnionId — never a client-supplied
 * union id. Same discipline as /api/v1/issues.
 */

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const unionId = guard.session.profile?.residencyUnionId;
    if (!unionId) {
      return fail(ERROR_CODES.FORBIDDEN, 'Verify which union you live in before viewing its budget.', {
        status: 403,
        details: { requires: 'residency_verification' },
      });
    }

    const items = await listAllocationsForUnion(unionId);
    return ok({ items, unionId });
  }, 'budget/allocations:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const unionId = guard.session.user.civicUnionId;
    if (!unionId || !isUnionOfficialOf(guard.session.user, unionId)) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only a union chairman or union office staff can post a budget allocation.');
    }

    const body = createAllocationSchema.parse(await readJson(request));
    const allocation = await createAllocation({
      unionId,
      postedBy: guard.session.userId,
      projectName: body.projectName,
      description: body.description,
      amount: body.amount,
      allocationDate: body.allocationDate,
    });

    return ok({ allocation }, { status: 201 });
  }, 'budget/allocations:post');
}

export const dynamic = 'force-dynamic';
