'use client';

import { useTranslations, useLocale } from 'next-intl';
import { HandCoins } from 'lucide-react';
import { Card, Section } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Chip';
import { EmptyState } from '@/components/primitives/States';
import { Money } from '@/components/primitives/Money';
import { formatDate } from '@/lib/format/dates';

export interface EntitlementStatusView {
  readonly enrolled: boolean;
  readonly reason?: 'nid_not_verified' | 'not_enrolled';
  readonly beneficiary?: {
    readonly programCode: string;
    readonly programName: string;
    readonly programNameBn: string;
    readonly status: string;
  };
  readonly entitlements?: readonly {
    readonly id: string;
    readonly amount: number;
    readonly period: string;
    readonly status: string;
    readonly disbursements: readonly {
      readonly id: string;
      readonly amount: number;
      readonly scheduledFor: string;
      readonly paidAt: string | null;
      readonly status: string;
    }[];
  }[];
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'error' | 'warning'> = {
  active: 'success',
  suspended: 'warning',
  completed: 'neutral',
  scheduled: 'neutral',
  paid: 'success',
  failed: 'error',
  on_hold: 'warning',
};

export function EntitlementStatus({ result }: { readonly result: EntitlementStatusView }) {
  const t = useTranslations('entitlements');
  const locale = useLocale() as 'bn' | 'en';

  if (!result.enrolled || !result.beneficiary) {
    return <EmptyState title={t('notEnrolled')} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card padding="default" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <HandCoins size={24} className="icon shrink-0 text-ramp-green-600" aria-hidden="true" />
          <p className="type-body-lg text-text-primary">
            {locale === 'bn' ? result.beneficiary.programNameBn : result.beneficiary.programName}
          </p>
          <Badge tone={STATUS_TONE[result.beneficiary.status] ?? 'neutral'}>
            {t(`status.${result.beneficiary.status}` as never)}
          </Badge>
        </div>
      </Card>

      {(result.entitlements ?? []).map((entitlement) => (
        <Section key={entitlement.id} title={t('disbursementsTitle')}>
          <Card padding="default" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="type-body-md text-text-secondary">{t('amountLabel')}</span>
              <Money amount={entitlement.amount} size="label" className="tabular text-text-primary" />
            </div>
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
          </Card>
        </Section>
      ))}
    </div>
  );
}
