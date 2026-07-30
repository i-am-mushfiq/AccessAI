'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ChevronLeft, ChevronRight, CalendarClock, CircleCheck, Bell, RefreshCw, GraduationCap } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/primitives/Card';
import { Tabs } from '@/components/primitives/Tabs';
import { IconButton } from '@/components/primitives/IconButton';
import { Badge } from '@/components/primitives/Chip';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { ReadAloud } from '@/components/voice/ReadAloud';
import { speakable, spokenList, countInWords, SPOKEN_LIST_LIMIT } from '@/modules/voice/spoken';
import {
  formatDate, formatMonthYear, formatRelativeDay, startOfMonth, endOfMonth,
  weekdayShortNames, daysBetween, startOfDay, deadlineUrgency,
} from '@/lib/format/dates';
import { localiseDigits } from '@/lib/format/numerals';
import type { TimelineEventType } from '@/lib/domain/enums';

/**
 * Calendar and agenda views — PRD §65.
 *
 * Agenda is the DEFAULT rather than the month grid. A month grid answers "what
 * does this month look like?", but a citizen opens this screen to answer "what
 * do I need to do next?", and the agenda answers that without any counting.
 *
 * Day cells carry a dot AND a count, never colour alone (BDS §2.2 rule 4).
 */

export interface TimelineEntry {
  readonly id: string;
  readonly type: TimelineEventType;
  readonly title: string;
  readonly titleBn: string;
  readonly description: string | null;
  readonly descriptionBn: string | null;
  readonly eventDate: string;
  readonly completed: boolean;
  readonly opportunitySlug: string | null;
}

const TYPE_ICONS: Record<string, typeof CalendarClock> = {
  deadline: CalendarClock,
  task: CircleCheck,
  reminder: Bell,
  renewal: RefreshCw,
  training: GraduationCap,
  application_progress: RefreshCw,
  document_expiry: CalendarClock,
  scholarship_window: GraduationCap,
  announcement: Bell,
};

