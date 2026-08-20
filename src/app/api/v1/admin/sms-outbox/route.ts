import { ok, handle } from '@/lib/http/response';
import { requireStaff } from '@/lib/http/session';
import { listDemoSmsOutbox } from '@/modules/notifications/sms.service';

/** GET /api/v1/admin/sms-outbox — staff-only view of everything SMS_PROVIDER=demo has "sent". */
export async function GET() {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const items = await listDemoSmsOutbox();
    return ok({ items });
  }, 'admin/sms-outbox:get');
}

export const dynamic = 'force-dynamic';
