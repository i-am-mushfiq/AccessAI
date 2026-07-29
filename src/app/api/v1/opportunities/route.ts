import type { NextRequest } from 'next/server';
import { ok, handle } from '@/lib/http/response';
import { getFullSession } from '@/lib/http/session';
import { guardRateLimit } from '@/lib/http/rate-limit';
import { listOpportunitiesSchema, parseQuery } from '@/lib/validation/schemas';
import { listOpportunities, countByCategory } from '@/modules/opportunities/opportunity.service';
import { toEligibilityProfile } from '@/modules/eligibility/profile-mapper';
import { retrieve, opportunityIdsFrom } from '@/modules/knowledge/retrieval';
import { db } from '@/lib/db/client';
import { searchQueries } from '@/lib/db/schema';

/**
 * GET /api/v1/opportunities
 *
 * Works for signed-out visitors too: with no profile every rule evaluates to
 * `unknown`, which is the honest answer and still lets someone browse before
 * creating an account. PRD §8 includes citizens with low digital literacy, and
 * forcing registration before showing anything is a hard bounce for them.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const limited = await guardRateLimit(request, 'default');
    if (!limited.ok) return limited.response;

    const query = parseQuery(listOpportunitiesSchema, new URL(request.url));
    const session = await getFullSession();
    const profile = session
      ? toEligibilityProfile({ user: session.user, profile: session.profile })
      : {};

    const categories = query.category
      ? Array.isArray(query.category) ? query.category : [query.category]
      : undefined;
    const outcomes = query.outcome
      ? Array.isArray(query.outcome) ? query.outcome : [query.outcome]
      : undefined;
    const lifeEvents = query.lifeEvent
      ? Array.isArray(query.lifeEvent) ? query.lifeEvent : [query.lifeEvent]
      : undefined;

    // A free-text query runs through the retriever first, so ordering reflects
    // relevance rather than a plain SQL LIKE match.
    let retrievalScores: Map<string, number> | undefined;
    let ids: string[] | undefined;
    if (query.q) {
      const chunks = await retrieve(query.q, {
        district: query.district ?? profile.district ?? null,
        ...(categories ? { categories } : {}),
        limit: 40,
        perOpportunityLimit: 1,
      });
      ids = opportunityIdsFrom(chunks);
      retrievalScores = new Map(
        chunks.filter((c) => c.opportunityId).map((c) => [c.opportunityId!, c.score]),
      );
      await db.insert(searchQueries).values({
        userId: session?.userId ?? null,
        query: query.q.slice(0, 300),
        locale: session?.locale ?? 'bn',
        resultCount: ids.length,
      });
    }

    const result = await listOpportunities({
      profile,
      userId: session?.userId ?? null,
      filters: {
        ...(categories ? { categories } : {}),
        ...(outcomes ? { outcomes } : {}),
        ...(lifeEvents ? { lifeEvents } : {}),
        ...(ids ? { ids } : {}),
        district: query.district ?? profile.district ?? null,
        onlyOpen: query.includeClosed !== true,
        sort: query.sort ?? (query.q ? 'relevance' : 'relevance'),
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
      },
      ...(retrievalScores ? { retrievalScores } : {}),
      detectedLifeEvents: lifeEvents ?? [],
      interests: session?.profile?.interests ?? [],
    });

    return ok(
      {
        items: result.items.map(serialiseListItem),
        categoryCounts: await countByCategory(),
      },
      {
        meta: {
          total: result.total,
          limit: query.limit ?? 20,
          offset: query.offset ?? 0,
          personalised: Boolean(session),
        },
      },
    );
  }, 'opportunities:get');
}

/**
 * Trims the enriched record for a list view. The full eligibility trace is
 * omitted here and served by the detail endpoint — sending 40 rule traces to
 * render a list would be a needless payload on a 2G connection (BDS §4.7).
 */
function serialiseListItem(item: Awaited<ReturnType<typeof listOpportunities>>['items'][number]) {
  return {
    id: item.opportunity.id,
    slug: item.opportunity.slug,
    title: item.opportunity.title,
    titleBn: item.opportunity.titleBn,
    summary: item.opportunity.summary,
    summaryBn: item.opportunity.summaryBn,
    category: item.opportunity.category,
    benefitAmount: item.opportunity.benefitAmount,
    benefitPeriod: item.opportunity.benefitPeriod,
    deadline: item.opportunity.deadline,
    recurrence: item.opportunity.recurrence,
    verificationStatus: item.opportunity.verificationStatus,
    coverageDistricts: item.opportunity.coverageDistricts,
    lifeEvents: item.opportunity.lifeEvents,
    organization: {
      id: item.organization.id,
      name: item.organization.name,
      nameBn: item.organization.nameBn,
      type: item.organization.type,
    },
    eligibility: {
      outcome: item.evaluation.outcome,
      score: item.evaluation.score,
      ruleCoverage: item.evaluation.ruleCoverage,
      missingFields: item.evaluation.missingFields,
      matchedCount: item.evaluation.matched.length,
      failedCount: item.evaluation.failed.length,
      // One reason each way is enough for a card; the rest are on the detail page.
      topReason: item.evaluation.matched[0]?.reason ?? null,
      topBlocker: item.evaluation.failed[0]?.reason ?? null,
    },
    confidence: { score: item.confidence.score, band: item.confidence.band },
    relevance: item.ranking?.total ?? null,
    saved: item.saved,
  };
}

export const dynamic = 'force-dynamic';