export function TimelineView({ events }: { readonly events: readonly TimelineEntry[] }) {
  const t = useTranslations('timeline');
  const tc = useTranslations('common');
  const tv = useTranslations('voice');
  const locale = useLocale() as 'bn' | 'en';
  const { numerals } = usePreferences();

  const [view, setView] = useState<'agenda' | 'month'>('agenda');
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const today = startOfDay(new Date());

  // Memoised because the spoken summary depends on it; a fresh object every
  // render would rebuild that summary on every keystroke elsewhere on the page.
  const typeLabels = useMemo<Record<string, string>>(
    () => ({
      deadline: t('typeDeadline'),
      task: t('typeTask'),
      reminder: t('typeReminder'),
      renewal: t('typeRenewal'),
      training: t('typeTraining'),
      application_progress: t('typeApplicationProgress'),
      document_expiry: t('typeDocumentExpiry'),
      scholarship_window: t('typeScholarshipWindow'),
      announcement: t('typeAnnouncement'),
    }),
    [t],
  );

  /** Upcoming first, then overdue — what needs doing outranks what was missed. */
  const agenda = useMemo(() => {
    const upcoming = events
      .filter((e) => daysBetween(today, new Date(e.eventDate)) >= 0)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    const past = events
      .filter((e) => daysBetween(today, new Date(e.eventDate)) < 0)
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    return { upcoming, past };
  }, [events, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    for (const event of agenda.upcoming) {
      const key = new Date(event.eventDate).toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [agenda.upcoming]);

  const monthEvents = useMemo(() => {
    const from = startOfMonth(cursor).getTime();
    const to = endOfMonth(cursor).getTime();
    const map = new Map<number, TimelineEntry[]>();
    for (const event of events) {
      const date = new Date(event.eventDate);
      if (date.getTime() < from || date.getTime() > to) continue;
      const day = date.getDate();
      const list = map.get(day) ?? [];
      list.push(event);
      map.set(day, list);
    }
    return map;
  }, [cursor, events]);

  /**
   * The spoken agenda.
   *
   * Follows the ACTIVE view rather than always reading the agenda, because
   * read-aloud is an alternative to looking at the screen, not a separate
   * feature: hearing next month's deadlines while the month grid shows March
   * would leave a listener unable to reconcile what they heard with what anyone
   * beside them can see.
   *
   * Overdue items are counted, not listed. Someone who has missed four dates
   * cannot un-miss them, and spending half a short clip on them delays the part
   * they can still act on. The count is still spoken, so nothing is hidden — the
   * screen carries the detail.
   */
  const spokenAgenda = useMemo(() => {
    const forSpeech =
      view === 'agenda'
        ? agenda.upcoming
        : [...monthEvents.entries()]
            .sort((a, b) => a[0] - b[0])
            .flatMap(([, dayEvents]) => dayEvents);

    const monthHeading = view === 'month' ? formatMonthYear(cursor, locale, numerals) : null;

    if (forSpeech.length === 0) {
      return speakable(locale, [monthHeading, t('spokenNothing')]);
    }

    const lines = forSpeech.map((event) => {
      const date = new Date(event.eventDate);
      return [
        formatRelativeDay(date, locale, { numerals }),
        locale === 'bn' ? event.titleBn : event.title,
        typeLabels[event.type] ?? event.type,
      ].join(' — ');
    });

    return speakable(locale, [
      monthHeading,
      t('spokenUpcoming', { count: countInWords(forSpeech.length, locale) }),
      spokenList(locale, lines, {
        limit: SPOKEN_LIST_LIMIT,
        more: (remaining) => tv('moreNotRead', { count: countInWords(remaining, locale) }),
      }),
      // Only in the agenda view — the month grid is not showing past items, so
      // announcing them there would describe a screen the listener is not on.
      view === 'agenda' && agenda.past.length > 0
        ? t('spokenOverdue', { count: countInWords(agenda.past.length, locale) })
        : null,
    ]);
  }, [view, agenda, monthEvents, cursor, locale, numerals, t, tv, typeLabels]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { value: 'agenda' as const, label: t('viewAgenda'), count: agenda.upcoming.length },
            { value: 'month' as const, label: t('viewMonth') },
          ]}
          value={view}
          onChange={setView}
          label={t('title')}
        />
        <ReadAloud text={spokenAgenda} />
      </div>

      {/* ------------------------------------------------------- agenda */}
      {view === 'agenda' ? (
        <div className="flex flex-col gap-5">
          {grouped.length === 0 ? (
            <Card padding="default">
              <p className="type-body-lg text-text-secondary">{t('emptyTitle')}</p>
            </Card>
          ) : (
            grouped.map(([dayKey, dayEvents]) => {
              const date = new Date(dayKey);
              return (
                <section key={dayKey} className="flex flex-col gap-2">
                  <h2 className="type-label-lg sticky top-appbar z-raised bg-canvas py-1 text-text-secondary">
                    {formatRelativeDay(date, locale, { numerals })} ·{' '}
                    {formatDate(date, locale, { numerals, withWeekday: true })}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {dayEvents.map((event) => (
                      <li key={event.id}>
                        <EventRow event={event} typeLabel={typeLabels[event.type] ?? event.type} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}

          {agenda.past.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="type-label-lg text-text-secondary">
                {locale === 'bn' ? 'আগের' : 'Earlier'}
              </h2>
              <ul className="flex flex-col gap-2">
                {agenda.past.slice(0, 10).map((event) => (
                  <li key={event.id}>
                    <EventRow event={event} typeLabel={typeLabels[event.type] ?? event.type} past />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* -------------------------------------------------------- month */}
      {view === 'month' ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <IconButton
              label={locale === 'bn' ? 'আগের মাস' : 'Previous month'}
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              icon={<ChevronLeft size={24} className="icon" />}
            />
            <h2 className="type-heading-sm tabular text-text-primary">
              {formatMonthYear(cursor, locale, numerals)}
            </h2>
            <IconButton
              label={locale === 'bn' ? 'পরের মাস' : 'Next month'}
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              icon={<ChevronRight size={24} className="icon" />}
            />
          </div>

          <Card padding="compact">
            <div className="grid grid-cols-7 gap-1">
              {weekdayShortNames(locale).map((day) => (
                <div key={day} className="type-caption pb-1 text-center text-text-secondary">
                  {day}
                </div>
              ))}

              {/* Leading blanks so the 1st lands on the right weekday. */}
              {Array.from({ length: startOfMonth(cursor).getDay() }, (_, i) => (
                <div key={`blank-${i}`} aria-hidden="true" />
              ))}

              {Array.from({ length: endOfMonth(cursor).getDate() }, (_, i) => i + 1).map((day) => {
                const dayEvents = monthEvents.get(day) ?? [];
                const cellDate = new Date(cursor.getFullYear(), cursor.getMonth(), day);
                const isToday = daysBetween(today, cellDate) === 0;
                const hasCritical = dayEvents.some(
                  (e) => e.type === 'deadline' && deadlineUrgency(new Date(e.eventDate)) === 'critical',
                );
                return (
                  <div
                    key={day}
                    className={cn(
                      'flex min-h-12 flex-col items-center justify-start gap-0.5 rounded-md py-1',
                      isToday && 'bg-surface-brand-subtle ring-1 ring-stroke-brand',
                    )}
                  >
                    <span className={cn('type-body-md tabular', isToday ? 'text-text-brand' : 'text-text-primary')}>
                      {localiseDigits(String(day), numerals)}
                    </span>
                    {dayEvents.length > 0 ? (
                      <span
                        className={cn(
                          'type-caption flex items-center gap-0.5 tabular',
                          hasCritical ? 'text-text-error' : 'text-text-secondary',
                        )}
                        aria-label={`${dayEvents.length}`}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'h-1.5 w-1.5 rounded-pill',
                            hasCritical ? 'bg-ramp-error-600' : 'bg-ramp-green-600',
                          )}
                        />
                        {localiseDigits(String(dayEvents.length), numerals)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* The month grid is a summary; the list underneath is what is
              actually actionable. */}
          <ul className="flex flex-col gap-2">
            {[...monthEvents.entries()]
              .sort((a, b) => a[0] - b[0])
              .flatMap(([, dayEvents]) => dayEvents)
              .map((event) => (
                <li key={event.id}>
                  <EventRow event={event} typeLabel={typeLabels[event.type] ?? event.type} />
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <p className="type-caption text-text-tertiary">
        {tc('today')}: {formatDate(today, locale, { numerals, withWeekday: true })}
      </p>
    </div>
  );
}

function EventRow({
  event,
  typeLabel,
  past = false,
}: {
  readonly event: TimelineEntry;
  readonly typeLabel: string;
  readonly past?: boolean;
}) {
  const locale = useLocale() as 'bn' | 'en';
  const { numerals } = usePreferences();
  const Icon = TYPE_ICONS[event.type] ?? CalendarClock;
  const date = new Date(event.eventDate);
  const urgency = event.type === 'deadline' ? deadlineUrgency(date) : null;

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 shrink-0',
          urgency === 'critical' || urgency === 'expired'
            ? 'text-ramp-error-600'
            : event.completed
              ? 'text-ramp-success-600'
              : 'text-text-secondary',
        )}
      >
        <Icon size={24} className="icon" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'type-body-lg block',
            event.completed || past ? 'text-text-secondary' : 'text-text-primary',
            event.completed && 'line-through',
          )}
        >
          {locale === 'bn' ? event.titleBn : event.title}
        </span>
        {event.description || event.descriptionBn ? (
          <span className="type-body-md block text-text-secondary clamp-2">
            {locale === 'bn' ? event.descriptionBn : event.description}
          </span>
        ) : null}
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <Badge tone={urgency === 'critical' ? 'error' : urgency === 'soon' ? 'warning' : 'neutral'}>
            {typeLabel}
          </Badge>
          <span className="type-caption tabular text-text-secondary">
            {formatDate(date, locale, { numerals, style: 'short' })} ·{' '}
            {formatRelativeDay(date, locale, { numerals })}
          </span>
        </span>
      </span>
    </>
  );

  const className = cn(
    'flex min-h-16 w-full items-start gap-3 rounded-md border border-stroke-subtle bg-surface px-4 py-3 text-start shadow-elev-1',
    'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
    event.opportunitySlug && 'hover:border-stroke-brand hover:bg-surface-brand-subtle',
  );

  return event.opportunitySlug ? (
    <Link href={`/opportunities/${event.opportunitySlug}`} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
