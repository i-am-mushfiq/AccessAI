import type { NextRequest } from 'next/server';
import { ok, fail, ERROR_CODES, readJson, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { enrollBeneficiarySchema } from '@/lib/validation/schemas';
import { enrollBeneficiary, listBeneficiariesForUnion } from '@/modules/entitlements/entitlement.service';
import { isUnionOfficialOf } from '@/modules/civic/roles';

/**
 * GET  /api/v1/beneficiaries — a union official's own union's roll
 * POST /api/v1/beneficiaries — enrol a beneficiary for real disbursement tracking
 *
 * Chairman/union-staff authorised, not platform staff — deliberately not
 * under /admin, since a chairman is ordinarily a plain `citizen` platform
 * role holding a civic title, not moderator/administrator.
 */

export async function GET() {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const unionId = guard.session.user.civicUnionId;
    if (!unionId || !isUnionOfficialOf(guard.session.user, unionId)) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only a union chairman or union office staff can view the beneficiary roll.');
    }

    const items = await listBeneficiariesForUnion(unionId);
    return ok({ items, unionId });
  }, 'beneficiaries:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const unionId = guard.session.user.civicUnionId;
    if (!unionId || !isUnionOfficialOf(guard.session.user, unionId)) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only a union chairman or union office staff can enrol a beneficiary.');
    }

    const body = enrollBeneficiarySchema.parse(await readJson(request));
    const result = await enrollBeneficiary({
      nidNumber: body.nidNumber,
      unionId,
      programCode: body.programCode,
      programName: body.programName,
      programNameBn: body.programNameBn,
      enrolledBy: guard.session.userId,
      amount: body.amount,
      period: body.period,
    });

    return ok(result, { status: 201 });
  }, 'beneficiaries:post');
}

export const dynamic = 'force-dynamic';
