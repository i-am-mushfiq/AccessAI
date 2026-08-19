import type { NextRequest } from 'next/server';
import { ok, readJson, handle } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { verifyResidencySchema } from '@/lib/validation/schemas';
import { submitResidencyVerification } from '@/modules/identity/identity.service';

/** POST /api/v1/identity/residency — GPS geofence, or a manual union pick. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const body = verifyResidencySchema.parse(await readJson(request));
    const result = await submitResidencyVerification({
      userId: guard.session.userId,
      lat: body.lat,
      lng: body.lng,
      unionId: body.unionId,
    });

    return ok(result);
  }, 'identity/residency:post');
}

export const dynamic = 'force-dynamic';
