'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { Card, Section } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Chip';
import { Textarea } from '@/components/primitives/Textarea';
import { Money } from '@/components/primitives/Money';
import { useToast } from '@/components/providers/ToastProvider';
import { formatDate } from '@/lib/format/dates';

export interface BudgetDetailAllocation {
  readonly id: string;
  readonly projectName: string;
  readonly description: string;
  readonly amount: number;
  readonly allocationDate: string;
  readonly escalated: boolean;
}

export function BudgetDetail({
  allocation,
  posterName,
  unionName,
  unionNameBn,
  flagCount: initialFlagCount,
  verifiedResidentCount,
  ratio,
  ledgerCount,
  canFlag,
}: {
  readonly allocation: BudgetDetailAllocation;
  readonly posterName: string;
  readonly unionName: string;
  readonly unionNameBn: string;
  readonly flagCount: number;
  readonly verifiedResidentCount: number;
  readonly ratio: number;
  readonly ledgerCount: number;
  readonly canFlag: boolean;
}) {
  const t = useTranslations('budget');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();

  const [flagCount, setFlagCount] = useState(initialFlagCount);
  const [escalated, setEscalated] = useState(allocation.escalated);
  const [alreadyFlagged, setAlreadyFlagged] = useState(false);
  const [reason, setReason] = useState('');

  const flag = useMutation({
    mutationFn: () => api.post<{ alreadyFlagged: boolean; flagCount: number; escalated: boolean }>(
      `/budget/allocations/${allocation.id}/flag`,
      { reason: reason.trim() || undefined },
    ),
    onSuccess: (result) => {
      setFlagCount(result.flagCount);
      setEscalated(result.escalated);
      setAlreadyFlagged(result.alreadyFlagged);
      toast.show({ tone: result.alreadyFlagged ? 'info' : 'success', message: tc('saved') });
    },
    onError: (error) => toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card padding="default" className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="type-heading-sm text-text-primary">{allocation.projectName}</h2>
          <Money amount={allocation.amount} size="label" className="shrink-0 tabular text-text-primary" />
        </div>
        <p className="type-body-lg text-text-secondary">{allocation.description}</p>
        <p className="type-caption text-text-tertiary">
          {t('postedBy')} {posterName} · {locale === 'bn' ? unionNameBn : unionName} ·{' '}
          {formatDate(new Date(allocation.allocationDate), locale)}
        </p>

        {flagCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={escalated ? 'error' : 'warning'}>
              <AlertTriangle size={14} className="icon" aria-hidden="true" /> {flagCount} {t('flagCount')}
            </Badge>
            {verifiedResidentCount > 0 ? (
              <span className="type-caption tabular text-text-tertiary">
                {t('ratioLabel')}: {Math.round(ratio * 100)}%
              </span>
            ) : null}
          </div>
        ) : null}

        {escalated ? (
          <p className="type-body-md rounded-md bg-surface-sunken p-3 text-text-error">{t('escalatedNotice')}</p>
        ) : null}

        {canFlag ? (
          <div className="flex flex-col gap-2">
            <Textarea
              label={t('flagReasonLabel')}
              optionalLabel={t('flagReasonOptional')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
            />
            <Button
              variant={alreadyFlagged ? 'secondary' : 'danger-subtle'}
              size="md"
              loading={flag.isPending}
              loadingLabel={tc('loading')}
              onClick={() => flag.mutate()}
              leadingIcon={<AlertTriangle size={20} className="icon" />}
            >
              {alreadyFlagged ? t('flagged') : t('flag')}
            </Button>
          </div>
        ) : null}
      </Card>

      <Section title={t('ledgerTitle')}>
        <Card padding="default" className="flex items-center gap-3">
          <ShieldCheck size={24} className="icon shrink-0 text-ramp-green-600" aria-hidden="true" />
          <span className="type-body-md text-text-secondary">
            {ledgerCount} {ledgerCount === 1 ? 'entry' : 'entries'} — {t('ledgerVerified')}
          </span>
        </Card>
      </Section>
    </div>
  );
}
