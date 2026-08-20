import { ok, fail, ERROR_CODES, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { getBeneficiaryDetail } from '@/modules/entitlements/entitlement.service';
import { isUnionOfficialOf } from '@/modules/civic/roles';

/** GET /api/v1/beneficiaries/:id — one beneficiary's entitlements and disbursements, for the enrolling union's own officials. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;
    const { id } = await context.params;

    const detail = await getBeneficiaryDetail(id);
    if (!detail) return fail(ERROR_CODES.NOT_FOUND, 'That beneficiary could not be found.');
    if (!isUnionOfficialOf(guard.session.user, detail.unionId)) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only that union’s chairman or office staff can view this record.');
    }

    return ok(detail);
  }, 'beneficiaries/[id]:get');
}

export const dynamic = 'force-dynamic';
