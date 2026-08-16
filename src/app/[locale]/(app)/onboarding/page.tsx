import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { listOpportunities } from '@/modules/opportunities/opportunity.service';
import { toEligibilityProfile } from '@/modules/eligibility/profile-mapper';
import { fieldLabel } from '@/modules/eligibility/engine';
import type { RuleField } from '@/lib/domain/rules';
import { Link } from '@/i18n/navigation';
import { Card, Section } from '@/components/primitives/Card';
import { EmptyState } from '@/components/primitives/States';
import { OpportunityCard, type OpportunityCardData } from '@/components/opportunity/OpportunityCard';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { onboardingRouteDecision } from '@/modules/onboarding/onboarding';

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ results?: string }>;
}) {
  const { locale } = await params;
  const query = searchParams ? await searchParams : {};
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const showResults = query.results === '1';
  const routeDecision = onboardingRouteDecision(session.profile, showResults);
  if (routeDecision === 'redirect_dashboard') redirect(`/${locale}/dashboard`);
  if (routeDecision === 'redirect_onboarding') redirect(`/${locale}/onboarding`);

  if (routeDecision === 'form') {
    return (
      <OnboardingFlow
        initial={{
          district: session.profile?.district ?? session.user.district,
          occupation: session.profile?.occupation,
          monthlyIncome: session.profile?.monthlyIncome,
          householdSize: session.profile?.householdSize,
          hasFarmingActivity: session.profile?.hasFarmingActivity,
          lifeEvents: session.profile?.lifeEvents?.map((event) => event.event),
        }}
      />
    );
  }

  const t = await getTranslations('onboarding');
  const profile = toEligibilityProfile({ user: session.user, profile: session.profile });
  const recommendations = await listOpportunities({
    profile,
    userId: session.userId,
    filters: { limit: 6, outcomes: ['eligible', 'partially_eligible', 'unknown'], sort: 'relevance' },
    detectedLifeEvents: (session.profile?.lifeEvents ?? []).map((event) => event.event),
    interests: session.profile?.interests ?? [],
  });

  const cards: readonly OpportunityCardData[] = recommendations.items.map((item) => ({
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
  }));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('resultsTitle')}</h1>
        <p className="type-body-lg mt-2 max-w-prose text-text-secondary">{t('resultsBody')}</p>
      </header>

      <Section title={t('resultsTitle')}>
        {cards.length === 0 ? (
          <EmptyState
            title={t('noResultsTitle')}
            description={t('noResultsBody')}
            action={<Link href="/profile" className="inline-flex min-h-14 items-center justify-center rounded-md bg-ramp-green-600 px-6 type-label-lg text-text-on-brand">{t('completeProfile')}</Link>}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {cards.map((item, index) => {
              const source = recommendations.items[index]!;
              return (
                <div key={item.id} className="flex flex-col gap-2">
                  <OpportunityCard item={item} />
                  {source.evaluation.missingFields.length > 0 ? (
                    <p className="type-body-md px-1 text-text-secondary">
                      <span className="font-semibold">{t('missingInformation')}: </span>
                      {source.evaluation.missingFields.map((field) => fieldLabel(field as RuleField)[locale === 'bn' ? 'bn' : 'en']).join(locale === 'bn' ? '، ' : ', ')}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Card padding="default" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/profile" className="inline-flex min-h-14 items-center justify-center rounded-md border-1.5 border-stroke px-5 type-label-lg text-text-brand hover:bg-surface-brand-subtle">{t('completeProfile')}</Link>
        <Link href="/dashboard" className="inline-flex min-h-14 items-center justify-center rounded-md bg-ramp-green-600 px-5 type-label-lg text-text-on-brand hover:bg-ramp-green-700">{t('continueDashboard')}</Link>
      </Card>
    </div>
  );
}

export const dynamic = 'force-dynamic';
