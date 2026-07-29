import type { NextRequest } from 'next/server';
import { ok, readJson, handle } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { saveSchema } from '@/lib/validation/schemas';
import { listSaved, saveOpportunity, savedCounts } from '@/modules/citizen/citizen.service';
import type { SavedStatus } from '@/lib/domain/enums';

/**
 * GET  /api/v1/saved — the tracker board
 * POST /api/v1/saved — save a programme
 */

export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const status = new URL(request.url).searchParams.get('status') as SavedStatus | null;
    const [items, counts] = await Promise.all([
      listSaved(guard.session.userId, status ?? undefined),
      savedCounts(guard.session.userId),
    ]);

    return ok({ items, counts }, { meta: { total: items.length } });
  }, 'saved:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const body = saveSchema.parse(await readJson(request));
    const result = await saveOpportunity({
      userId: guard.session.userId,
      opportunityId: body.opportunityId,
      status: body.status,
      note: body.note ?? null,
    });

    // 200 rather than 201 when it already existed, so an optimistic UI that
    // fired twice does not show two entries.
    return ok({ saved: result.saved, created: result.created }, { status: result.created ? 201 : 200 });
  }, 'saved:post');
}

export const dynamic = 'force-dynamic';
