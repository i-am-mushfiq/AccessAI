import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { getFullSession, isStaff } from '@/lib/http/session';
import { listDemoSmsOutbox } from '@/modules/notifications/sms.service';
import { env } from '@/lib/config/env';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Chip';
import { EmptyState } from '@/components/primitives/States';
import { RefreshButton } from '@/components/admin/RefreshButton';
import { formatTimeAgo } from '@/lib/format/dates';

/**
 * SJ-23/48's demo aid, made visible to staff: every message `SMS_PROVIDER=demo`
 * has "sent" — see modules/notifications/sms.service.ts's doc comment for why
 * this exists and why it is staff-only. Open this in a second browser tab
 * during a live demo, trigger an OTP request (with OTP_DEV_ECHO=false) in the
 * first tab, and refresh here to show "the text that arrived on the phone."
 */
export default async function SmsOutboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');
  const bn = locale === 'bn';
  const items = await listDemoSmsOutbox();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="type-heading-lg text-text-primary">{t('smsOutbox')}</h1>
        <RefreshButton />
      </header>

      <AdminNav />

      {env.SMS_PROVIDER !== 'demo' ? (
        <Card padding="default">
          <p className="type-body-md text-text-secondary">
            {bn
              ? 'SMS_PROVIDER=demo সক্রিয় নয় — এই আউটবক্স খালি থাকবে যতক্ষণ না এটি সক্রিয় করা হয়।'
              : 'SMS_PROVIDER=demo is not active — this outbox will stay empty until it is.'}
          </p>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title={t('smsOutboxEmpty')} icon={<MessageSquare size={64} className="icon" strokeWidth={1.5} />} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card padding="default" className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="type-body-lg tabular text-text-primary">{item.phone}</span>
                  <Badge tone="info">{formatTimeAgo(item.createdAt, locale as 'bn' | 'en')}</Badge>
                </div>
                <p className="type-body-md whitespace-pre-wrap text-text-secondary">{item.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  return { title: t('smsOutbox') };
}

export const dynamic = 'force-dynamic';
