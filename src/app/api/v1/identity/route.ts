import { ok, handle } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { getIdentityStatus, listUnions } from '@/modules/identity/identity.service';

/**
 * GET /api/v1/identity — a citizen's own NID/residency verification status,
 * plus the union list for the manual-attestation fallback picker.
 */
export async function GET() {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const [status, unions] = await Promise.all([
      getIdentityStatus(guard.session.userId),
      listUnions(),
    ]);

    return ok({
      status,
      unions: unions.map((u) => ({
        id: u.id,
        name: u.name,
        nameBn: u.nameBn,
        upazila: u.upazila,
        district: u.district,
        verificationStatus: u.verificationStatus,
      })),
    });
  }, 'identity:get');
}

export const dynamic = 'force-dynamic';
