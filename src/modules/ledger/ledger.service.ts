import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { ledgerEntries } from '@/lib/db/schema';
import type { LedgerEntityType } from '@/lib/domain/enums';
import { GENESIS_HASH, computeEntryHash, verifyChain, type ChainVerificationResult } from './hash-chain';

/**
 * SJ-13/14 — the financial hash-chain: every budget allocation and every
 * disbursement is anchored here, in creation order, each entry's hash
 * folding in the one before it.
 *
 * Single-writer caveat (see docs/DEVIATIONS.md): `prevHash` is read then
 * written in two separate statements, so two concurrent appends could both
 * read the same "last" hash and race. The unique index on `prevHash`
 * (schema.ts) turns that race from a silent fork into a loud insert failure
 * rather than corrupted-looking data — acceptable at this write volume, not
 * a substitute for a serialised writer at real scale.
 */
export async function appendLedgerEntry(
  entityType: LedgerEntityType,
  entityId: string,
  payload: Record<string, unknown>,
) {
  const [last] = await db
    .select({ entryHash: ledgerEntries.entryHash })
    .from(ledgerEntries)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(1);
  const prevHash = last?.entryHash ?? GENESIS_HASH;
  const entryHash = computeEntryHash(prevHash, { entityType, entityId, payload });

  const [row] = await db
    .insert(ledgerEntries)
    .values({ entityType, entityId, payload, prevHash, entryHash })
    .returning();
  return row!;
}

export async function getLedgerEntriesFor(entityType: LedgerEntityType, entityId: string) {
  return db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.entityType, entityType), eq(ledgerEntries.entityId, entityId)))
    .orderBy(asc(ledgerEntries.createdAt));
}

/** Walks the WHOLE financial chain — the real, independently-runnable check. */
export async function verifyLedgerChain(): Promise<ChainVerificationResult> {
  const rows = await db.select().from(ledgerEntries).orderBy(asc(ledgerEntries.createdAt));
  return verifyChain(rows, (row) => ({ entityType: row.entityType, entityId: row.entityId, payload: row.payload }));
}
