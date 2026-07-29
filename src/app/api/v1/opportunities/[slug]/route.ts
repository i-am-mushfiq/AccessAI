import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { serviceLocations, documents } from '@/lib/db/schema';
import { ok, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { getFullSession } from '@/lib/http/session';
import {
  getOpportunityBySlug, getRelated, recordView, recordEvaluation,
} from '@/modules/opportunities/opportunity.service';
import { toEligibilityProfile } from '@/modules/eligibility/profile-mapper';
import { retrieve } from '@/modules/knowledge/retrieval';
import { haversineKm, getDistrict } from '@/lib/domain/geography';

/**
 * GET /api/v1/opportunities/:slug
 *
 * Returns everything the detail page and the Trust panel need in ONE request:
 * the programme, the full eligibility trace, the document checklist, the
 * confidence breakdown with its reasons, the source documents, nearby offices,
 * and related programmes from the knowledge graph.
 *
 * One request rather than six because the target device is on a metered, slow
 * connection where six round trips is a visibly worse experience.
 */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { slug } = await context.params;
    const session = await getFullSession();
    const profile = session ? toEligibilityProfile({ user: session.user, profile: session.profile }) : {};

    // Retrieve this programme's own passages so the confidence score reflects
    // the evidence actually available for it.
    const retrieved = await retrieve(slug.replace(/-/g, ' '), { limit: 6, perOpportunityLimit: 6 });

    const item = await getOpportunityBySlug(slug, profile, session?.userId ?? null, retrieved);
    if (!item) return fail(ERROR_CODES.NOT_FOUND, 'That programme could not be found.');

    const [related, sourceDocs, locations] = await Promise.all([
      getRelated(item.opportunity.id, 6),
      db
        .select({
          id: documents.id,
          title: documents.title,
          titleBn: documents.titleBn,
          sourceType: documents.sourceType,
          sourceUrl: documents.sourceUrl,
          publisher: documents.publisher,
          retrievedAt: documents.retrievedAt,
          licenseNote: documents.licenseNote,
          verificationStatus: documents.verificationStatus,
          stale: documents.stale,
        })
        .from(documents)
        .where(eq(documents.opportunityId, item.opportunity.id)),
      nearbyOffices(item.opportunity.slug, profile.district ?? null),
    ]);

    // Fire and forget: a view counter must never delay or fail the page.
    void recordView(item.opportunity.id).catch(() => undefined);
    if (session) {
      void recordEvaluation(
        session.userId,
        item.opportunity.id,
        item.evaluation,
        profile,
        item.confidence.score,
      ).catch(() => undefined);
    }

    return ok({
      opportunity: item.opportunity,
      organization: item.organization,
      documents: item.documents,
      eligibility: {
        outcome: item.evaluation.outcome,
        score: item.evaluation.score,
        ruleCoverage: item.evaluation.ruleCoverage,
        ruleVersion: item.evaluation.ruleVersion,
        missingFields: item.evaluation.missingFields,
        matched: item.evaluation.matched,
        failed: item.evaluation.failed,
        unknown: item.evaluation.unknown,
        softFailed: item.evaluation.softFailed,
        trace: item.evaluation.trace,
      },
      confidence: item.confidence,
      citations: retrieved
        .filter((c) => c.opportunityId === item.opportunity.id)
        .map((c) => ({ chunkId: c.chunkId, excerpt: c.content.slice(0, 400), sourceUrl: c.sourceUrl })),
      sourceDocuments: sourceDocs,
      nearbyOffices: locations,
      related,
      saved: item.saved,
      personalised: Boolean(session),
    });
  }, 'opportunities/[slug]:get');
}

/**
 * Offices that list this programme among their services, nearest first.
 *
 * The `services` column is a short JSON array, so it is filtered in process
 * after a district-scoped read rather than with a `json_each` subquery — the
 * candidate set is at most a few hundred rows and this keeps the query portable
 * to PostgreSQL without rewriting SQLite-specific JSON functions.
 */
async function nearbyOffices(slug: string, district: string | null) {
  const candidates = await db
    .select()
    .from(serviceLocations)
    .where(district ? eq(serviceLocations.district, district) : undefined)
    .limit(400);

  const matching = candidates.filter((location) => location.services.includes(slug));
  const reference = district ? getDistrict(district) : undefined;

  const withDistance = matching.map((location) => ({
    ...location,
    distanceKm: reference
      ? Math.round(haversineKm(reference, { lat: location.lat, lng: location.lng }) * 10) / 10
      : null,
  }));

  return withDistance
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    .slice(0, 8);
}

export const dynamic = 'force-dynamic';
