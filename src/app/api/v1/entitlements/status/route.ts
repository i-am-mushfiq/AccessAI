import { ok, handle } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { checkMyEntitlementStatus } from '@/modules/entitlements/entitlement.service';

/**
 * GET /api/v1/entitlements/status — SJ-15/BR-2.
 *
 * "What am I already enrolled in, and what has actually been paid" — a
 * real status check against a beneficiary record, matched by the citizen's
 * OWN verified NID hash. Deliberately not the eligibility-discovery engine:
 * see modules/entitlements/entitlement.service.ts.
 */
export async function GET() {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const result = await checkMyEntitlementStatus(guard.session.userId);
    return ok(result);
  }, 'entitlements/status:get');
}

export const dynamic = 'force-dynamic';
