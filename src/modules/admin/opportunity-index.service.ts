import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { opportunities, organizations, documents, documentChunks } from '@/lib/db/schema';
import { chunkText, termFrequencies, estimateTokens } from '@/modules/knowledge/tokenizer';

/** Rebuilds the retrieval document after an admin programme edit. */
export async function indexOpportunity(opportunityId: string): Promise<number> {
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
    `# ${o.title}`, o.summary, o.description,
    `## Benefits\n${o.benefits}`,
    `## How to apply\n${o.applicationProcess.map((s) => `${s.step}. ${s.en}`).join('\n')}`,
  ].join('\n\n');
  const bodyBn = [
    `# ${o.titleBn}`, o.summaryBn, o.descriptionBn,
    `## সুবিধা\n${o.benefitsBn}`,
    `## আবেদনের ধাপ\n${o.applicationProcess.map((s) => `${s.step}. ${s.bn}`).join('\n')}`,
  ].join('\n\n');

  const [document] = await db.insert(documents).values({
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
  }).returning();

  const chunks = [...chunkText(bodyEn), ...chunkText(bodyBn)];
  if (chunks.length > 0) {
    await db.insert(documentChunks).values(chunks.map((content, index) => ({
      documentId: document!.id,
      opportunityId,
      chunkIndex: index,
      content,
      tokenCount: estimateTokens(content),
      termFrequencies: termFrequencies(content),
      metadata: { slug: o.slug, category: o.category, title: o.title, titleBn: o.titleBn },
    })));
  }
  return chunks.length;
}
