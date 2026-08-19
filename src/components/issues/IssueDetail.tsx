'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { ThumbsUp, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { Card, Section } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Chip';
import { Textarea } from '@/components/primitives/Textarea';
import { Select } from '@/components/primitives/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { formatTimeAgo } from '@/lib/format/dates';
import { nextStatuses } from '@/modules/issues/state-machine';
import type { IssueCategory, IssueStatus } from '@/lib/domain/enums';

const STATUS_TONE: Record<IssueStatus, 'neutral' | 'success' | 'error' | 'warning'> = {
  submitted: 'neutral',
  under_review: 'warning',
  verified: 'success',
  rejected: 'error',
  in_progress: 'warning',
  completed: 'success',
  archived: 'neutral',
};

export interface IssueDetailView {
  readonly id: string;
  readonly category: IssueCategory;
  readonly title: string;
  readonly description: string;
  readonly status: IssueStatus;
  readonly voteCount: number;
  readonly photoUrl: string | null;
  readonly autoFlagged: boolean;
  readonly autoFlagReason: string | null;
  readonly resolutionNote: string | null;
  readonly createdAt: string;
}

export function IssueDetail({
  issue,
  reporterName,
  unionName,
  unionNameBn,
  history,
  hasVoted: initialHasVoted,
  canModerate,
}: {
  readonly issue: IssueDetailView;
  readonly reporterName: string;
  readonly unionName: string;
  readonly unionNameBn: string;
  readonly history: readonly {
    readonly id: string;
    readonly fromStatus: IssueStatus | null;
    readonly toStatus: IssueStatus;
    readonly note: string | null;
    readonly changedAt: string;
  }[];
  readonly hasVoted: boolean;
  readonly canModerate: boolean;
}) {
  const t = useTranslations('issues');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();

  const [status, setStatus] = useState(issue.status);
  const [voteCount, setVoteCount] = useState(issue.voteCount);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [nextStatus, setNextStatus] = useState<IssueStatus | undefined>();
  const [note, setNote] = useState('');

  const vote = useMutation({
    mutationFn: () => api.post<{ voted: boolean; voteCount: number }>(`/issues/${issue.id}/vote`),
    onSuccess: (result) => {
      setHasVoted(result.voted);
      setVoteCount(result.voteCount);
    },
    onError: (error) => toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const updateStatus = useMutation({
    mutationFn: () => api.patch(`/issues/${issue.id}`, { status: nextStatus, note: note.trim() || undefined }),
    onSuccess: () => {
      if (nextStatus) setStatus(nextStatus);
      setNote('');
      toast.show({ tone: 'success', message: tc('saved') });
    },
    onError: (error) => toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const options = nextStatuses(status);

  return (
    <div className="flex flex-col gap-6">
      <Card padding="default" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{t(`category.${issue.category}`)}</Badge>
          <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
          {issue.autoFlagged ? (
            <Badge tone="warning">
              <AlertTriangle size={14} className="icon" aria-hidden="true" /> {t('autoFlagReason')}
            </Badge>
          ) : null}
        </div>

        <h2 className="type-heading-sm text-text-primary">{issue.title}</h2>
        <p className="type-body-lg text-text-secondary">{issue.description}</p>

        {issue.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={issue.photoUrl} alt="" className="max-h-80 w-full rounded-md object-cover" />
        ) : null}

        <p className="type-caption text-text-tertiary">
          {t('reportedBy')} {reporterName} · {locale === 'bn' ? unionNameBn : unionName} ·{' '}
          {formatTimeAgo(new Date(issue.createdAt), locale)}
        </p>

        {issue.resolutionNote ? (
          <p className="type-body-md rounded-md bg-surface-sunken p-3 text-text-secondary">{issue.resolutionNote}</p>
        ) : null}

        <Button
          variant={hasVoted ? 'secondary' : 'primary'}
          size="md"
          loading={vote.isPending}
          loadingLabel={tc('loading')}
          onClick={() => vote.mutate()}
          leadingIcon={<ThumbsUp size={20} className="icon" />}
        >
          {hasVoted ? t('voted') : t('vote')} · {voteCount}
        </Button>
      </Card>

      <Section title={t('statusHistory')}>
        <ul className="flex flex-col gap-2">
          {history.map((entry) => (
            <li key={entry.id}>
              <Card padding="compact" className="flex items-center justify-between gap-3">
                <span className="type-body-md text-text-primary">{t(`status.${entry.toStatus}`)}</span>
                <span className="type-caption text-text-tertiary">{formatTimeAgo(new Date(entry.changedAt), locale)}</span>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {canModerate && options.length > 0 ? (
        <Section title={t('updateStatus')}>
          <Card padding="default" className="flex flex-col gap-3">
            <Select
              label={t('updateStatus')}
              placeholder={t('updateStatus')}
              options={options.map((s) => ({ value: s, label: t(`status.${s}`) }))}
              value={nextStatus}
              onChange={setNextStatus}
            />
            <Textarea
              label={t('resolutionNote')}
              optionalLabel={tc('optional')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <Button
              variant="primary"
              size="md"
              disabled={!nextStatus}
              loading={updateStatus.isPending}
              loadingLabel={tc('loading')}
              onClick={() => updateStatus.mutate()}
            >
              {tc('save')}
            </Button>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
