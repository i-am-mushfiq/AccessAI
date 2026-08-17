import type { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { userSettings } from '@/lib/db/schema';
import { deletePushSubscriptionSchema, pushSubscriptionSchema } from '@/lib/validation/schemas';
import { handle, ok, readJson } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { isWebPushConfigured, removePushSubscription, savePushSubscription } from '@/modules/notifications/push.service';

/** Register one browser endpoint for the signed-in account. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;
    if (!isWebPushConfigured()) return ok({ enabled: false, configured: false });

    const body = pushSubscriptionSchema.parse(await readJson(request));
    await savePushSubscription({
      userId: guard.session.userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent ?? request.headers.get('user-agent'),
    });

    await db
      .insert(userSettings)
      .values({ userId: guard.session.userId, notifyPush: true })
      .onConflictDoUpdate({ target: userSettings.userId, set: { notifyPush: true, updatedAt: new Date() } });

    return ok({ enabled: true, configured: true });
  }, 'notifications/push:post');
}

/** Remove only this account's endpoint and turn off its push preference. */
export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const body = deletePushSubscriptionSchema.parse(await readJson(request));
    await removePushSubscription(guard.session.userId, body.endpoint);
    await db
      .insert(userSettings)
      .values({ userId: guard.session.userId, notifyPush: false })
      .onConflictDoUpdate({ target: userSettings.userId, set: { notifyPush: false, updatedAt: new Date() } });

    return ok({ enabled: false });
  }, 'notifications/push:delete');
}

export const dynamic = 'force-dynamic';
