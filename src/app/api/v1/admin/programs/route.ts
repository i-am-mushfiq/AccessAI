import type { NextRequest } from 'next/server';
import { desc, eq, sql, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { opportunities, organizations, eligibilityRules, documents, documentChunks } from '@/lib/db/schema';
import { ok, readJson, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireStaff } from '@/lib/http/session';
import { upsertOpportunitySchema, parseQuery } from '@/lib/validation/schemas';
import { recordAudit } from '@/modules/admin/admin.service';
import { chunkText, termFrequencies, estimateTokens } from '@/modules/knowledge/tokenizer';
import { z } from 'zod';

const listSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.string().optional(),
  verification: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * GET  /api/v1/admin/programs — management list, unfiltered by citizen rules
 * POST /api/v1/admin/programs — create a programme
 *
 * A new programme is created as a DRAFT with `unverified_sample` status, and
 * cannot be published as `verified` in the same request. PRD §34 requires
 * administrative review before verified knowledge changes, and letting an author
 * self-certify in the create call would bypass that entirely.
 */

export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const query = parseQuery(listSchema, new URL(request.url));
    const conditions = [];
    if (query.q) {
      conditions.push(
        sql`(lower(${opportunities.title}) LIKE ${`%${query.q.toLowerCase()}%`} OR ${opportunities.titleBn} LIKE ${`%${query.q}%`} OR ${opportunities.slug} LIKE ${`%${query.q}%`})`,
      );
    }
    if (query.status) conditions.push(eq(opportunities.status, query.status as never));
    if (query.verification) conditions.push(eq(opportunities.verificationStatus, query.verification as never));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        opportunity: opportunities,
        organizationName: organizations.name,
        // Whether a rule exists at all is the single most useful column here:
        // a programme without one can never return anything but "unknown".
        ruleCount: sql<number>`(SELECT count(*) FROM ${eligibilityRules} WHERE ${eligibilityRules.opportunityId} = ${opportunities.id} AND ${eligibilityRules.active} = 1)`,
      })
      .from(opportunities)
      .innerJoin(organizations, eq(opportunities.organizationId, organizations.id))
      .where(where)
      .orderBy(desc(opportunities.updatedAt))
      .limit(query.limit ?? 50)
      .offset(query.offset ?? 0);

    const [total] = await db.select({ n: sql<number>`count(*)` }).from(opportunities).where(where);

    return ok({ items: rows }, { meta: { total: Number(total?.n ?? 0) } });
  }, 'admin/programs:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const body = upsertOpportunitySchema.parse(await readJson(request));

    const [existingSlug] = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(eq(opportunities.slug, body.slug))
      .limit(1);
    if (existingSlug) {
      return fail(ERROR_CODES.CONFLICT, 'A programme with that web address already exists.', {
        fields: { slug: 'Choose a different slug.' },
      });
    }

    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, body.organizationId))
      .limit(1);
    if (!org) {
      return fail(ERROR_CODES.VALIDATION_FAILED, 'That organisation does not exist.', {
        fields: { organizationId: 'Choose an organisation from the list.' },
      });
    }

    const [created] = await db
      .insert(opportunities)
      .values({
        ...body,
        coverageDistricts: body.coverageDistricts,
        lifeEvents: body.lifeEvents,
        tags: body.tags,
        // A new record is never born verified.
        status: 'draft',
        verificationStatus: 'unverified_sample',
        lastVerifiedAt: null,
        verifiedBy: null,
        version: 1,
      })
      .returning();

    await indexOpportunity(created!.id);

    await recordAudit({
      actorId: guard.session.userId,
      actorRole: guard.session.role,
      action: 'programme.create',
      entityType: 'opportunity',
      entityId: created!.id,
      after: created as unknown as Record<string, unknown>,
    });

    return ok({ opportunity: created }, { status: 201 });
  }, 'admin/programs:post');
}

/**
 * Regenerates the retrieval document and chunks for a programme.
 *
 * Called on create and on update, because a programme whose text has changed but
 * whose index has not will be retrieved for the old wording and cited with the
 * new — a subtle way to produce an answer that does not match its own source.
 */
async function indexOpportunity(opportunityId: string): Promise<number> {
  const [row] = await db
    .select({ opportunity: opportunities, organizationName: organizations.name })
    .from(opportunities)
    .innerJoin(organizations, eq(opportunities.organizationId, organizations.id))
    .where(eq(opportunities.id, opportunityId))
    .limit(1);
  if (!row) return 0;

  const o = row.opportunity;

  const existing = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.opportunityId, opportunityId));
  if (existing.length > 0) {
    await db.delete(documentChunks).where(inArray(documentChunks.documentId, existing.map((d) => d.id)));
    await db.delete(documents).where(eq(documents.opportunityId, opportunityId));
  }

  const bodyEn = [
    `# ${o.title}`,
    o.summary,
    o.description,
    `## Benefits\n${o.benefits}`,
    `## How to apply\n${o.applicationProcess.map((s) => `${s.step}. ${s.en}`).join('\n')}`,
  ].join('\n\n');
  const bodyBn = [
    `# ${o.titleBn}`,
    o.summaryBn,
    o.descriptionBn,
    `## সুবিধা\n${o.benefitsBn}`,
    `## আবেদনের ধাপ\n${o.applicationProcess.map((s) => `${s.step}. ${s.bn}`).join('\n')}`,
  ].join('\n\n');

  const [document] = await db
    .insert(documents)
    .values({
      opportunityId,
      organizationId: o.organizationId,
      title: o.title,
      titleBn: o.titleBn,
      sourceType: 'manual_entry',
      sourceUrl: o.sourceUrl,
      publisher: row.organizationName,
      retrievedAt: new Date(),
      textContent: `${bodyEn}\n\n---\n\n${bodyBn}`,
      embeddingStatus: 'pending',
      verificationStatus: o.verificationStatus,
      licenseNote: 'Authored summary maintained in the AccessAI admin portal.',
    })
    .returning();

  const chunks = [...chunkText(bodyEn), ...chunkText(bodyBn)];
  if (chunks.length > 0) {
    await db.insert(documentChunks).values(
      chunks.map((content, index) => ({
        documentId: document!.id,
        opportunityId,
        chunkIndex: index,
        content,
        tokenCount: estimateTokens(content),
        termFrequencies: termFrequencies(content),
        metadata: { slug: o.slug, category: o.category, title: o.title, titleBn: o.titleBn },
      })),
    );
  }
  return chunks.length;
}

export const dynamic = 'force-dynamic';
