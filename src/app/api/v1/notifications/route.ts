import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, handle } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { listNotifications, markNotificationsRead, unreadCount } from '@/modules/citizen/citizen.service';

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
});

/**
 * GET   /api/v1/notifications
 * PATCH /api/v1/notifications — mark specific ids, or all, as read
 */

export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const onlyUnread = new URL(request.url).searchParams.get('unread') === 'true';
    const [items, unread] = await Promise.all([
      listNotifications(guard.session.userId, onlyUnread),
      unreadCount(guard.session.userId),
    ]);

    return ok({ items, unread }, { meta: { total: items.length } });
  }, 'notifications:get');
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const body = markReadSchema.parse(await request.json().catch(() => ({})));
    const marked = await markNotificationsRead(
      guard.session.userId,
      body.all ? undefined : body.ids,
    );

    return ok({ marked, unread: await unreadCount(guard.session.userId) });
  }, 'notifications:patch');
}

export const dynamic = 'force-dynamic';
