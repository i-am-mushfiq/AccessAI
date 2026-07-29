import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getFullSession } from '@/lib/http/session';
import { listOpportunities, countByCategory } from '@/modules/opportunities/opportunity.service';
import { toEligibilityProfile } from '@/modules/eligibility/profile-mapper';
import { retrieve, opportunityIdsFrom } from '@/modules/knowledge/retrieval';
import { OpportunityBrowser } from '@/components/opportunity/OpportunityBrowser';
import { OPPORTUNITY_CATEGORIES, type OpportunityCategory, type EligibilityOutcome } from '@/lib/domain/enums';

/**
 * Programme browser — PRD §Feature 4 and §71.
 *
 * Filtering is server-driven so a filtered view is shareable and survives a
 * reload, which matters when a field officer sends a citizen a link. Search runs
 * through the hybrid retriever rather than a SQL LIKE, so a Bangla query finds
 * an English record and vice versa.
 */
export default async function OpportunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('opportunities');
  const session = await getFullSession();
  const profile = session ? toEligibilityProfile({ user: session.user, profile: session.profile }) : {};

  const asArray = (value: string | string[] | undefined): string[] =>
    value === undefined ? [] : Array.isArray(value) ? value : [value];

  const categories = asArray(query.category).filter((c): c is OpportunityCategory =>
    (OPPORTUNITY_CATEGORIES as readonly string[]).includes(c),
  );
  const outcomes = asArray(query.outcome) as EligibilityOutcome[];
  const lifeEvents = asArray(query.lifeEvent);
  const search = typeof query.q === 'string' ? query.q : undefined;
  const sort = (typeof query.sort === 'string' ? query.sort : 'relevance') as
    | 'relevance' | 'deadline' | 'newest' | 'amount';
  const district = typeof query.district === 'string' ? query.district : (profile.district ?? null);

  // A text query goes through retrieval first so ranking reflects relevance.
  let ids: string[] | undefined;
  let retrievalScores: Map<string, number> | undefined;
  if (search) {
    const chunks = await retrieve(search, {
      district,
      ...(categories.length > 0 ? { categories } : {}),
      limit: 60,
      perOpportunityLimit: 1,
    });
    ids = opportunityIdsFrom(chunks);
    retrievalScores = new Map(chunks.filter((c) => c.opportunityId).map((c) => [c.opportunityId!, c.score]));
  }

  const [result, categoryCounts] = await Promise.all([
    listOpportunities({
      profile,
      userId: session?.userId ?? null,
      filters: {
        ...(categories.length > 0 ? { categories } : {}),
        ...(outcomes.length > 0 ? { outcomes } : {}),
        ...(lifeEvents.length > 0 ? { lifeEvents } : {}),
        ...(ids ? { ids } : {}),
        district,
        onlyOpen: true,
        sort,
        limit: 40,
      },
      ...(retrievalScores ? { retrievalScores } : {}),
      detectedLifeEvents: lifeEvents,
      interests: session?.profile?.interests ?? [],
    }),
    countByCategory(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary measure">{t('subtitle')}</p>
      </header>

      <OpportunityBrowser
        items={result.items.map((item) => ({
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
        total={result.total}
        categoryCounts={categoryCounts}
        activeCategories={categories}
        activeOutcomes={outcomes}
        activeSearch={search ?? ''}
        activeSort={sort}
        personalised={Boolean(session)}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'opportunities' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
