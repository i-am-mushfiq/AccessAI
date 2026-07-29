import type { NextRequest } from 'next/server';
import { ok, handle } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { listTimeline, syncTimelineDeadlines, generateDeadlineReminders } from '@/modules/citizen/citizen.service';
import { startOfMonth, endOfMonth, addDays } from '@/lib/format/dates';

/**
 * GET /api/v1/timeline?month=YYYY-MM
 *
 * Opening the timeline also reconciles it: deadlines for programmes saved before
 * this feature existed are added, and reminders inside the next week are
 * created. Doing that here rather than only in a cron job means the timeline is
 * never stale for a citizen who visits between job runs.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    const scope = url.searchParams.get('scope') ?? 'month';

    await syncTimelineDeadlines(guard.session.userId);
    const remindersCreated = await generateDeadlineReminders(guard.session.userId, 7);

    let from: Date;
    let to: Date;
    if (scope === 'upcoming') {
      from = new Date();
      to = addDays(from, 90);
    } else {
      const base = monthParam ? new Date(`${monthParam}-01T00:00:00`) : new Date();
      const valid = Number.isNaN(base.getTime()) ? new Date() : base;
      from = startOfMonth(valid);
      to = endOfMonth(valid);
    }

    const events = await listTimeline({ userId: guard.session.userId, from, to, limit: 300 });

    return ok(
      { events, range: { from, to } },
      { meta: { total: events.length, remindersCreated } },
    );
  }, 'timeline:get');
}

export const dynamic = 'force-dynamic';
