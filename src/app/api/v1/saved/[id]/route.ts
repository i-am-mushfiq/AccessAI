import type { NextRequest } from 'next/server';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { updateSavedSchema } from '@/lib/validation/schemas';
import { updateSaved, removeSaved } from '@/modules/citizen/citizen.service';

/**
 * PATCH  /api/v1/saved/:id — move a programme along the tracker
 * DELETE /api/v1/saved/:id — unsave it
 */

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const body = updateSavedSchema.parse(await readJson(request));

    const updated = await updateSaved({
      userId: guard.session.userId,
      savedId: id,
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
    });

    if (!updated) return fail(ERROR_CODES.NOT_FOUND, 'That saved programme could not be found.');
    return ok({ saved: updated });
  }, 'saved/[id]:patch');
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const removed = await removeSaved(guard.session.userId, id);
    if (!removed) return fail(ERROR_CODES.NOT_FOUND, 'That saved programme could not be found.');

    // The client shows an undo toast (BDS §1.1 law 5), so the response carries
    // what is needed to re-create the record if the citizen reverses it.
    return ok({ deleted: true, savedId: id });
  }, 'saved/[id]:delete');
}

export const dynamic = 'force-dynamic';
