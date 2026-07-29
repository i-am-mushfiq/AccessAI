'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { CheckCheck, CalendarClock, Sparkles, RefreshCw, FileWarning, Bell, ArrowRight } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { api } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Chip';
import { formatTimeAgo } from '@/lib/format/dates';
import type { NotificationType } from '@/lib/domain/enums';

const TYPE_ICONS: Record<string, typeof Bell> = {
  deadline_reminder: CalendarClock,
  application_reminder: RefreshCw,
  new_opportunity: Sparkles,
  program_updated: RefreshCw,
  document_expiring: FileWarning,
  recommendation_improved: Sparkles,
  system: Bell,
};

export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly titleBn: string;
  readonly body: string;
  readonly bodyBn: string;
  readonly type: NotificationType;
  readonly read: boolean;
  readonly actionUrl: string | null;
  readonly createdAt: string;
}

/**
 * Notification list — PRD §67.
 *
 * Opening a notification marks only that one as read; "mark all" is a separate,
 * explicit action. Auto-reading everything on page view would destroy the
 * citizen's own record of what they had not yet dealt with.
 */
export function NotificationList({
  items,
  initialUnread,
}: {
  readonly items: readonly NotificationItem[];
  readonly initialUnread: number;
}) {
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  const locale = useLocale() as 'bn' | 'en';
  const router = useRouter();

  const [rows, setRows] = useState<NotificationItem[]>([...items]);
  const [unread, setUnread] = useState(initialUnread);

  const markRead = useMutation({
    mutationFn: (input: { ids?: string[]; all?: boolean }) => api.patch('/notifications', input),
    onSuccess: (_data, input) => {
      if (input.all) {
        setRows((current) => current.map((r) => ({ ...r, read: true })));
        setUnread(0);
      } else {
        setRows((current) =>
          current.map((r) => (input.ids?.includes(r.id) ? { ...r, read: true } : r)),
        );
        setUnread((current) => Math.max(0, current - (input.ids?.length ?? 0)));
      }
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {unread > 0 ? (
          <Badge tone="error">{t('unreadCount', { count: unread })}</Badge>
        ) : (
          <span className="type-body-md text-text-secondary">{tc('none')}</span>
        )}
        <Button
          variant="secondary"
          size="md"
          fullWidth={false}
          disabled={unread === 0}
          disabledReason={tc('none')}
          loading={markRead.isPending}
          loadingLabel={tc('loading')}
          onClick={() => markRead.mutate({ all: true })}
          leadingIcon={<CheckCheck size={20} className="icon" />}
        >
          {t('markAllRead')}
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((notification) => {
          const Icon = TYPE_ICONS[notification.type] ?? Bell;
          const title = locale === 'bn' ? notification.titleBn : notification.title;
          const body = locale === 'bn' ? notification.bodyBn : notification.body;

          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn('mt-0.5 shrink-0', notification.read ? 'text-text-secondary' : 'text-ramp-green-600')}
              >
                <Icon size={24} className="icon" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'type-body-lg block',
                    notification.read ? 'text-text-secondary' : 'type-strong text-text-primary',
                  )}
                >
                  {title}
                </span>
                <span className="type-body-md mt-0.5 block text-text-secondary">{body}</span>
                <span className="type-caption mt-1 block text-text-tertiary">
                  {formatTimeAgo(new Date(notification.createdAt), locale)}
                </span>
              </span>
              {!notification.read ? (
                <span
                  aria-label={t('unreadCount', { count: 1 })}
                  className="mt-2 h-2.5 w-2.5 shrink-0 rounded-pill bg-ramp-green-600"
                />
              ) : null}
              {notification.actionUrl ? (
                <ArrowRight size={20} className="icon mt-1 shrink-0 text-text-secondary" aria-hidden="true" />
              ) : null}
            </>
          );

          const className = cn(
            'flex min-h-18 w-full items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-start shadow-elev-1',
            'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
            notification.read ? 'border-stroke-subtle' : 'border-stroke-brand bg-surface-brand-subtle',
          );

          return (
            <li key={notification.id}>
              {notification.actionUrl ? (
                <Link
                  href={notification.actionUrl}
                  className={className}
                  onClick={() => {
                    if (!notification.read) markRead.mutate({ ids: [notification.id] });
                  }}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  className={className}
                  onClick={() => {
                    if (!notification.read) markRead.mutate({ ids: [notification.id] });
                  }}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
