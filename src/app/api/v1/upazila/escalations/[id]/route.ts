import type { NextRequest } from 'next/server';
import { ok, fail, ERROR_CODES, readJson, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { resolveEscalationSchema } from '@/lib/validation/schemas';
import { resolveEscalation } from '@/modules/budget/escalation.service';

/** PATCH /api/v1/upazila/escalations/:id — acknowledge, resolve, or dismiss; claims an unassigned one. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;
    const { id } = await context.params;

    if (guard.session.user.civicRole !== 'upazila_officer') {
      return fail(ERROR_CODES.FORBIDDEN, 'Only an upazila officer can act on an escalation.');
    }

    const body = resolveEscalationSchema.parse(await readJson(request));
    const result = await resolveEscalation(id, guard.session.userId, body.status, body.note);
    if (!result) return fail(ERROR_CODES.NOT_FOUND, 'That escalation could not be found.');
    if ('forbidden' in result) return fail(ERROR_CODES.FORBIDDEN, 'This escalation was routed to a different officer.');

    return ok({ escalation: result });
  }, 'upazila/escalations/[id]:patch');
}

export const dynamic = 'force-dynamic';
