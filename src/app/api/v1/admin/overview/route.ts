import { ok, handle } from '@/lib/http/response';
import { requireStaff } from '@/lib/http/session';
import { getAnalytics, getSystemHealth } from '@/modules/admin/admin.service';

/**
 * GET /api/v1/admin/overview — the analytics dashboard and system health
 * (PRD §77, §78, §120) in one request, since they render on one screen.
 */
export async function GET() {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const [analytics, health] = await Promise.all([getAnalytics(), getSystemHealth()]);
    return ok({ analytics, health });
  }, 'admin/overview:get');
}

export const dynamic = 'force-dynamic';
