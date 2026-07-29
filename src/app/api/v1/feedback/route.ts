import type { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { feedback } from '@/lib/db/schema';
import { ok, readJson, handle } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { guardRateLimit } from '@/lib/http/rate-limit';
import { feedbackSchema } from '@/lib/validation/schemas';

/**
 * POST /api/v1/feedback — PRD §34.
 *
 * Feedback is stored with status `new` and NEVER acts on the knowledge base.
 * PRD §34 is explicit: "it must not automatically change eligibility rules.
 * Administrative review is required." A citizen reporting that a rule is wrong
 * therefore creates a review item for a moderator, not an edit.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const limited = await guardRateLimit(request, 'default', guard.session.userId);
    if (!limited.ok) return limited.response;

    const body = feedbackSchema.parse(await readJson(request));

    const [row] = await db
      .insert(feedback)
      .values({
        userId: guard.session.userId,
        messageId: body.messageId ?? null,
        opportunityId: body.opportunityId ?? null,
        kind: body.kind,
        rating: body.rating ?? null,
        comment: body.comment ?? null,
        status: 'new',
      })
      .returning();

    return ok(
      {
        feedback: row,
        // Told plainly, so the citizen knows a human will look rather than
        // expecting the answer to change immediately.
        willBeReviewed: body.kind === 'incorrect_information' || body.kind === 'missing_opportunity',
      },
      { status: 201 },
    );
  }, 'feedback:post');
}

export const dynamic = 'force-dynamic';
