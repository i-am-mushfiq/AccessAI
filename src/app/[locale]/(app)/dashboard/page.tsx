import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { desc, eq, and, gte, asc } from 'drizzle-orm';
import {
  MessageCircle, GraduationCap, HeartPulse, HandHeart, Briefcase, MapPin, ArrowRight, CircleCheck,
} from 'lucide-react';
import { db } from '@/lib/db/client';
import { conversations, timelineEvents, opportunities, actionPlanTasks, actionPlans } from '@/lib/db/schema';
import { getFullSession } from '@/lib/http/session';
import { listOpportunities } from '@/modules/opportunities/opportunity.service';
import { listSaved, savedCounts, syncTimelineDeadlines } from '@/modules/citizen/citizen.service';
import { listMyIssues } from '@/modules/issues/issue.service';
import { toEligibilityProfile, profileCompleteness, suggestNextFields } from '@/modules/eligibility/profile-mapper';
import { fieldLabel } from '@/modules/eligibility/engine';
import { Link } from '@/i18n/navigation';
import { Card, Section } from '@/components/primitives/Card';
import { Banner } from '@/components/primitives/Banner';
import { EmptyState } from '@/components/primitives/States';
import { ConfidenceMeter, Badge } from '@/components/primitives/Chip';
import { Num } from '@/components/primitives/Money';
import { OpportunityListClient } from '@/components/opportunity/OpportunityListClient';
import { formatDate, formatRelativeDay, startOfDay } from '@/lib/format/dates';
import { AiEngineNotice } from '@/components/chat/AiEngineNotice';
import { describeAiMode } from '@/modules/ai/providers';

