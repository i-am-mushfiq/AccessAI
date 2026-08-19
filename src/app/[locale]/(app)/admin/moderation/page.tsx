import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { feedback, users, opportunities, aiLogs, knowledgeReviews } from '@/lib/db/schema';
import { getFullSession, isStaff, canApproveChanges } from '@/lib/http/session';
import { AdminNav } from '@/components/admin/AdminNav';
import { ModerationQueue } from '@/components/admin/ModerationQueue';
import { listPendingIssues } from '@/modules/issues/issue.service';

/**
 * Review queue — the human gate PRD §34 requires.
 *
 * Citizen feedback, proposed knowledge changes, and grounding failures all land
 * here. Grounding failures are included because a recommendation that cited no
 * source is a defect a person should look at, not merely a number on a chart.
 */
export default async function AdminModerationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');

  const [items, reviews, pendingIssues, groundingFailures] = await Promise.all([
    db
      .select({
        id: feedback.id,
        kind: feedback.kind,
        comment: feedback.comment,
        rating: feedback.rating,
        status: feedback.status,
        createdAt: feedback.createdAt,
        reporterName: users.name,
        opportunityTitle: opportunities.title,
        opportunitySlug: opportunities.slug,
      })
      .from(feedback)
      .leftJoin(users, eq(feedback.userId, users.id))
      .leftJoin(opportunities, eq(feedback.opportunityId, opportunities.id))
      .orderBy(desc(feedback.createdAt))
      .limit(100),
    db.select().from(knowledgeReviews).orderBy(desc(knowledgeReviews.createdAt)).limit(50),
    listPendingIssues(100),
    db
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
      .limit(25),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('moderation')}</h1>
      </header>

      <AdminNav />

      <ModerationQueue
        feedbackItems={items.map((item) => ({
          id: item.id,
          kind: item.kind,
          comment: item.comment,
          rating: item.rating,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          reporterName: item.reporterName,
          opportunityTitle: item.opportunityTitle,
          opportunitySlug: item.opportunitySlug,
        }))}
        reviews={reviews.map((review) => ({
          id: review.id,
          entityType: review.entityType,
          entityId: review.entityId,
          status: review.status,
          note: review.note,
          createdAt: review.createdAt.toISOString(),
        }))}
        groundingFailures={groundingFailures.map((log) => ({
          id: log.id,
          createdAt: log.createdAt.toISOString(),
          inputSummary: log.inputSummary,
          outputSummary: log.outputSummary,
          engine: log.engine,
        }))}
        pendingIssues={pendingIssues.map(({ issue, reporterName, unionName }) => ({
          id: issue.id,
          category: issue.category,
          title: issue.title,
          description: issue.description,
          autoFlagged: issue.autoFlagged,
          autoFlagReason: issue.autoFlagReason,
          reporterName,
          unionName,
          createdAt: issue.createdAt.toISOString(),
        }))}
        canApprove={canApproveChanges(session.user.role)}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
