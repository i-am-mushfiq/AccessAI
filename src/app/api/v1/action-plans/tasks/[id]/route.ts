import type { NextRequest } from 'next/server';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { updateTaskSchema } from '@/lib/validation/schemas';
import { updateTask } from '@/modules/citizen/citizen.service';

/** PATCH /api/v1/action-plans/tasks/:id — tick off or reschedule a task. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const body = updateTaskSchema.parse(await readJson(request));

    const updated = await updateTask({
      userId: guard.session.userId,
      taskId: id,
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
    });

    if (!updated) return fail(ERROR_CODES.NOT_FOUND, 'That task could not be found.');
    return ok({ task: updated });
  }, 'action-plans/tasks/[id]:patch');
}

export const dynamic = 'force-dynamic';
