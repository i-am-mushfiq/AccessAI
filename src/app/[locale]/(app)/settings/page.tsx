import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { listSessions } from '@/modules/auth/auth.service';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { env } from '@/lib/config/env';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('settings');
  const sessions = await listSessions(session.userId);

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
      </header>

      <SettingsPanel
        settings={{
          theme: session.settings?.theme ?? 'light',
          textScale: session.settings?.textScale ?? 1,
          numeralSystem: session.settings?.numeralSystem ?? 'latin',
          reduceMotion: session.settings?.reduceMotion ?? false,
          voiceEnabled: session.settings?.voiceEnabled ?? true,
          notifyPush: session.settings?.notifyPush ?? true,
          notifyEmail: session.settings?.notifyEmail ?? false,
          notifySms: session.settings?.notifySms ?? false,
          notifyDeadlines: session.settings?.notifyDeadlines ?? true,
          notifyNewOpportunities: session.settings?.notifyNewOpportunities ?? true,
          notifyProgramUpdates: session.settings?.notifyProgramUpdates ?? true,
        }}
        // The SMS toggle is shown but disabled with a reason when no provider is
        // configured — an enabled switch that silently does nothing would be a lie.
        smsAvailable={Boolean(env.SMS_PROVIDER && env.SMS_API_KEY)}
        emailAvailable={Boolean(env.SMTP_HOST)}
        sessions={sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent,
          ip: s.ip,
          createdAt: s.createdAt.toISOString(),
          revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
