'use client';

import { useTranslations, useLocale } from 'next-intl';
import { ThumbsUp, Camera } from 'lucide-react';
import { Link, useRouter, usePathname } from '@/i18n/navigation';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Chip';
import { Tabs } from '@/components/primitives/Tabs';
import { EmptyState } from '@/components/primitives/States';
import { formatTimeAgo } from '@/lib/format/dates';
import type { IssueCategory, IssueStatus } from '@/lib/domain/enums';

export interface IssueFeedItem {
  readonly id: string;
  readonly category: IssueCategory;
  readonly title: string;
  readonly status: IssueStatus;
  readonly voteCount: number;
  readonly createdAt: string;
  readonly photoUrl: string | null;
  readonly reporterName: string;
}

const STATUS_TONE: Record<IssueStatus, 'neutral' | 'success' | 'error' | 'warning'> = {
  submitted: 'neutral',
  under_review: 'warning',
  verified: 'success',
  rejected: 'error',
  in_progress: 'warning',
  completed: 'success',
  archived: 'neutral',
};

export function IssueFeed({
  items,
  mine,
  sort,
}: {
  readonly items: readonly IssueFeedItem[];
  readonly mine: boolean;
  readonly sort: 'top' | 'recent';
}) {
  const t = useTranslations('issues');
  const locale = useLocale() as 'bn' | 'en';
  const router = useRouter();
  const pathname = usePathname();

  const setParam = (key: string, value: string | null) => {
    const url = new URLSearchParams();
    if (mine) url.set('mine', '1');
    if (sort === 'recent') url.set('sort', 'recent');
    if (value === null) url.delete(key);
    else url.set(key, value);
    router.push(`${pathname}?${url.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          items={[
            { value: 'feed' as const, label: t('title') },
            { value: 'mine' as const, label: t('myReports') },
          ]}
          value={mine ? 'mine' : 'feed'}
          onChange={(value) => setParam('mine', value === 'mine' ? '1' : null)}
          label={t('title')}
          variant="underline"
        />

        <Link
          href="/issues/new"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-5 type-label-lg text-text-on-brand hover:bg-ramp-green-700"
        >
          {t('reportIssue')}
        </Link>
      </div>

      {!mine ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setParam('sort', null)}
            className={sort === 'top' ? 'type-label-md text-text-brand underline' : 'type-label-md text-text-secondary'}
          >
            {t('sortTop')}
          </button>
          <span className="text-text-tertiary">·</span>
          <button
            type="button"
            onClick={() => setParam('sort', 'recent')}
            className={sort === 'recent' ? 'type-label-md text-text-brand underline' : 'type-label-md text-text-secondary'}
          >
            {t('sortRecent')}
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/issues/${item.id}`} className="block rounded-lg focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2">
                <Card padding="default" className="flex items-start gap-3">
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photoUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-text-tertiary">
                      <Camera size={24} className="icon" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{t(`category.${item.category}`)}</Badge>
                      <Badge tone={STATUS_TONE[item.status]}>{t(`status.${item.status}`)}</Badge>
                    </div>
                    <p className="type-body-lg mt-1 text-text-primary clamp-2">{item.title}</p>
                    <p className="type-caption mt-1 text-text-tertiary">
                      {t('reportedBy')} {item.reporterName} · {formatTimeAgo(new Date(item.createdAt), locale)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1 text-text-secondary">
                    <ThumbsUp size={20} className="icon" aria-hidden="true" />
                    <span className="type-label-md tabular">{item.voteCount}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
