'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { Check, X, Eye } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Chip';
import { Tabs } from '@/components/primitives/Tabs';
import { EmptyState } from '@/components/primitives/States';
import { Money } from '@/components/primitives/Money';
import { useToast } from '@/components/providers/ToastProvider';
import { formatTimeAgo } from '@/lib/format/dates';
import { Link } from '@/i18n/navigation';

export interface EscalationItem {
  readonly id: string;
  readonly status: string;
  readonly flagCount: number;
  readonly verifiedResidentCount: number;
  readonly ratio: number;
  readonly createdAt: string;
  readonly allocationId: string;
  readonly projectName: string;
  readonly amount: number;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'error' | 'warning'> = {
  pending: 'warning',
  acknowledged: 'neutral',
  resolved: 'success',
  dismissed: 'error',
};

export function EscalationQueue({
  mine,
  unassigned,
}: {
  readonly mine: readonly EscalationItem[];
  readonly unassigned: readonly EscalationItem[];
}) {
  const t = useTranslations('officer');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<'mine' | 'unassigned'>('mine');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: (input: { id: string; status: 'acknowledged' | 'resolved' | 'dismissed' }) =>
      api.patch(`/upazila/escalations/${input.id}`, { status: input.status }),
    onSuccess: () => {
      toast.show({ tone: 'success', message: tc('saved') });
      router.refresh();
    },
    onError: (error) => toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
    onSettled: () => setPendingId(null),
  });

  const items = tab === 'mine' ? mine : unassigned;

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        items={[
          { value: 'mine' as const, label: t('mineTab'), count: mine.length },
          { value: 'unassigned' as const, label: t('unassignedTab'), count: unassigned.length },
        ]}
        value={tab}
        onChange={setTab}
        label={t('title')}
        variant="underline"
      />

      {items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card padding="default" className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="type-body-lg text-text-primary">{item.projectName}</p>
                    <p className="type-caption mt-1 text-text-tertiary">
                      {item.flagCount}/{item.verifiedResidentCount} ({Math.round(item.ratio * 100)}%) ·{' '}
                      {formatTimeAgo(new Date(item.createdAt), locale)}
                    </p>
                  </div>
                  <Money amount={item.amount} size="label" className="shrink-0 tabular text-text-primary" />
                </div>
                <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{t(`status.${item.status}` as never)}</Badge>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/budget/${item.allocationId}`}
                    className="inline-flex min-h-12 items-center gap-2 rounded-md border-1.5 border-stroke px-4 type-label-md text-text-brand hover:bg-surface-brand-subtle"
                  >
                    <Eye size={18} className="icon" aria-hidden="true" />
                    {tc('viewDetails')}
                  </Link>
                  {item.status !== 'resolved' && item.status !== 'dismissed' ? (
                    <>
                      {item.status === 'pending' ? (
                        <Button
                          variant="secondary"
                          size="md"
                          loading={pendingId === `${item.id}-acknowledged`}
                          loadingLabel={tc('loading')}
                          onClick={() => {
                            setPendingId(`${item.id}-acknowledged`);
                            decide.mutate({ id: item.id, status: 'acknowledged' });
                          }}
                        >
                          {t('acknowledge')}
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        size="md"
                        loading={pendingId === `${item.id}-resolved`}
                        loadingLabel={tc('loading')}
                        onClick={() => {
                          setPendingId(`${item.id}-resolved`);
                          decide.mutate({ id: item.id, status: 'resolved' });
                        }}
                        leadingIcon={<Check size={18} className="icon" />}
                      >
                        {t('resolve')}
                      </Button>
                      <Button
                        variant="danger-subtle"
                        size="md"
                        loading={pendingId === `${item.id}-dismissed`}
                        loadingLabel={tc('loading')}
                        onClick={() => {
                          setPendingId(`${item.id}-dismissed`);
                          decide.mutate({ id: item.id, status: 'dismissed' });
                        }}
                        leadingIcon={<X size={18} className="icon" />}
                      >
                        {t('dismiss')}
                      </Button>
                    </>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
