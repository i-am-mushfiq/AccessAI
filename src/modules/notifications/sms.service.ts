import { env } from '@/lib/config/env';

/**
 * SJ-23/48 — real provider clients behind the seam `auth.service.ts` already
 * had. All three shapes are exactly as documented in docs/EXTERNAL.md §SMS,
 * which was written from each provider's own API reference. Unset
 * `SMS_PROVIDER`/`SMS_API_KEY` still throws rather than pretending to send
 * (unchanged); naming a provider now actually dispatches to it instead of
 * throwing "not implemented".
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

const PROVIDERS: Record<string, (phone: string, text: string) => Promise<void>> = {
  ssl_wireless: sendViaSslWireless,
  bulksmsbd: sendViaBulkSmsBd,
  twilio: sendViaTwilio,
};

/**
 * Dispatches a text message through whichever provider `SMS_PROVIDER` names.
 * Throws `SmsDeliveryError` on any failure — a citizen waiting for an OTP or
 * a status update that silently never arrived is the one failure mode this
 * module must never produce quietly.
 */
export async function dispatchSms(phone: string, text: string): Promise<void> {
  if (!env.SMS_PROVIDER || !env.SMS_API_KEY) {
    throw new SmsDeliveryError('SMS delivery is not configured on this server.', {
      hint: 'Set SMS_PROVIDER and SMS_API_KEY, or enable OTP_DEV_ECHO for development.',
    });
  }
  const send = PROVIDERS[env.SMS_PROVIDER];
  if (!send) {
    throw new SmsDeliveryError(`Unknown SMS_PROVIDER "${env.SMS_PROVIDER}". Supported: ${Object.keys(PROVIDERS).join(', ')}.`);
  }
  await send(phone, text);
}
