import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { budgetAllocations, allocationFlags, userProfiles, unionBoundaries, users } from '@/lib/db/schema';
import type { BudgetAllocation } from '@/lib/db/schema';
import { appendLedgerEntry, getLedgerEntriesFor } from '@/modules/ledger/ledger.service';
import { flagRatio, shouldEscalate } from './escalation-rules';
import { escalateAllocation } from './escalation.service';

/**
 * SJ-12 — budget allocations, and SJ-16/17 — citizen flagging with an
 * escalation check on every flag. Posting anchors the allocation into the
 * financial ledger immediately; nothing about an allocation's core facts
 * (project, amount, union, date) can be edited after the fact without that
 * edit being its own new, separately-anchored event — this module has no
 * "update allocation" function at all, on purpose.
 */

export interface CreateAllocationInput {
  readonly unionId: string;
  readonly postedBy: string;
  readonly projectName: string;
  readonly description: string;
  readonly amount: number;
  readonly allocationDate: Date;
}

export async function createAllocation(input: CreateAllocationInput): Promise<BudgetAllocation> {
  const [row] = await db
    .insert(budgetAllocations)
    .values({
      unionId: input.unionId,
      postedBy: input.postedBy,
      projectName: input.projectName,
      description: input.description,
      amount: input.amount,
      allocationDate: input.allocationDate,
    })
    .returning();

  await appendLedgerEntry('budget_allocation', row!.id, {
    unionId: row!.unionId,
    postedBy: row!.postedBy,
    projectName: row!.projectName,
    amount: row!.amount,
    allocationDate: row!.allocationDate.toISOString(),
  });

  return row!;
}

export async function listAllocationsForUnion(unionId: string) {
  return db
    .select({ allocation: budgetAllocations, posterName: users.name })
    .from(budgetAllocations)
    .innerJoin(users, eq(budgetAllocations.postedBy, users.id))
    .where(eq(budgetAllocations.unionId, unionId))
    .orderBy(desc(budgetAllocations.allocationDate));
}

export async function getAllocation(allocationId: string) {
  const [row] = await db
    .select({
      allocation: budgetAllocations,
      posterName: users.name,
      unionName: unionBoundaries.name,
      unionNameBn: unionBoundaries.nameBn,
    })
    .from(budgetAllocations)
    .innerJoin(users, eq(budgetAllocations.postedBy, users.id))
    .innerJoin(unionBoundaries, eq(budgetAllocations.unionId, unionBoundaries.id))
    .where(eq(budgetAllocations.id, allocationId))
    .limit(1);
  if (!row) return null;

  const [ledger, ratio] = await Promise.all([
    getLedgerEntriesFor('budget_allocation', allocationId),
    computeFlagRatio(row.allocation),
  ]);

  return { ...row, ledger, ...ratio };
}

async function verifiedResidentCountFor(unionId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(userProfiles)
    .where(eq(userProfiles.residencyUnionId, unionId));
  return Number(row?.n ?? 0);
}

async function computeFlagRatio(allocation: BudgetAllocation) {
  const verifiedResidentCount = await verifiedResidentCountFor(allocation.unionId);
  return {
    flagCount: allocation.flagCount,
    verifiedResidentCount,
    ratio: flagRatio(allocation.flagCount, verifiedResidentCount),
  };
}

export interface FlagResult {
  readonly alreadyFlagged: boolean;
  readonly flagCount: number;
  readonly verifiedResidentCount: number;
  readonly ratio: number;
  readonly escalated: boolean;
}

/** SJ-16/17/18 — flag, recompute the ratio, and escalate the first time it crosses the threshold. */
export async function flagAllocation(allocationId: string, userId: string, reason?: string | null): Promise<FlagResult | null> {
  const [allocation] = await db.select().from(budgetAllocations).where(eq(budgetAllocations.id, allocationId)).limit(1);
  if (!allocation) return null;

  const [existing] = await db
    .select({ id: allocationFlags.id })
    .from(allocationFlags)
    .where(and(eq(allocationFlags.allocationId, allocationId), eq(allocationFlags.userId, userId)))
    .limit(1);

  if (existing) {
    const ratio = await computeFlagRatio(allocation);
    return { alreadyFlagged: true, ...ratio, escalated: allocation.escalated };
  }

  await db.insert(allocationFlags).values({ allocationId, userId, reason: reason ?? null });
  const [updated] = await db
    .update(budgetAllocations)
    .set({ flagCount: allocation.flagCount + 1, updatedAt: new Date() })
    .where(eq(budgetAllocations.id, allocationId))
    .returning();

  const ratio = await computeFlagRatio(updated!);
  let escalated = updated!.escalated;

  if (!escalated && shouldEscalate(ratio.flagCount, ratio.verifiedResidentCount)) {
    await escalateAllocation(updated!, ratio);
    escalated = true;
  }

  return { alreadyFlagged: false, ...ratio, escalated };
}
