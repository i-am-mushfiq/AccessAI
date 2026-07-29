import { ok, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { getConversation, deleteConversation } from '@/modules/ai/conversation.service';

/**
 * GET    /api/v1/chat/:id — full transcript
 * DELETE /api/v1/chat/:id — remove the conversation
 *
 * Both scope by userId inside the service, so a valid id belonging to another
 * citizen returns 404 rather than leaking that it exists.
 */

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const result = await getConversation(guard.session.userId, id);
    if (!result) return fail(ERROR_CODES.NOT_FOUND, 'That conversation could not be found.');

    return ok(result);
  }, 'chat/[id]:get');
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const removed = await deleteConversation(guard.session.userId, id);
    if (!removed) return fail(ERROR_CODES.NOT_FOUND, 'That conversation could not be found.');

    return ok({ deleted: true });
  }, 'chat/[id]:delete');
}

export const dynamic = 'force-dynamic';
