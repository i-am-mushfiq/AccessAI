'use client';

import { useTranslations } from 'next-intl';
import { HandCoins } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Chip';
import { EmptyState } from '@/components/primitives/States';

export interface BeneficiaryFeedItem {
  readonly id: string;
  readonly programCode: string;
  readonly programName: string;
  readonly programNameBn: string;
  readonly status: string;
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'error' | 'warning'> = {
  active: 'success',
  suspended: 'warning',
  inactive: 'neutral',
};

export function BeneficiaryFeed({ items }: { readonly items: readonly BeneficiaryFeedItem[] }) {
  const t = useTranslations('beneficiaries');

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/beneficiaries/new"
        className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-5 type-label-lg text-text-on-brand hover:bg-ramp-green-700"
      >
        {t('enrolNew')}
      </Link>

      {items.length === 0 ? (
        <EmptyState title={t('empty')} icon={<HandCoins size={64} className="icon" strokeWidth={1.5} />} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/beneficiaries/${item.id}`}
                className="block rounded-lg focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
              >
                <Card padding="default" className="flex items-center justify-between gap-3">
                  <p className="type-body-lg text-text-primary">{item.programName}</p>
                  <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{t(`status.${item.status}` as never)}</Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
