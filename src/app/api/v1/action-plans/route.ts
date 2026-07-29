import type { NextRequest } from 'next/server';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { createActionPlanSchema } from '@/lib/validation/schemas';
import { listActionPlans, generateActionPlan } from '@/modules/citizen/citizen.service';

/**
 * GET  /api/v1/action-plans
 * POST /api/v1/action-plans — generate a plan from a programme's own steps
 */

export async function GET() {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;
    const plans = await listActionPlans(guard.session.userId);
    return ok({ plans }, { meta: { total: plans.length } });
  }, 'action-plans:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const body = createActionPlanSchema.parse(await readJson(request));
    const result = await generateActionPlan(guard.session.userId, body.opportunityId);

    if (!result) return fail(ERROR_CODES.NOT_FOUND, 'That programme could not be found.');

    return ok(
      { plan: result.plan, tasks: result.tasks, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  }, 'action-plans:post');
}

export const dynamic = 'force-dynamic';
