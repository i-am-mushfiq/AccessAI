import type { NextRequest } from 'next/server';
import { ok, fail, ERROR_CODES, readJson, handle } from '@/lib/http/response';
import { requireFullSession, requireStaff } from '@/lib/http/session';
import { updateIssueStatusSchema } from '@/lib/validation/schemas';
import { getIssue, transitionIssueStatus } from '@/modules/issues/issue.service';
import { recordAudit } from '@/modules/admin/admin.service';

/**
 * GET   /api/v1/issues/:id — detail, with status history
 * PATCH /api/v1/issues/:id — staff-only status update, with evidence
 *       (BRD "Union officials can update issue/fund status with evidence").
 *       Deciding submitted→verified/rejected happens in /admin/moderation
 *       instead, alongside every other content-review decision; this route
 *       covers every OTHER transition — verified→in_progress, →completed,
 *       and →archived from any resolved state.
 */

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;
    const { id } = await context.params;

    const result = await getIssue(id, guard.session.userId);
    if (!result) return fail(ERROR_CODES.NOT_FOUND, 'That report could not be found.');

    return ok(result);
  }, 'issues/[id]:get');
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;
    const { id } = await context.params;

    const body = updateIssueStatusSchema.parse(await readJson(request));
    const result = await transitionIssueStatus({
      issueId: id,
      toStatus: body.status,
      actorId: guard.session.userId,
      note: body.note,
      resolutionPhotoUrl: body.resolutionPhotoUrl,
    });

    if (!result.ok) return fail(ERROR_CODES.VALIDATION_FAILED, result.reason ?? 'That status change is not allowed.');

    await recordAudit({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: `issue.${body.status}`,
      entityType: 'issue',
      entityId: id,
      after: { status: body.status, note: body.note ?? null },
    });

    return ok({ issue: result.issue });
  }, 'issues/[id]:patch');
}

export const dynamic = 'force-dynamic';
