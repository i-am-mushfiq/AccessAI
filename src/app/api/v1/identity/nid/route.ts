import type { NextRequest } from 'next/server';
import { ok, readJson, handle } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { guardRateLimit } from '@/lib/http/rate-limit';
import { verifyNidSchema } from '@/lib/validation/schemas';
import { submitNidVerification } from '@/modules/identity/identity.service';

/**
 * POST /api/v1/identity/nid — Phase 1.
 *
 * Rate-limited on the `auth` scope: an NID number is exactly the kind of
 * guessable-by-brute-force input the tight auth quota exists for.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const limited = await guardRateLimit(request, 'auth', guard.session.userId);
    if (!limited.ok) return limited.response;

    const body = verifyNidSchema.parse(await readJson(request));
    const result = await submitNidVerification(guard.session.userId, body.nidNumber);

    return ok(result);
  }, 'identity/nid:post');
}

export const dynamic = 'force-dynamic';
