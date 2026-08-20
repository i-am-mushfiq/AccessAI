import { ok, fail, ERROR_CODES, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { getDonorPortalData } from '@/modules/oversight/oversight.service';

/** GET /api/v1/donor/overview — SJ-27. `donorOrgId` comes only from the session, never a query parameter. */
export async function GET() {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    if (!guard.session.user.donorOrgId) {
      return fail(ERROR_CODES.FORBIDDEN, 'This portal is for donor representatives only.');
    }

    const data = await getDonorPortalData(guard.session.user.donorOrgId);
    return ok(data);
  }, 'donor/overview:get');
}

export const dynamic = 'force-dynamic';
