import type { NextRequest } from 'next/server';
import { ok, fail, ERROR_CODES, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { toggleVote, getIssue } from '@/modules/issues/issue.service';

/**
 * POST /api/v1/issues/:id/vote — toggle an endorsement.
 *
 * Restricted to residents of the issue's own union, verified the same way
 * posting is: a citizen's own `residencyUnionId`, never a value the request
 * supplies. Voting from outside the union it concerns is exactly the
 * "verified same-union users" restriction the source spec asks for.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;
    const { id } = await context.params;

    const unionId = guard.session.profile?.residencyUnionId;
    if (!unionId) {
      return fail(ERROR_CODES.FORBIDDEN, 'Verify which union you live in before voting.', {
        status: 403,
        details: { requires: 'residency_verification' },
      });
    }

    const detail = await getIssue(id);
    if (!detail) return fail(ERROR_CODES.NOT_FOUND, 'That report could not be found.');
    if (detail.issue.unionId !== unionId) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only residents of this union can vote on this report.');
    }

    const result = await toggleVote(id, guard.session.userId);
    if (!result) return fail(ERROR_CODES.NOT_FOUND, 'That report could not be found.');

    return ok(result);
  }, 'issues/[id]/vote:post');
}

export const dynamic = 'force-dynamic';
