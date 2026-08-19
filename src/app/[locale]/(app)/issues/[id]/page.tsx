import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect, notFound } from 'next/navigation';
import { getFullSession, isStaff } from '@/lib/http/session';
import { getIssue } from '@/modules/issues/issue.service';
import { IssueDetail } from '@/components/issues/IssueDetail';

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const detail = await getIssue(id, session.userId);
  if (!detail) notFound();

  const t = await getTranslations('issues');

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
      </header>
      <IssueDetail
        issue={{
          id: detail.issue.id,
          category: detail.issue.category,
          title: detail.issue.title,
          description: detail.issue.description,
          status: detail.issue.status,
          voteCount: detail.issue.voteCount,
          photoUrl: detail.issue.photoUrl,
          autoFlagged: detail.issue.autoFlagged,
          autoFlagReason: detail.issue.autoFlagReason,
          resolutionNote: detail.issue.resolutionNote,
          createdAt: detail.issue.createdAt.toISOString(),
        }}
        reporterName={detail.reporterName}
        unionName={detail.unionName}
        unionNameBn={detail.unionNameBn}
        history={detail.history.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          note: h.note,
          changedAt: h.changedAt.toISOString(),
        }))}
        hasVoted={detail.hasVoted}
        canModerate={isStaff(session.user.role)}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
