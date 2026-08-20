import type { NextRequest } from 'next/server';
import { ok, fail, ERROR_CODES, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { getAllocation } from '@/modules/budget/budget.service';

/** GET /api/v1/budget/allocations/:id — detail, ledger anchor(s), and the current flag ratio. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;
    const { id } = await context.params;

    const result = await getAllocation(id);
    if (!result) return fail(ERROR_CODES.NOT_FOUND, 'That allocation could not be found.');

    return ok(result);
  }, 'budget/allocations/[id]:get');
}

export const dynamic = 'force-dynamic';
