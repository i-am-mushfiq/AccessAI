import type { NextRequest } from 'next/server';
import { desc, eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { feedback, knowledgeReviews, users, opportunities, aiLogs, messages } from '@/lib/db/schema';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireStaff, canApproveChanges } from '@/lib/http/session';
import { recordAudit } from '@/modules/admin/admin.service';

const decisionSchema = z.object({
  kind: z.enum(['feedback', 'review']),
  id: z.string().uuid(),
  status: z.string(),
  note: z.string().trim().max(1000).nullish(),
});

/**
 * GET   /api/v1/admin/moderation — the review queue
 * PATCH /api/v1/admin/moderation — decide one item
 *
 * This is the human gate PRD §34 requires: citizen feedback and proposed
 * knowledge changes both land here, and nothing reaches the corpus without a
 * decision recorded against a named reviewer.
 */

export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const status = new URL(request.url).searchParams.get('status') ?? 'new';

    const [pendingFeedback, pendingReviews, counts] = await Promise.all([
      db
        .select({
          feedback,
          reporterName: users.name,
          opportunityTitle: opportunities.title,
          opportunitySlug: opportunities.slug,
          messageContent: messages.content,
        })
        .from(feedback)
        .leftJoin(users, eq(feedback.userId, users.id))
        .leftJoin(opportunities, eq(feedback.opportunityId, opportunities.id))
        .leftJoin(messages, eq(feedback.messageId, messages.id))
        .where(status === 'all' ? undefined : eq(feedback.status, status as never))
        .orderBy(desc(feedback.createdAt))
        .limit(100),
      db
        .select()
        .from(knowledgeReviews)
        .where(status === 'all' ? undefined : eq(knowledgeReviews.status, 'pending'))
        .orderBy(desc(knowledgeReviews.createdAt))
        .limit(100),
      db.select({ status: feedback.status, n: sql<number>`count(*)` }).from(feedback).groupBy(feedback.status),
    ]);

    // Grounding failures are surfaced here too: a recommendation with no
    // citation is a defect a moderator should see, not just a metric.
    const groundingFailures = await db
      .select({
        id: aiLogs.id,
        createdAt: aiLogs.createdAt,
        inputSummary: aiLogs.inputSummary,
        outputSummary: aiLogs.outputSummary,
        engine: aiLogs.engine,
      })
      .from(aiLogs)
      .where(eq(aiLogs.groundingFailure, true))
      .orderBy(desc(aiLogs.createdAt))
      .limit(25);

    return ok({
      feedback: pendingFeedback,
      reviews: pendingReviews,
      groundingFailures,
      counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
    });
  }, 'admin/moderation:get');
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const body = decisionSchema.parse(await readJson(request));

    if (body.kind === 'feedback') {
      const allowed = ['new', 'reviewed', 'actioned', 'dismissed'];
      if (!allowed.includes(body.status)) {
        return fail(ERROR_CODES.VALIDATION_FAILED, 'Unknown feedback status.');
      }
      const [updated] = await db
        .update(feedback)
        .set({
          status: body.status as never,
          reviewedBy: guard.session.userId,
          reviewedAt: new Date(),
          reviewerNote: body.note ?? null,
        })
        .where(eq(feedback.id, body.id))
        .returning();
      if (!updated) return fail(ERROR_CODES.NOT_FOUND, 'That feedback item could not be found.');

      await recordAudit({
        actorId: guard.session.userId,
        actorRole: guard.session.role,
        action: `feedback.${body.status}`,
        entityType: 'feedback',
        entityId: body.id,
        after: { status: body.status, note: body.note ?? null },
      });
      return ok({ feedback: updated });
    }

    // Approving a knowledge change alters what citizens are told, so it needs
    // administrator rank — a moderator can triage but not publish.
    if (!canApproveChanges(guard.session.role)) {
      return fail(ERROR_CODES.FORBIDDEN, 'Only an administrator can approve a knowledge change.');
    }
    if (!['approved', 'rejected'].includes(body.status)) {
      return fail(ERROR_CODES.VALIDATION_FAILED, 'A review must be approved or rejected.');
    }

    const [review] = await db
      .update(knowledgeReviews)
      .set({
        status: body.status as 'approved' | 'rejected',
        reviewerId: guard.session.userId,
        decidedAt: new Date(),
        note: body.note ?? null,
      })
      .where(and(eq(knowledgeReviews.id, body.id), eq(knowledgeReviews.status, 'pending')))
      .returning();

    if (!review) return fail(ERROR_CODES.NOT_FOUND, 'That review could not be found, or it is already decided.');

    // Apply the patch only on approval, and only to the entity it named.
    if (review.status === 'approved' && review.proposedPatch && review.entityType === 'opportunity') {
      await db
        .update(opportunities)
        .set({ ...(review.proposedPatch as Record<string, never>), updatedAt: new Date() })
        .where(eq(opportunities.id, review.entityId));
    }

    await recordAudit({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: `review.${body.status}`,
      entityType: review.entityType,
      entityId: review.entityId,
      after: { reviewId: review.id, status: body.status },
    });

    return ok({ review });
  }, 'admin/moderation:patch');
}

export const dynamic = 'force-dynamic';
