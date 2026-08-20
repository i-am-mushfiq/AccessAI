import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { escalations, unionBoundaries, users, budgetAllocations } from '@/lib/db/schema';
import type { BudgetAllocation } from '@/lib/db/schema';
import type { EscalationStatus } from '@/lib/domain/enums';
import { createNotification } from '@/modules/citizen/citizen.service';

/**
 * SJ-18 — "the escalation has to land somewhere real." Resolves the
 * allocation's union to its upazila, then to whichever user is assigned
 * `upazila_officer` for that exact upazila (users.civicUpazila). If nobody
 * is assigned yet, the escalation is still recorded — with a null officer —
 * rather than silently dropped: an unresolved escalation is a real, visible
 * gap an administrator can see and fix by assigning one, not a notification
 * that quietly went nowhere.
 */
export async function escalateAllocation(
  allocation: BudgetAllocation,
  ratio: { readonly flagCount: number; readonly verifiedResidentCount: number; readonly ratio: number },
) {
  const [union] = await db
    .select({ upazila: unionBoundaries.upazila, name: unionBoundaries.name })
    .from(unionBoundaries)
    .where(eq(unionBoundaries.id, allocation.unionId))
    .limit(1);

  const officer = union
    ? (
        await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.civicRole, 'upazila_officer'), eq(users.civicUpazila, union.upazila)))
          .limit(1)
      )[0]
    : undefined;

  const [row] = await db
    .insert(escalations)
    .values({
      allocationId: allocation.id,
      upazilaOfficerId: officer?.id ?? null,
      flagCount: ratio.flagCount,
      verifiedResidentCount: ratio.verifiedResidentCount,
      ratio: ratio.ratio,
      status: 'pending',
    })
    .returning();

  await db.update(budgetAllocations).set({ escalated: true, updatedAt: new Date() }).where(eq(budgetAllocations.id, allocation.id));

  if (officer) {
    await createNotification({
      userId: officer.id,
      type: 'system',
      title: [
        `Flagged allocation needs review: ${allocation.projectName}`,
        `পতাকাঙ্কিত বরাদ্দ পর্যালোচনা দরকার: ${allocation.projectName}`,
      ],
      body: [
        `${ratio.flagCount} of ${ratio.verifiedResidentCount} verified residents in ${union?.name ?? 'this union'} have flagged this allocation as suspect.`,
        `${union?.name ?? 'এই ইউনিয়নের'}-এর ${ratio.verifiedResidentCount} জন যাচাইকৃত বাসিন্দার মধ্যে ${ratio.flagCount} জন এই বরাদ্দটি সন্দেহজনক বলে চিহ্নিত করেছেন।`,
      ],
      actionUrl: `/budget/${allocation.id}`,
    });
  }

  return row!;
}

export async function listEscalationsForOfficer(officerId: string) {
  return db
    .select({ escalation: escalations, allocation: budgetAllocations })
    .from(escalations)
    .innerJoin(budgetAllocations, eq(escalations.allocationId, budgetAllocations.id))
    .where(eq(escalations.upazilaOfficerId, officerId))
    .orderBy(desc(escalations.createdAt));
}

/**
 * Escalations with no officer assigned at all (the union's upazila had none
 * when the threshold was crossed) — visible to any upazila officer so one of
 * them can claim it. Distinct from `listEscalationsForOfficer`, which is
 * scoped to escalations already routed to a specific officer; without the
 * `isNull` filter this would just re-list everyone's own pending items.
 */
export async function listUnassignedEscalations() {
  return db
    .select({ escalation: escalations, allocation: budgetAllocations })
    .from(escalations)
    .innerJoin(budgetAllocations, eq(escalations.allocationId, budgetAllocations.id))
    .where(and(isNull(escalations.upazilaOfficerId), eq(escalations.status, 'pending')))
    .orderBy(desc(escalations.createdAt));
}

export async function resolveEscalation(
  escalationId: string,
  officerId: string,
  status: Extract<EscalationStatus, 'acknowledged' | 'resolved' | 'dismissed'>,
  note?: string | null,
) {
  const [existing] = await db.select().from(escalations).where(eq(escalations.id, escalationId)).limit(1);
  if (!existing) return null;
  // An officer may only act on an escalation actually routed to them —
  // except claiming an unassigned one, which is how the gap above gets closed.
  if (existing.upazilaOfficerId && existing.upazilaOfficerId !== officerId) return { forbidden: true as const };

  const [updated] = await db
    .update(escalations)
    .set({
      status,
      note: note ?? existing.note,
      upazilaOfficerId: existing.upazilaOfficerId ?? officerId,
      resolvedAt: status === 'resolved' || status === 'dismissed' ? new Date() : existing.resolvedAt,
    })
    .where(eq(escalations.id, escalationId))
    .returning();

  return updated!;
}
