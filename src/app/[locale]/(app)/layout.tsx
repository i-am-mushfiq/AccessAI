import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/layout/AppShell';
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

  return (
    <AppShell userName={session.user.name} userRole={session.user.role} unreadCount={unread}>
      {children}
    </AppShell>
  );
}
