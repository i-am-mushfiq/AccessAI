import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { budgetAllocations } from '@/lib/db/schema';
import { ok, fail, ERROR_CODES, readJson, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { flagAllocationSchema } from '@/lib/validation/schemas';
import { flagAllocation } from '@/modules/budget/budget.service';

/**
 * POST /api/v1/budget/allocations/:id/flag — SJ-16.
 *
 * Restricted to verified residents of the allocation's own union, the same
 * way issue voting is — flagging from outside the union it concerns would
 * make the flag-to-verified-resident ratio meaningless.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;
    const { id } = await context.params;

    const unionId = guard.session.profile?.residencyUnionId;
    if (!unionId) {
      return fail(ERROR_CODES.FORBIDDEN, 'Verify which union you live in before flagging an allocation.', {
        status: 403,
        details: { requires: 'residency_verification' },
      });
    }

    const [allocation] = await db.select({ unionId: budgetAllocations.unionId }).from(budgetAllocations).where(eq(budgetAllocations.id, id)).limit(1);
    if (!allocation) return fail(ERROR_CODES.NOT_FOUND, 'That allocation could not be found.');
    if (allocation.unionId !== unionId) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only residents of this union can flag its allocations.');
    }

    const body = flagAllocationSchema.parse(await readJson(request));
    const result = await flagAllocation(id, guard.session.userId, body.reason);
    if (!result) return fail(ERROR_CODES.NOT_FOUND, 'That allocation could not be found.');

    return ok(result);
  }, 'budget/allocations/[id]/flag:post');
}

export const dynamic = 'force-dynamic';
