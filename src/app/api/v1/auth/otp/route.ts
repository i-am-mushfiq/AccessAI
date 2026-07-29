import type { NextRequest } from 'next/server';
import { ok, readJson, handle } from '@/lib/http/response';
import { guardRateLimit } from '@/lib/http/rate-limit';
import { rethrowUnlessAuth } from '@/lib/http/auth-errors';
import { requestOtpSchema } from '@/lib/validation/schemas';
import { requestOtp } from '@/modules/auth/auth.service';

/** POST /api/v1/auth/otp — issue a one-time code by SMS. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const limited = await guardRateLimit(request, 'auth');
    if (!limited.ok) return limited.response;

    const body = requestOtpSchema.parse(await readJson(request));

    try {
      const result = await requestOtp(body.phone, body.purpose);
      return ok({
        sent: true,
        expiresAt: result.expiresAt.toISOString(),
        resendAfterMs: result.resendAfterMs,
        // Present only when OTP_DEV_ECHO is enabled. The UI renders it behind an
        // explicit "development only" label, never as ordinary copy.
        ...(result.devCode ? { devCode: result.devCode } : {}),
      });
    } catch (error) {
      return rethrowUnlessAuth(error);
    }
  }, 'auth/otp');
}

export const dynamic = 'force-dynamic';
