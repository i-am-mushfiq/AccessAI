import type { NextRequest } from 'next/server';
import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { opportunities, eligibilityRules, organizations, documents } from '@/lib/db/schema';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireFullSession } from '@/lib/http/session';
import { eligibilityCheckSchema } from '@/lib/validation/schemas';
import { evaluateEligibility } from '@/modules/eligibility/engine';
import { toEligibilityProfile } from '@/modules/eligibility/profile-mapper';
import { recordEvaluation } from '@/modules/opportunities/opportunity.service';
import { scoreConfidence } from '@/modules/ai/confidence';

/**
 * POST /api/v1/eligibility/check
 *
 * Supports "what if" checking: `overrides` are layered over the stored profile
 * for this evaluation only and are NOT saved. That lets a citizen test whether
 * a change would qualify them ("what if my income were lower?") without
 * corrupting the profile that drives every other decision.
 *
 * Only a real (non-overridden) evaluation is persisted to the audit trail —
 * recording hypotheticals as decisions would make the trail misleading.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireFullSession();
    if (!guard.ok) return guard.response;

    const body = eligibilityCheckSchema.parse(await readJson(request));

    const [row] = await db
      .select({ opportunity: opportunities, organization: organizations })
      .from(opportunities)
      .innerJoin(organizations, eq(opportunities.organizationId, organizations.id))
      .where(body.slug ? eq(opportunities.slug, body.slug) : eq(opportunities.id, body.opportunityId!))
      .limit(1);

    if (!row) return fail(ERROR_CODES.NOT_FOUND, 'That programme could not be found.');

    const [rule] = await db
      .select()
      .from(eligibilityRules)
      .where(and(eq(eligibilityRules.opportunityId, row.opportunity.id), eq(eligibilityRules.active, true)))
      .orderBy(desc(eligibilityRules.priority), desc(eligibilityRules.version))
      .limit(1);

    if (!rule) {
      // PRD §50 names this exact error code.
      return fail(
        ERROR_CODES.ELIGIBILITY_RULE_NOT_FOUND,
        'Eligibility rules are unavailable for this opportunity.',
      );
    }

    const isHypothetical = Boolean(body.overrides && Object.keys(body.overrides).length > 0);
    const profile = toEligibilityProfile({
      user: guard.session.user,
      profile: guard.session.profile,
      ...(body.overrides ? { overrides: body.overrides as never } : {}),
    });

    const evaluation = evaluateEligibility(rule.ruleJson, profile, { ruleVersion: rule.version });

    // This path performs no retrieval — the programme's own record is the source.
    // Passing `directRecord` says so, instead of leaving an empty `retrieved`
    // list to be misread as "we searched and found nothing".
    const [indexed] = await db
      .select({ n: sql<number>`count(*)` })
      .from(documents)
      .where(eq(documents.opportunityId, row.opportunity.id));

    const confidence = scoreConfidence({
      retrieved: [],
      directRecord: { indexedDocuments: Number(indexed?.n ?? 0) },
      evaluation,
      verificationStatus: row.opportunity.verificationStatus,
      lastVerifiedAt: row.opportunity.lastVerifiedAt,
      hasSourceUrl: Boolean(row.opportunity.sourceUrl),
      hasRequiredDocuments: true,
      hasApplicationSteps: row.opportunity.applicationProcess.length > 0,
    });

    if (!isHypothetical) {
      await recordEvaluation(guard.session.userId, row.opportunity.id, evaluation, profile, confidence.score);
    }

    return ok({
      opportunity: {
        id: row.opportunity.id,
        slug: row.opportunity.slug,
        title: row.opportunity.title,
        titleBn: row.opportunity.titleBn,
        verificationStatus: row.opportunity.verificationStatus,
      },
      organization: { name: row.organization.name, nameBn: row.organization.nameBn },
      eligibility: evaluation,
      confidence,
      hypothetical: isHypothetical,
      /** The rule set itself, so the UI can show "these are the conditions". */
      rules: { version: rule.version, requiredFields: rule.ruleJson.requiredFields, notes: rule.ruleJson.notes ?? null },
    });
  }, 'eligibility/check');
}

export const dynamic = 'force-dynamic';