/**
 * Dashboard — PRD §60.
 *
 * Widget order is by decision value, not by the PRD's listing order: what needs
 * action today comes first, then what the citizen can newly get, then their own
 * saved items. A dashboard whose first screenful is statistics wastes the one
 * moment a low-bandwidth user is definitely paying attention.
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const bn = locale === 'bn';

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('dashboard');
  const tc = await getTranslations('common');
  const tp = await getTranslations('plan');

  const profile = toEligibilityProfile({ user: session.user, profile: session.profile });
  const completeness = profileCompleteness(profile);

  await syncTimelineDeadlines(session.userId);

  const today = startOfDay(new Date());

  const [recommended, saved, counts, upcoming, recentConversation, todayTasks, myIssues] = await Promise.all([
    listOpportunities({
      profile,
      userId: session.userId,
      filters: { limit: 4, outcomes: ['eligible', 'partially_eligible'] },
      detectedLifeEvents: (session.profile?.lifeEvents ?? []).map((e) => e.event),
      interests: session.profile?.interests ?? [],
    }),
    listSaved(session.userId),
    savedCounts(session.userId),
    db
      .select({ event: timelineEvents, opportunitySlug: opportunities.slug })
      .from(timelineEvents)
      .leftJoin(opportunities, eq(timelineEvents.opportunityId, opportunities.id))
      .where(
        and(
          eq(timelineEvents.userId, session.userId),
          eq(timelineEvents.completed, false),
          gte(timelineEvents.eventDate, today),
        ),
      )
      .orderBy(asc(timelineEvents.eventDate))
      .limit(5),
    db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, session.userId))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(1),
    db
      .select({ task: actionPlanTasks, planTitle: actionPlans.title, planTitleBn: actionPlans.titleBn })
      .from(actionPlanTasks)
      .innerJoin(actionPlans, eq(actionPlanTasks.planId, actionPlans.id))
      .where(
        and(
          eq(actionPlans.userId, session.userId),
          eq(actionPlanTasks.status, 'pending'),
          gte(actionPlanTasks.dueDate, today),
        ),
      )
      .orderBy(asc(actionPlanTasks.dueDate))
      .limit(5),
    listMyIssues(session.userId, 3),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('greetingMorning') : hour < 17 ? t('greetingAfternoon') : t('greetingEvening');
  const suggested = suggestNextFields(profile, 1)[0];
  const ai = describeAiMode();
  const ti = await getTranslations('issues');

  const quickActions: readonly {
    href: string;
    label: string;
    icon: typeof MessageCircle;
    primary?: boolean;
  }[] = [
    { href: '/chat', label: t('startChat'), icon: MessageCircle, primary: true },
    { href: '/opportunities?category=scholarship', label: t('findScholarships'), icon: GraduationCap },
    { href: '/opportunities?category=healthcare', label: t('findHealthcare'), icon: HeartPulse },
    { href: '/opportunities?category=social_welfare', label: t('findBenefits'), icon: HandHeart },
    { href: '/opportunities?category=employment', label: t('findJobs'), icon: Briefcase },
    { href: '/nearby', label: t('findNearby'), icon: MapPin },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="type-body-md text-text-secondary">{greeting}</p>
        <h1 className="type-heading-lg mt-1 text-text-primary">{session.user.name}</h1>
      </header>

      {!ai.isLive ? <AiEngineNotice mode={ai.mode} /> : null}

      {/* --------------------------------------------- profile completeness */}
      {completeness < 80 ? (
        <Card padding="default" className="flex flex-col gap-4">
          <ConfidenceMeter
            value={completeness}
            label={t('profileMeterTitle')}
            bandLabel={completeness >= 60 ? (bn ? 'ভালো' : 'Good') : bn ? 'আরও দরকার' : 'Needs more'}
          />
          <p className="type-body-md text-text-secondary measure">{t('profileMeterBody')}</p>
          {suggested ? (
            <Link
              href="/profile"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-6 type-label-lg text-text-on-brand hover:bg-ramp-green-700 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
            >
              {bn
                ? `আপনার ${fieldLabel(suggested).bn} জানান`
                : `Tell us your ${fieldLabel(suggested).en}`}
              <ArrowRight size={20} className="icon" aria-hidden="true" />
            </Link>
          ) : null}
        </Card>
      ) : null}

      {/* ------------------------------------------------- quick actions */}
      <Section title={t('quickActions')}>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className={
                    action.primary
                      ? 'flex min-h-24 flex-col items-start justify-between gap-2 rounded-lg bg-ramp-green-600 p-4 type-label-lg text-text-on-brand hover:bg-ramp-green-700 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2'
                      : 'flex min-h-24 flex-col items-start justify-between gap-2 rounded-lg border border-stroke-subtle bg-surface p-4 type-label-lg text-text-primary shadow-elev-1 hover:border-stroke-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2'
                  }
                >
                  <Icon
                    size={28}
                    className={action.primary ? 'icon' : 'icon text-ramp-green-600'}
                    aria-hidden="true"
                  />
                  <span>{action.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* -------------------------------------------------- today's tasks */}
      {todayTasks.length > 0 ? (
        <Section title={t('tasksDueToday')} action={<Link href="/saved" className="type-label-lg text-text-link underline">{tc('viewAll')}</Link>}>
          <ul className="flex flex-col gap-2">
            {todayTasks.map(({ task, planTitle, planTitleBn }) => (
              <li key={task.id}>
                <Card padding="compact" className="flex items-center gap-3">
                  <CircleCheck size={24} className="icon shrink-0 text-ramp-neutral-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="type-body-lg block text-text-primary">
                      {bn ? task.titleBn : task.title}
                    </span>
                    <span className="type-body-md block text-text-secondary clamp-2">
                      {bn ? planTitleBn : planTitle}
                    </span>
                  </span>
                  {task.dueDate ? (
                    <Badge tone="neutral">{formatRelativeDay(task.dueDate, locale as 'bn' | 'en')}</Badge>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* --------------------------------------------- upcoming deadlines */}
      <Section
        title={t('upcomingTitle')}
        action={
          <Link href="/timeline" className="type-label-lg text-text-link underline">
            {tc('viewAll')}
          </Link>
        }
      >
        {upcoming.length === 0 ? (
          <Card padding="default">
            <p className="type-body-lg text-text-secondary">{t('upcomingEmpty')}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map(({ event, opportunitySlug }) => (
              <li key={event.id}>
                <Card padding="compact" className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="type-body-lg block text-text-primary">
                      {bn ? event.titleBn : event.title}
                    </span>
                    <span className="type-body-md block tabular text-text-secondary">
                      {formatDate(event.eventDate, locale as 'bn' | 'en')} ·{' '}
                      {formatRelativeDay(event.eventDate, locale as 'bn' | 'en')}
                    </span>
                  </span>
                  {opportunitySlug ? (
                    <Link
                      href={`/opportunities/${opportunitySlug}`}
                      aria-label={`${bn ? event.titleBn : event.title} — ${tc('viewDetails')}`}
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill text-text-secondary hover:bg-surface-sunken focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                    >
                      <ArrowRight size={20} className="icon" aria-hidden="true" />
                    </Link>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ----------------------------------------------- recommendations */}
      <Section
        title={t('recommendedTitle')}
        action={
          <Link href="/opportunities" className="type-label-lg text-text-link underline">
            {tc('viewAll')}
          </Link>
        }
      >
        {recommended.items.length === 0 ? (
          <EmptyState
            title={t('recommendedEmpty')}
            action={
              <Link
                href="/chat"
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-6 type-label-lg text-text-on-brand hover:bg-ramp-green-700"
              >
                {t('startChat')}
              </Link>
            }
          />
        ) : (
          <OpportunityListClient
            initialItems={recommended.items.map((item) => ({
              id: item.opportunity.id,
              slug: item.opportunity.slug,
              title: item.opportunity.title,
              titleBn: item.opportunity.titleBn,
              summary: item.opportunity.summary,
              summaryBn: item.opportunity.summaryBn,
              category: item.opportunity.category,
              benefitAmount: item.opportunity.benefitAmount,
              benefitPeriod: item.opportunity.benefitPeriod,
              deadline: item.opportunity.deadline ? item.opportunity.deadline.toISOString() : null,
              verificationStatus: item.opportunity.verificationStatus,
              organization: { name: item.organization.name, nameBn: item.organization.nameBn },
              eligibility: {
                outcome: item.evaluation.outcome,
                topReason: item.evaluation.matched[0]?.reason ?? null,
                topBlocker: item.evaluation.failed[0]?.reason ?? null,
                missingFields: item.evaluation.missingFields,
              },
              confidence: { score: item.confidence.score, band: item.confidence.band },
              saved: item.saved,
            }))}
          />
        )}
      </Section>

      {/* ------------------------------------------------------- saved */}
      <Section
        title={t('savedTitle')}
        action={
          <Link href="/saved" className="type-label-lg text-text-link underline">
            {tc('viewAll')}
          </Link>
        }
      >
        {saved.length === 0 ? (
          <Card padding="default">
            <p className="type-body-lg text-text-secondary">
              {bn ? 'এখনো কিছু সেভ করেননি।' : 'You have not saved anything yet.'}
            </p>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(counts).map(([status, n]) => (
              <Badge key={status} tone={status === 'applied' || status === 'approved' ? 'success' : 'neutral'}>
                {status.replace(/_/g, ' ')} · <Num value={n} />
              </Badge>
            ))}
          </div>
        )}
      </Section>

      {/* -------------------------------------------------- my reports */}
      {myIssues.length > 0 ? (
        <Section
          title={ti('myReports')}
          action={<Link href="/issues?mine=1" className="type-label-lg text-text-link underline">{tc('viewAll')}</Link>}
        >
          <ul className="flex flex-col gap-2">
            {myIssues.map((issue) => (
              <li key={issue.id}>
                <Card padding="compact" className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="type-body-lg block text-text-primary clamp-2">{issue.title}</span>
                  </span>
                  <Badge tone={issue.status === 'verified' || issue.status === 'completed' ? 'success' : 'neutral'}>
                    {ti(`status.${issue.status}`)}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* -------------------------------------------- recent conversation */}
      {recentConversation[0] ? (
        <Section title={t('recentChatTitle')}>
          <Card padding="default" className="flex flex-col gap-3">
            <p className="type-body-lg text-text-primary clamp-2">
              {recentConversation[0].title ?? recentConversation[0].summary ?? ''}
            </p>
            <Link
              href={`/chat?c=${recentConversation[0].id}`}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border-1.5 border-stroke px-6 type-label-lg text-text-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
            >
              {tp('title')}
              <ArrowRight size={20} className="icon" aria-hidden="true" />
            </Link>
          </Card>
        </Section>
      ) : null}

      <Banner tone="info" statusWord={bn ? 'মনে রাখবেন' : 'Please note'}>
        {bn
          ? 'এই প্রোটোটাইপের কর্মসূচির তথ্য নমুনা — আবেদনের আগে সংশ্লিষ্ট অফিসে নিশ্চিত করে নিন।'
          : 'Programme information in this prototype is sample data — confirm at the relevant office before applying.'}
      </Banner>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav' });
  return { title: t('dashboard') };
}

export const dynamic = 'force-dynamic';
