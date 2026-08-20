import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { readJson, fail, ERROR_CODES } from '@/lib/http/response';
import { env } from '@/lib/config/env';
import { normalisePhone } from '@/lib/format/numerals';
import { handleUssdCallback } from '@/modules/ussd/ussd.service';

/**
 * POST /api/v1/ussd/callback — SJ-23/48.
 *
 * Body contract: `{ sessionId, phoneNumber, text }`, the same three fields
 * (under those or near-identical names) every mainstream USSD aggregator's
 * callback carries — Africa's Talking's own field names verbatim. A real BD
 * aggregator contract may use different field names or form-encoding rather
 * than JSON; adapting this route to the actual vendor is the integration
 * step, same as pointing `STT_BASE_URL` at a real speech vendor.
 *
 * Authenticated by a shared secret header (`X-Ussd-Secret`), not a session —
 * the caller is a telecom aggregator's server, not a logged-in browser.
 * Unlike every other route in this app, the RESPONSE BODY is plain text, not
 * the JSON envelope: `CON <text>` to keep the session open and wait for more
 * input, `END <text>` to close it — the literal wire format USSD aggregators
 * expect back.
 */

const bodySchema = z.object({
  sessionId: z.string().min(1),
  phoneNumber: z.string().min(1),
  text: z.string().default(''),
});

export async function POST(request: NextRequest) {
  if (!env.USSD_GATEWAY_SECRET) {
    return fail(ERROR_CODES.INTERNAL, 'USSD gateway is not configured on this server (set USSD_GATEWAY_SECRET).');
  }
  if (request.headers.get('x-ussd-secret') !== env.USSD_GATEWAY_SECRET) {
    return fail(ERROR_CODES.FORBIDDEN, 'Invalid USSD gateway secret.');
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await readJson(request));
  } catch {
    return new NextResponse('END Malformed request.', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  const phone = normalisePhone(body.phoneNumber) ?? body.phoneNumber;
  const result = await handleUssdCallback({ sessionId: body.sessionId, phone, text: body.text });

  return new NextResponse(`${result.kind} ${result.text}`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export const dynamic = 'force-dynamic';
