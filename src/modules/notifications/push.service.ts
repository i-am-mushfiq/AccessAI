import webpush from 'web-push';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { pushSubscriptions, userSettings, users } from '@/lib/db/schema';
import type { NotificationType } from '@/lib/domain/enums';
import { env } from '@/lib/config/env';

let vapidConfigured = false;

export function isWebPushConfigured(): boolean {
  return Boolean(env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY);
}

function configureVapid(): boolean {
  if (!isWebPushConfigured()) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(env.WEB_PUSH_SUBJECT, env.WEB_PUSH_PUBLIC_KEY!, env.WEB_PUSH_PRIVATE_KEY!);
    vapidConfigured = true;
  }
  return true;
}

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: pushSubscriptions.id });
  return row!;
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<boolean> {
  const deleted = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return deleted.length > 0;
}

export function isPushEligibleNotificationType(type: NotificationType): boolean {
  return type === 'deadline_reminder' || type === 'timeline_reminder';
}

function shouldSendForPreference(type: NotificationType, settings: typeof userSettings.$inferSelect | null): boolean {
  // Initial Web Push scope is deliberately narrow. Other notification types
  // remain durable in-app notifications and are never promoted to push here.
  if (!isPushEligibleNotificationType(type)) return false;
  if (settings?.notifyPush === false) return false;
  if (!settings) return true;
  if (type === 'deadline_reminder') return settings.notifyDeadlines;
  return true;
}

export function safeInternalActionUrl(actionUrl: string | null | undefined, locale: 'bn' | 'en'): string {
  const fallback = `/${locale}/notifications`;
  if (!actionUrl || !actionUrl.startsWith('/') || actionUrl.startsWith('//')) return fallback;
  try {
    const url = new URL(actionUrl, 'https://accessai.invalid');
    if (url.origin !== 'https://accessai.invalid') return fallback;
    if (/^\/opportunities\/[^/]+$/.test(url.pathname)) return `/${locale}${url.pathname}`;
    if (/^\/(?:bn|en)\/opportunities\/[^/]+$/.test(url.pathname)) return `${url.pathname}`;
    if (/^\/timeline$/.test(url.pathname)) return `/${locale}${url.pathname}${url.search}`;
    if (/^\/(?:bn|en)\/timeline$/.test(url.pathname)) return `${url.pathname}${url.search}`;
    if (/^\/notifications$/.test(url.pathname)) return `/${locale}${url.pathname}${url.search}`;
    if (/^\/(?:bn|en)\/notifications$/.test(url.pathname)) return `${url.pathname}${url.search}`;
    return fallback;
  } catch {
    return fallback;
  }
}

function isExpiredSubscription(error: unknown): boolean {
  const statusCode = (error as { statusCode?: number } | null)?.statusCode;
  return statusCode === 404 || statusCode === 410;
}

/**
 * Sends an optional browser notification. This is deliberately best-effort:
 * in-app persistence is the source of truth and must never fail because a
 * browser token expired or VAPID has not been configured yet.
 */
export async function sendPushNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  titleBn: string;
  body: string;
  bodyBn: string;
  actionUrl?: string | null;
}): Promise<number> {
  if (!configureVapid()) return 0;

  const [recipient] = await db
    .select({ language: users.language, settings: userSettings })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!recipient || !shouldSendForPreference(input.type, recipient.settings)) return 0;

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, input.userId));
  if (subscriptions.length === 0) return 0;

  const isBangla = recipient.language === 'bn';
  const payload = JSON.stringify({
    title: isBangla ? input.titleBn : input.title,
    body: isBangla ? input.bodyBn : input.body,
    actionUrl: safeInternalActionUrl(input.actionUrl, isBangla ? 'bn' : 'en'),
    tag: `accessai-${input.type}`,
  });

  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        { TTL: 60 * 60 * 24 },
      );
      sent += 1;
    } catch (error) {
      if (isExpiredSubscription(error)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
      } else {
        // Do not log payloads or subscription keys. A failed optional channel
        // must not expose notification content or browser credentials.
        // eslint-disable-next-line no-console
        console.error('[push] delivery failed', error instanceof Error ? error.message : 'unknown error');
      }
    }
  }
  return sent;
}
