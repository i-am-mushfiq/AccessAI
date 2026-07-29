'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Trash2, CalendarClock, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Tabs } from '@/components/primitives/Tabs';
import { Badge, VerificationBadge } from '@/components/primitives/Chip';
import { Money } from '@/components/primitives/Money';
import { Select } from '@/components/primitives/Select';
import { IconButton } from '@/components/primitives/IconButton';
import { ConfirmDialog } from '@/components/primitives/Sheet';
import { useToast } from '@/components/providers/ToastProvider';
import { formatDate, formatRelativeDay, deadlineUrgency } from '@/lib/format/dates';
import { SAVED_STATUSES, type SavedStatus, type VerificationStatus } from '@/lib/domain/enums';

/**
 * The opportunity tracker — PRD §Feature 18.
 *
 * Status changes are the point of this screen, so the control is a labelled
 * select on each row rather than a drag-and-drop board: dragging is a hidden
 * gesture (BDS §1.2 red line 9) and unusable one-handed on a phone.
 *
 * Removal is double-confirmed because the citizen may have a plan attached to it.
 */

export interface SavedEntry {
  readonly savedId: string;
  readonly status: string;
  readonly note: string | null;
  readonly updatedAt: string;
  readonly opportunity: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly titleBn: string;
    readonly category: string;
    readonly deadline: string | null;
    readonly benefitAmount: number | null;
    readonly verificationStatus: VerificationStatus;
  };
  readonly organization: { readonly name: string; readonly nameBn: string };
}

export function SavedBoard({
  items,
  counts,
}: {
  readonly items: readonly SavedEntry[];
  readonly counts: Record<string, number>;
}) {
  const t = useTranslations('saved');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();

  const [rows, setRows] = useState<SavedEntry[]>([...items]);
  const [tab, setTab] = useState<'all' | SavedStatus>('all');
  const [confirmRemove, setConfirmRemove] = useState<SavedEntry | null>(null);

  const statusLabels: Record<SavedStatus, string> = {
    interested: t('statusInterested'),
    preparing: t('statusPreparing'),
    documents_ready: t('statusDocumentsReady'),
    applied: t('statusApplied'),
    under_review: t('statusUnderReview'),
    approved: t('statusApproved'),
    rejected: t('statusRejected'),
    completed: t('statusCompleted'),
  };

  const updateStatus = useMutation({
    mutationFn: (input: { savedId: string; status: SavedStatus }) =>
      api.patch(`/saved/${input.savedId}`, { status: input.status }),
    onMutate: (input) => {
      const previous = rows.find((r) => r.savedId === input.savedId)?.status;
      setRows((current) =>
        current.map((r) => (r.savedId === input.savedId ? { ...r, status: input.status } : r)),
      );
      return { previous };
    },
    onSuccess: () => toast.show({ tone: 'success', message: tc('saved') }),
    onError: (error, input, context) => {
      if (context?.previous) {
        setRows((current) =>
          current.map((r) => (r.savedId === input.savedId ? { ...r, status: context.previous! } : r)),
        );
      }
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
    },
  });

  const remove = useMutation({
    mutationFn: (savedId: string) => api.delete(`/saved/${savedId}`),
    onSuccess: (_data, savedId) => {
      setRows((current) => current.filter((r) => r.savedId !== savedId));
      setConfirmRemove(null);
      toast.show({ tone: 'info', message: t('removed') });
    },
    onError: (error) => {
      setConfirmRemove(null);
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
    },
  });

  const visible = useMemo(
    () => (tab === 'all' ? rows : rows.filter((r) => r.status === tab)),
    [rows, tab],
  );

  const tabs = [
    { value: 'all' as const, label: tc('all'), count: rows.length },
    ...(['interested', 'preparing', 'applied', 'completed'] as const).map((status) => ({
      value: status,
      label: statusLabels[status],
      count: counts[status] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabs items={tabs} value={tab} onChange={setTab} label={t('title')} variant="underline" />

      {visible.length === 0 ? (
        <Card padding="default">
          <p className="type-body-lg text-text-secondary">{t('emptyTitle')}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((entry) => {
            const deadline = entry.opportunity.deadline ? new Date(entry.opportunity.deadline) : null;
            const urgency = deadlineUrgency(deadline);
            return (
              <li key={entry.savedId}>
                <Card padding="default" className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="type-heading-sm text-text-primary">
                        <Link
                          href={`/opportunities/${entry.opportunity.slug}`}
                          className="hover:text-text-brand focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                        >
                          {locale === 'bn' ? entry.opportunity.titleBn : entry.opportunity.title}
                        </Link>
                      </h3>
                      <p className="type-body-md mt-1 text-text-secondary">
                        {locale === 'bn' ? entry.organization.nameBn : entry.organization.name}
                      </p>
                    </div>
                    {/* Its own 48 dp target with clear separation — §5.5. */}
                    <IconButton
                      label={t('removeSaved')}
                      onClick={() => setConfirmRemove(entry)}
                      icon={<Trash2 size={20} className="icon text-text-error" />}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <VerificationBadge
                      status={entry.opportunity.verificationStatus}
                      label={entry.opportunity.verificationStatus === 'verified' ? tc('yes') : tc('unknown')}
                    />
                    {entry.opportunity.benefitAmount !== null ? (
                      <Money amount={entry.opportunity.benefitAmount} size="label" />
                    ) : null}
                    {deadline ? (
                      <Badge tone={urgency === 'critical' || urgency === 'expired' ? 'error' : urgency === 'soon' ? 'warning' : 'neutral'}>
                        <CalendarClock size={16} className="icon" aria-hidden="true" />
                        {formatDate(deadline, locale, { style: 'short' })} · {formatRelativeDay(deadline, locale)}
                      </Badge>
                    ) : null}
                  </div>

                  <Select
                    label={t('changeStatus')}
                    value={entry.status as SavedStatus}
                    onChange={(status) => updateStatus.mutate({ savedId: entry.savedId, status })}
                    placeholder={t('statusInterested')}
                    options={SAVED_STATUSES.map((s) => ({ value: s, label: statusLabels[s] }))}
                  />

                  <Link
                    href={`/opportunities/${entry.opportunity.slug}`}
                    className="inline-flex min-h-12 items-center gap-2 type-label-lg text-text-link underline focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                  >
                    {tc('viewDetails')}
                    <ArrowRight size={20} className="icon" aria-hidden="true" />
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => confirmRemove && remove.mutate(confirmRemove.savedId)}
        title={t('removeSaved')}
        description={
          confirmRemove
            ? locale === 'bn'
              ? `"${confirmRemove.opportunity.titleBn}" সেভ করা তালিকা থেকে সরানো হবে। আপনার তৈরি করা পরিকল্পনা থাকলে সেটিও আর দেখা যাবে না।`
              : `"${confirmRemove.opportunity.title}" will be removed from your saved list. Any action plan you created for it will no longer appear.`
            : ''
        }
        confirmLabel={t('removeSaved')}
        cancelLabel={tc('cancel')}
        confirming={remove.isPending}
        confirmingLabel={tc('loading')}
      />
    </div>
  );
}
