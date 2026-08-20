import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
import { VoiceProvider } from '@/components/providers/VoiceProvider';
import { getFullSession } from '@/lib/http/session';
import { unreadCount } from '@/modules/citizen/citizen.service';

/**
 * Layout for every signed-in screen.
 *
 * The middleware already redirects unauthenticated requests, so this second
 * check is defence in depth rather than the primary gate: if the middleware
 * matcher is ever changed and stops covering a path, the page must still not
 * render a citizen's data to a stranger.
 */
export default async function AppLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const unread = await unreadCount(session.userId);

  const isStaff =
    session.user.role === 'moderator' ||
    session.user.role === 'administrator' ||
    session.user.role === 'super_admin';

  return (
    /**
     * Voice wraps the whole authenticated shell rather than any single screen,
     * because the citizen does not think in screens: "সংরক্ষিত" has to work from
     * wherever they happen to be, and the microphone must not behave differently
     * on chat than on the timeline.
     */
    <VoiceProvider authenticated isStaff={isStaff}>
      <AppShell
        userName={session.user.name}
        userRole={session.user.role}
        civicRole={session.user.civicRole}
        isDonor={Boolean(session.user.donorOrgId)}
        unreadCount={unread}
      >
        {children}
      </AppShell>
    </VoiceProvider>
  );
}
