'use client';

import { useTranslations, useLocale } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Chip';
import { EmptyState } from '@/components/primitives/States';
import { Money } from '@/components/primitives/Money';
import { formatDate } from '@/lib/format/dates';

export interface BudgetFeedItem {
  readonly id: string;
  readonly projectName: string;
  readonly amount: number;
  readonly allocationDate: string;
  readonly flagCount: number;
  readonly escalated: boolean;
  readonly posterName: string;
}

export function BudgetFeed({ items, canPost }: { readonly items: readonly BudgetFeedItem[]; readonly canPost: boolean }) {
  const t = useTranslations('budget');
  const locale = useLocale() as 'bn' | 'en';

  return (
    <div className="flex flex-col gap-4">
      {canPost ? (
        <Link
          href="/budget/new"
          className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-5 type-label-lg text-text-on-brand hover:bg-ramp-green-700"
        >
          {t('postAllocation')}
        </Link>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/budget/${item.id}`} className="block rounded-lg focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2">
                <Card padding="default" className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="type-body-lg text-text-primary clamp-2">{item.projectName}</p>
                    <p className="type-caption mt-1 text-text-tertiary">
                      {t('postedBy')} {item.posterName} · {formatDate(new Date(item.allocationDate), locale)}
                    </p>
                    {item.flagCount > 0 ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge tone={item.escalated ? 'error' : 'warning'}>
                          <AlertTriangle size={14} className="icon" aria-hidden="true" /> {item.flagCount} {t('flagCount')}
                        </Badge>
                        {item.escalated ? <Badge tone="error">{t('escalatedNotice')}</Badge> : null}
                      </div>
                    ) : null}
                  </div>
                  <Money amount={item.amount} size="label" className="shrink-0 tabular text-text-primary" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
