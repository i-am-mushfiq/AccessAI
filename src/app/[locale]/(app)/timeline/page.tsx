import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { getFullSession } from '@/lib/http/session';
import { listTimeline, syncTimelineDeadlines, generateDeadlineReminders } from '@/modules/citizen/citizen.service';
import { EmptyState } from '@/components/primitives/States';
import { TimelineView } from '@/components/timeline/TimelineView';
import { addDays } from '@/lib/format/dates';

/**
 * Opportunity Timeline — PRD §Feature 13 and §65.
 *
 * Loading the page reconciles the timeline and creates any due reminders, so it
 * is correct even between scheduled job runs. A 120-day window is loaded rather
 * than a single month: switching months is then instant and offline-tolerant,
 * which matters far more on a slow connection than a marginally smaller payload.
 */
export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ focus?: string }>;
}) {
  const { locale } = await params;
  const query = searchParams ? await searchParams : {};
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('timeline');

  await syncTimelineDeadlines(session.userId);
  await generateDeadlineReminders(session.userId, 7);

  const now = new Date();
  const events = await listTimeline({
    userId: session.userId,
    from: addDays(now, -30),
    to: addDays(now, 120),
    limit: 400,
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary measure">{t('subtitle')}</p>
      </header>

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={64} className="icon" strokeWidth={1.5} />}
          title={t('emptyTitle')}
          description={t('emptyBody')}
        />
      ) : (
        <TimelineView
          events={events.map(({ event, opportunity, planId }) => ({
            id: event.id,
            type: event.type,
            title: event.title,
            titleBn: event.titleBn,
            description: event.description,
            descriptionBn: event.descriptionBn,
            eventDate: event.eventDate.toISOString(),
            completed: event.completed,
            opportunitySlug: opportunity?.slug ?? null,
            planId,
          }))}
          focusPlanId={query.focus?.trim() || null}
        />
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'timeline' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
