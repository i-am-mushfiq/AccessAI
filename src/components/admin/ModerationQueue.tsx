'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Flag, ThumbsUp, ThumbsDown, AlertTriangle, Check, X } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Tabs } from '@/components/primitives/Tabs';
import { Badge } from '@/components/primitives/Chip';
import { Banner } from '@/components/primitives/Banner';
import { EmptyState } from '@/components/primitives/States';
import { useToast } from '@/components/providers/ToastProvider';
import { formatTimeAgo } from '@/lib/format/dates';

const KIND_ICONS: Record<string, typeof Flag> = {
  helpful: ThumbsUp,
  not_helpful: ThumbsDown,
  incorrect_information: Flag,
  missing_opportunity: AlertTriangle,
  rating: ThumbsUp,
};

export function ModerationQueue({
  feedbackItems,
  reviews,
  groundingFailures,
  pendingIssues,
  canApprove,
}: {
  readonly feedbackItems: readonly {
    id: string; kind: string; comment: string | null; rating: number | null; status: string;
    createdAt: string; reporterName: string | null; opportunityTitle: string | null; opportunitySlug: string | null;
  }[];
  readonly reviews: readonly {
    id: string; entityType: string; entityId: string; status: string; note: string | null; createdAt: string;
  }[];
  readonly groundingFailures: readonly {
    id: string; createdAt: string; inputSummary: string | null; outputSummary: string | null; engine: string;
  }[];
  readonly pendingIssues: readonly {
    id: string; category: string; title: string; description: string; autoFlagged: boolean;
    autoFlagReason: string | null; reporterName: string; unionName: string; createdAt: string;
  }[];
  readonly canApprove: boolean;
}) {
  const t = useTranslations('admin');
  const ti = useTranslations('issues');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<'feedback' | 'reviews' | 'issues' | 'grounding'>('feedback');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: (input: { kind: 'feedback' | 'review' | 'issue'; id: string; status: string }) =>
      api.patch('/admin/moderation', input),
    onSuccess: () => {
      toast.show({ tone: 'success', message: tc('saved') });
      router.refresh();
    },
    onError: (error) =>
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
    onSettled: () => setPendingId(null),
  });

  const newFeedback = feedbackItems.filter((f) => f.status === 'new');
  const pendingReviews = reviews.filter((r) => r.status === 'pending');

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        items={[
          { value: 'feedback' as const, label: t('moderation'), count: newFeedback.length },
          { value: 'reviews' as const, label: t('rules'), count: pendingReviews.length },
          { value: 'issues' as const, label: t('issuesTab'), count: pendingIssues.length },
          { value: 'grounding' as const, label: t('groundingFailures'), count: groundingFailures.length },
        ]}
        value={tab}
        onChange={setTab}
        label={t('moderation')}
        variant="underline"
      />

      {/* PRD §34 restated where the decisions are actually made. */}
      <Banner tone="info" statusWord={tc('appName')}>
        {locale === 'bn'
          ? 'নাগরিকের মতামত কখনো নিজে থেকে যোগ্যতার নিয়ম বদলায় না। পরিবর্তন করতে হলে একজন মানুষকেই সিদ্ধান্ত নিতে হয়।'
          : 'Citizen feedback never changes an eligibility rule by itself. A person must decide on any change.'}
      </Banner>

      {tab === 'feedback' ? (
        feedbackItems.length === 0 ? (
          <EmptyState title={tc('none')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {feedbackItems.map((item) => {
              const Icon = KIND_ICONS[item.kind] ?? Flag;
              return (
                <li key={item.id}>
                  <Card padding="default" className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <Icon
                        size={20}
                        className={
                          item.kind === 'incorrect_information'
                            ? 'icon mt-0.5 shrink-0 text-ramp-error-600'
                            : 'icon mt-0.5 shrink-0 text-text-secondary'
                        }
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="type-body-lg text-text-primary">{item.kind.replace(/_/g, ' ')}</p>
                        {item.comment ? (
                          <p className="type-body-md mt-1 text-text-secondary">{item.comment}</p>
                        ) : null}
                        {item.opportunitySlug ? (
                          <Link
                            href={`/opportunities/${item.opportunitySlug}`}
                            className="type-body-md mt-1 inline-flex min-h-12 items-center text-text-link underline"
                          >
                            {item.opportunityTitle}
                          </Link>
                        ) : null}
                        <p className="type-caption mt-1 text-text-tertiary">
                          {item.reporterName ?? tc('unknown')} · {formatTimeAgo(new Date(item.createdAt), locale)}
                        </p>
                      </div>
                      <Badge tone={item.status === 'new' ? 'warning' : 'success'}>{item.status}</Badge>
                    </div>

                    {item.status === 'new' ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          variant="secondary"
                          size="md"
                          loading={pendingId === `${item.id}-actioned`}
                          loadingLabel={tc('loading')}
                          onClick={() => {
                            setPendingId(`${item.id}-actioned`);
                            decide.mutate({ kind: 'feedback', id: item.id, status: 'actioned' });
                          }}
                          leadingIcon={<Check size={20} className="icon" />}
                        >
                          {t('markActioned')}
                        </Button>
                        <Button
                          variant="tertiary"
                          size="md"
                          loading={pendingId === `${item.id}-dismissed`}
                          loadingLabel={tc('loading')}
                          onClick={() => {
                            setPendingId(`${item.id}-dismissed`);
                            decide.mutate({ kind: 'feedback', id: item.id, status: 'dismissed' });
                          }}
                          leadingIcon={<X size={20} className="icon" />}
                        >
                          {t('dismiss')}
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {tab === 'reviews' ? (
        reviews.length === 0 ? (
          <EmptyState title={tc('none')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((review) => (
              <li key={review.id}>
                <Card padding="default" className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="type-body-lg text-text-primary">{review.entityType}</p>
                      <p className="type-caption text-text-tertiary">{review.entityId}</p>
                      {review.note ? (
                        <p className="type-body-md mt-1 text-text-secondary">{review.note}</p>
                      ) : null}
                    </div>
                    <Badge tone={review.status === 'pending' ? 'warning' : review.status === 'approved' ? 'success' : 'error'}>
                      {review.status}
                    </Badge>
                  </div>

                  {review.status === 'pending' ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="secondary"
                        size="md"
                        disabled={!canApprove}
                        disabledReason={
                          locale === 'bn'
                            ? 'শুধু প্রশাসক অনুমোদন করতে পারেন।'
                            : 'Only an administrator can approve.'
                        }
                        loading={pendingId === `${review.id}-approved`}
                        loadingLabel={tc('loading')}
                        onClick={() => {
                          setPendingId(`${review.id}-approved`);
                          decide.mutate({ kind: 'review', id: review.id, status: 'approved' });
                        }}
                      >
                        {t('approve')}
                      </Button>
                      <Button
                        variant="danger-subtle"
                        size="md"
                        disabled={!canApprove}
                        loading={pendingId === `${review.id}-rejected`}
                        loadingLabel={tc('loading')}
                        onClick={() => {
                          setPendingId(`${review.id}-rejected`);
                          decide.mutate({ kind: 'review', id: review.id, status: 'rejected' });
                        }}
                      >
                        {t('reject')}
                      </Button>
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'issues' ? (
        pendingIssues.length === 0 ? (
          <EmptyState title={tc('none')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingIssues.map((issue) => (
              <li key={issue.id}>
                <Card padding="default" className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{ti(`category.${issue.category}`)}</Badge>
                        {issue.autoFlagged ? <Badge tone="warning">{ti('autoFlagReason')}</Badge> : null}
                      </div>
                      <p className="type-body-lg mt-1 text-text-primary">{issue.title}</p>
                      <p className="type-body-md mt-1 text-text-secondary clamp-2">{issue.description}</p>
                      {issue.autoFlagged && issue.autoFlagReason ? (
                        <p className="type-caption mt-1 text-ramp-warning-600">{issue.autoFlagReason}</p>
                      ) : null}
                      <p className="type-caption mt-1 text-text-tertiary">
                        {ti('reportedBy')} {issue.reporterName} · {issue.unionName} ·{' '}
                        {formatTimeAgo(new Date(issue.createdAt), locale)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="secondary"
                      size="md"
                      loading={pendingId === `${issue.id}-verified`}
                      loadingLabel={tc('loading')}
                      onClick={() => {
                        setPendingId(`${issue.id}-verified`);
                        decide.mutate({ kind: 'issue', id: issue.id, status: 'verified' });
                      }}
                      leadingIcon={<Check size={20} className="icon" />}
                    >
                      {t('approve')}
                    </Button>
                    <Button
                      variant="danger-subtle"
                      size="md"
                      loading={pendingId === `${issue.id}-rejected`}
                      loadingLabel={tc('loading')}
                      onClick={() => {
                        setPendingId(`${issue.id}-rejected`);
                        decide.mutate({ kind: 'issue', id: issue.id, status: 'rejected' });
                      }}
                      leadingIcon={<X size={20} className="icon" />}
                    >
                      {t('reject')}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'grounding' ? (
        <div className="flex flex-col gap-3">
          <p className="type-body-md text-text-secondary measure">{t('groundingFailuresBody')}</p>
          {groundingFailures.length === 0 ? (
            <EmptyState title={t('noWarnings')} />
          ) : (
            <ul className="flex flex-col gap-3">
              {groundingFailures.map((log) => (
                <li key={log.id}>
                  <Card padding="default" className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone="error">{t('groundingFailures')}</Badge>
                      <span className="type-caption text-text-tertiary">
                        {formatTimeAgo(new Date(log.createdAt), locale)} · {log.engine}
                      </span>
                    </div>
                    <p className="type-body-md text-text-primary">{log.inputSummary}</p>
                    <p className="type-body-md rounded-md bg-surface-sunken p-3 text-text-secondary">
                      {log.outputSummary}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
