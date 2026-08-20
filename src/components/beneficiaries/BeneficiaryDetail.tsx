'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { HandCoins, Wallet } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { Card, Section } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Chip';
import { TextField } from '@/components/primitives/TextField';
import { Select } from '@/components/primitives/Select';
import { Money } from '@/components/primitives/Money';
import { useToast } from '@/components/providers/ToastProvider';
import { formatDate } from '@/lib/format/dates';
import { DISBURSEMENT_STATUSES, type DisbursementStatus } from '@/lib/domain/enums';

export interface BeneficiaryDetailDisbursement {
  readonly id: string;
  readonly amount: number;
  readonly scheduledFor: string;
  readonly paidAt: string | null;
  readonly status: string;
}

export interface BeneficiaryDetailEntitlement {
  readonly id: string;
  readonly amount: number;
  readonly period: string;
  readonly status: string;
  readonly disbursements: readonly BeneficiaryDetailDisbursement[];
}

export interface BeneficiaryDetailView {
  readonly programCode: string;
  readonly programName: string;
  readonly programNameBn: string;
  readonly status: string;
  readonly entitlements: readonly BeneficiaryDetailEntitlement[];
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'error' | 'warning'> = {
  active: 'success',
  suspended: 'warning',
  inactive: 'neutral',
  completed: 'neutral',
  scheduled: 'neutral',
  paid: 'success',
  failed: 'error',
  on_hold: 'warning',
};

export function BeneficiaryDetail({ beneficiary }: { readonly beneficiary: BeneficiaryDetailView }) {
  const t = useTranslations('beneficiaries');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <Card padding="default" className="flex items-center gap-3">
        <HandCoins size={24} className="icon shrink-0 text-ramp-green-600" aria-hidden="true" />
        <p className="type-body-lg flex-1 text-text-primary">
          {locale === 'bn' ? beneficiary.programNameBn : beneficiary.programName}
        </p>
        <Badge tone={STATUS_TONE[beneficiary.status] ?? 'neutral'}>{t(`status.${beneficiary.status}` as never)}</Badge>
      </Card>

      {beneficiary.entitlements.map((entitlement) => (
        <Section key={entitlement.id} title={t('disbursementsTitle')}>
          <div className="flex flex-col gap-3">
            <Card padding="default" className="flex items-center justify-between">
              <span className="type-body-md text-text-secondary">
                {t('amountLabel')} ({t(`period.${entitlement.period}` as never)})
              </span>
              <Money amount={entitlement.amount} size="label" className="tabular text-text-primary" />
            </Card>

            {entitlement.disbursements.length === 0 ? null : (
              <ul className="flex flex-col gap-2">
                {entitlement.disbursements.map((d) => (
                  <li key={d.id}>
                    <Card padding="compact" className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <Money amount={d.amount} size="label" className="tabular text-text-primary" />
                        <span className="type-caption block text-text-tertiary">
                          {d.paidAt
                            ? `${t('paidAt')}: ${formatDate(new Date(d.paidAt), locale)}`
                            : `${t('scheduledFor')}: ${formatDate(new Date(d.scheduledFor), locale)}`}
                        </span>
                      </span>
                      <Badge tone={STATUS_TONE[d.status] ?? 'neutral'}>{t(`status.${d.status}` as never)}</Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            )}

            <RecordDisbursementForm
              entitlementId={entitlement.id}
              onRecorded={() => {
                toast.show({ tone: 'success', message: tc('saved') });
                router.refresh();
              }}
              onError={(message) => toast.show({ tone: 'error', message: message ?? te('genericBody') })}
            />
          </div>
        </Section>
      ))}
    </div>
  );
}

function RecordDisbursementForm({
  entitlementId,
  onRecorded,
  onError,
}: {
  readonly entitlementId: string;
  readonly onRecorded: () => void;
  readonly onError: (message?: string) => void;
}) {
  const t = useTranslations('beneficiaries');
  const tc = useTranslations('common');

  const [amount, setAmount] = useState('');
  const [scheduledFor, setScheduledFor] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<DisbursementStatus>('paid');

  const record = useMutation({
    mutationFn: () =>
      api.post(`/entitlements/${entitlementId}/disbursements`, {
        amount: Number(amount),
        scheduledFor,
        status,
      }),
    onSuccess: () => {
      setAmount('');
      onRecorded();
    },
    onError: (error) => onError(error instanceof ApiError ? error.message : undefined),
  });

  const canSubmit = Number(amount) > 0 && scheduledFor.length > 0;

  return (
    <Card padding="default" className="flex flex-col gap-3">
      <p className="type-label-md text-text-secondary">{t('recordDisbursement')}</p>
      <TextField
        label={t('amountLabel')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        normaliseDigits
        prefix="৳"
      />
      <TextField label={t('dateLabel')} type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
      <Select
        label={t('disbursementStatusLabel')}
        placeholder={t('disbursementStatusLabel')}
        options={DISBURSEMENT_STATUSES.map((s) => ({ value: s, label: t(`status.${s}` as never) }))}
        value={status}
        onChange={setStatus}
      />
      <Button
        variant="secondary"
        size="md"
        disabled={!canSubmit}
        loading={record.isPending}
        loadingLabel={tc('loading')}
        onClick={() => record.mutate()}
        leadingIcon={<Wallet size={18} className="icon" />}
      >
        {t('recordDisbursement')}
      </Button>
    </Card>
  );
}
