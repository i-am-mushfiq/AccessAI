import { desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { demoSmsOutbox } from '@/lib/db/schema';
import { env } from '@/lib/config/env';

/**
 * SJ-23/48 — real provider clients behind the seam `auth.service.ts` already
 * had. All three shapes are exactly as documented in docs/EXTERNAL.md §SMS,
 * which was written from each provider's own API reference. Unset
 * `SMS_PROVIDER`/`SMS_API_KEY` still throws rather than pretending to send
 * (unchanged); naming a provider now actually dispatches to it instead of
 * throwing "not implemented".
 *
 * `SMS_PROVIDER=demo` is a fourth, deliberate option: it needs no API key,
 * "sends" by logging the message to the server console labelled
 * `[SMS:DEMO]` AND recording it in `demo_sms_outbox` (staff-visible at
 * /admin/sms-outbox, so a live demo has something to point at that looks
 * like "the phone received a text" instead of a server log nobody in the
 * room can see) — and always succeeds. It is never returned as, or
 * recorded to look like, a real network delivery.
 */

export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SmsDeliveryError';
  }
}

async function sendViaSslWireless(phone: string, text: string): Promise<void> {
  if (!env.SMS_SID) {
    throw new SmsDeliveryError('SSL Wireless requires SMS_SID in addition to SMS_API_KEY.');
  }
  const response = await fetch('https://smsplus.sslwireless.com/api/v3/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_token: env.SMS_API_KEY,
      sid: env.SMS_SID,
      msisdn: phone,
      sms: text,
      csms_id: `${Date.now()}`,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { status?: string; error_message?: string };
  if (!response.ok || body.status !== 'SUCCESS') {
    throw new SmsDeliveryError(`SSL Wireless rejected the message: ${body.error_message ?? response.statusText}`, { phone, body });
  }
}

async function sendViaBulkSmsBd(phone: string, text: string): Promise<void> {
  const url = new URL('http://bulksmsbd.net/api/smsapi');
  url.searchParams.set('api_key', env.SMS_API_KEY!);
  url.searchParams.set('senderid', env.SMS_SENDER_ID ?? '');
  url.searchParams.set('number', phone);
  url.searchParams.set('message', text);

  const response = await fetch(url, { method: 'GET' });
  const body = await response.text();
  // BulkSMSBD returns a numeric response_code as plain text (1002 = success);
  // anything else, including non-numeric error text, is a failure.
  if (!response.ok || body.trim() !== '1002') {
    throw new SmsDeliveryError(`BulkSMSBD rejected the message (response: ${body.trim()}).`, { phone });
  }
}

async function sendViaTwilio(phone: string, text: string): Promise<void> {
  if (!env.SMS_SID) {
    throw new SmsDeliveryError('Twilio requires SMS_SID (the Account SID) in addition to SMS_API_KEY (the auth token).');
  }
  const auth = Buffer.from(`${env.SMS_SID}:${env.SMS_API_KEY}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.SMS_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: phone, From: env.SMS_SENDER_ID ?? '', Body: text }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new SmsDeliveryError(`Twilio rejected the message (${response.status}): ${body}`, { phone });
  }
}

async function sendViaDemo(phone: string, text: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    `\n[SMS:DEMO] → ${phone}\n${text}\n(SMS_PROVIDER=demo — no real message was sent. Set a real provider + SMS_API_KEY to deliver one.)\n`,
  );
  await db.insert(demoSmsOutbox).values({ phone, body: text });
}

/** Staff-visible record of everything `SMS_PROVIDER=demo` has "sent" — see /admin/sms-outbox. */
export async function listDemoSmsOutbox(limit = 50) {
  return db.select().from(demoSmsOutbox).orderBy(desc(demoSmsOutbox.createdAt)).limit(limit);
}

const PROVIDERS: Record<string, (phone: string, text: string) => Promise<void>> = {
  ssl_wireless: sendViaSslWireless,
  bulksmsbd: sendViaBulkSmsBd,
  twilio: sendViaTwilio,
  demo: sendViaDemo,
};

/**
 * Dispatches a text message through whichever provider `SMS_PROVIDER` names.
 * Throws `SmsDeliveryError` on any failure — a citizen waiting for an OTP or
 * a status update that silently never arrived is the one failure mode this
 * module must never produce quietly. The one exception by design is
 * `demo`, which needs no `SMS_API_KEY` at all — see the module doc comment.
 */
export async function dispatchSms(phone: string, text: string): Promise<void> {
  if (env.SMS_PROVIDER === 'demo') {
    await sendViaDemo(phone, text);
    return;
  }
  if (!env.SMS_PROVIDER || !env.SMS_API_KEY) {
    throw new SmsDeliveryError('SMS delivery is not configured on this server.', {
      hint: 'Set SMS_PROVIDER and SMS_API_KEY, set SMS_PROVIDER=demo for a demo, or enable OTP_DEV_ECHO for development.',
    });
  }
  const send = PROVIDERS[env.SMS_PROVIDER];
  if (!send) {
    throw new SmsDeliveryError(`Unknown SMS_PROVIDER "${env.SMS_PROVIDER}". Supported: ${Object.keys(PROVIDERS).join(', ')}.`);
  }
  await send(phone, text);
}
