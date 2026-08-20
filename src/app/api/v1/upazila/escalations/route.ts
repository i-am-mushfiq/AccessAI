import { ok, fail, ERROR_CODES, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { listEscalationsForOfficer, listUnassignedEscalations } from '@/modules/budget/escalation.service';

/** GET /api/v1/upazila/escalations — SJ-18: what actually reached this officer. */
export async function GET() {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    if (guard.session.user.civicRole !== 'upazila_officer') {
      return fail(ERROR_CODES.FORBIDDEN, 'Only an upazila officer can view escalations.');
    }

    const [mine, unassigned] = await Promise.all([
      listEscalationsForOfficer(guard.session.userId),
      listUnassignedEscalations(),
    ]);

    return ok({ mine, unassigned });
  }, 'upazila/escalations:get');
}

export const dynamic = 'force-dynamic';
