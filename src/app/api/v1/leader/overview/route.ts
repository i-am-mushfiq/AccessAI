import { ok, fail, ERROR_CODES, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { getLeaderPortalData, type OversightScope } from '@/modules/oversight/oversight.service';

/**
 * GET /api/v1/leader/overview — SJ-25/29.
 *
 * Scope comes ENTIRELY from the caller's own civic role, exactly like the
 * escalation queue and civic role checks elsewhere in Phase 3 — never from a
 * query parameter, which would let any citizen ask for any union's numbers.
 * A chairman/union staff member sees their one union; an upazila or zila
 * officer sees the rollup across every union under them (SJ-29).
 */
export async function GET() {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;
    const { user } = guard.session;

    let scope: OversightScope | null = null;
    if ((user.civicRole === 'union_chairman' || user.civicRole === 'union_staff') && user.civicUnionId) {
      scope = { kind: 'union', unionId: user.civicUnionId };
    } else if (user.civicRole === 'upazila_officer' && user.civicUpazila) {
      scope = { kind: 'upazila', upazila: user.civicUpazila };
    } else if (user.civicRole === 'zila_officer' && user.civicDistrict) {
      scope = { kind: 'district', district: user.civicDistrict };
    }

    if (!scope) {
      return fail(ERROR_CODES.FORBIDDEN, 'This portal is for union chairmen, union staff, and upazila/zila officers.');
    }

    const data = await getLeaderPortalData(scope);
    return ok({ scope, ...data });
  }, 'leader/overview:get');
}

export const dynamic = 'force-dynamic';
