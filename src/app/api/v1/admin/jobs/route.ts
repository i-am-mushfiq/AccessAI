import type { NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { jobRuns } from '@/lib/db/schema';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireStaff } from '@/lib/http/session';
import { JOBS, recordAudit, type JobName } from '@/modules/admin/admin.service';

const runSchema = z.object({
  job: z.enum(['reindex_search', 'rebuild_embeddings', 'detect_staleness', 'scheduled_notifications', 'aggregate_analytics']),
});

/**
 * GET  /api/v1/admin/jobs — run history
 * POST /api/v1/admin/jobs — run one now
 *
 * PRD §64 exposes "reindex" and "rebuild-embeddings" as admin actions. They are
 * grouped here with the other scheduled jobs so an operator has one place to
 * run and inspect all of them, and so a scheduler can call the same endpoint.
 */

export async function GET() {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const runs = await db.select().from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(50);
    return ok({
      runs,
      available: Object.keys(JOBS).map((name) => ({
        name,
        description: JOB_DESCRIPTIONS[name as JobName],
      })),
    });
  }, 'admin/jobs:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const body = runSchema.parse(await readJson(request));
    const job = JOBS[body.job];
    if (!job) return fail(ERROR_CODES.VALIDATION_FAILED, 'Unknown job.');

    const result = await job();

    await recordAudit({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: `job.run.${body.job}`,
      entityType: 'job_run',
      entityId: result.jobId,
      after: result as unknown as Record<string, unknown>,
    });

    return ok({ job: body.job, result });
  }, 'admin/jobs:post');
}

const JOB_DESCRIPTIONS: Record<JobName, string> = {
  reindex_search:
    'Recomputes the lexical search index for every chunk. Run after editing programme text.',
  rebuild_embeddings:
    'Generates vector embeddings for chunks that lack them. Does nothing unless an embedding provider is configured.',
  detect_staleness:
    'Flags verified records past their review interval as outdated, and closes programmes whose deadline has passed.',
  scheduled_notifications:
    'Creates deadline reminders for every citizen with a saved programme closing within seven days.',
  aggregate_analytics: 'Writes today\'s analytics rollup.',
};

export const dynamic = 'force-dynamic';
