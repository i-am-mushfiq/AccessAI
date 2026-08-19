import type { NextRequest } from 'next/server';
import { ok, fail, ERROR_CODES, readJson, handle } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { guardRateLimit } from '@/lib/http/rate-limit';
import { parseQuery, listIssuesQuerySchema, submitIssueSchema } from '@/lib/validation/schemas';
import { submitIssue, listUnionFeed, listMyIssues } from '@/modules/issues/issue.service';

/**
 * GET  /api/v1/issues — the citizen's own union feed, or their own reports
 *      with `?mine=true`. Always scoped to the citizen's OWN verified union —
 *      never an arbitrary one from the query string (KB §5: "union-scoped").
 * POST /api/v1/issues — report a problem. Requires a verified residency
 *      (Phase 1) — there is no union to scope the report to otherwise.
 */

export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const query = parseQuery(listIssuesQuerySchema, new URL(request.url));

    if (query.mine) {
      const items = await listMyIssues(guard.session.userId, query.limit);
      return ok({ items, scope: 'mine' as const });
    }

    const unionId = guard.session.profile?.residencyUnionId;
    if (!unionId) {
      return fail(
        ERROR_CODES.FORBIDDEN,
        'Verify which union you live in before viewing local reports.',
        { status: 403, details: { requires: 'residency_verification' } },
      );
    }

    const items = await listUnionFeed(unionId, { sort: query.sort, limit: query.limit });
    return ok({ items, scope: 'union' as const, unionId });
  }, 'issues:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const limited = await guardRateLimit(request, 'default', guard.session.userId);
    if (!limited.ok) return limited.response;

    const unionId = guard.session.profile?.residencyUnionId;
    if (!unionId) {
      return fail(
        ERROR_CODES.FORBIDDEN,
        'Verify which union you live in before reporting a problem.',
        { status: 403, details: { requires: 'residency_verification' } },
      );
    }

    const body = submitIssueSchema.parse(await readJson(request));
    const issue = await submitIssue({
      reporterId: guard.session.userId,
      unionId,
      category: body.category,
      title: body.title,
      description: body.description,
      lat: body.lat,
      lng: body.lng,
      photoDataUrl: body.photoDataUrl,
    });

    return ok({ issue }, { status: 201 });
  }, 'issues:post');
}

export const dynamic = 'force-dynamic';
