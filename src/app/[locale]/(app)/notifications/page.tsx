import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { BellOff } from 'lucide-react';
import { getFullSession } from '@/lib/http/session';
import { listNotifications, unreadCount } from '@/modules/citizen/citizen.service';
import { EmptyState } from '@/components/primitives/States';
import { NotificationList } from '@/components/notifications/NotificationList';

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('notifications');
  const [items, unread] = await Promise.all([
    listNotifications(session.userId),
    unreadCount(session.userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={<BellOff size={64} className="icon" strokeWidth={1.5} />}
          title={t('emptyTitle')}
          description={t('emptyBody')}
        />
      ) : (
        <NotificationList
          items={items.map((n) => ({
            id: n.id,
            title: n.title,
            titleBn: n.titleBn,
            body: n.body,
            bodyBn: n.bodyBn,
            type: n.type,
            read: n.read,
            actionUrl: n.actionUrl,
            createdAt: n.createdAt.toISOString(),
          }))}
          initialUnread={unread}
        />
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'notifications' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
