import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  savedOpportunities, savedStatusHistory, actionPlans, actionPlanTasks,
  timelineEvents, notifications, opportunities, organizations, requiredDocuments,
} from '@/lib/db/schema';
import type { SavedStatus as SavedStatusEnum, TaskStatus, NotificationType } from '@/lib/domain/enums';
import { addDays, startOfDay } from '@/lib/format/dates';

/**
 * Citizen activity: saved programmes, action plans, timeline, notifications.
 *
 * PRD Features 7, 13, 14, 18. Grouped in one service because they are one
 * causal chain — saving a programme generates a plan, a plan generates timeline
 * entries, and timeline entries generate notifications — and splitting them
 * across four services would spread that chain over four files without making
 * any of them independently useful.
 */

/* ---------------------------------------------------------------- saved */

export async function saveOpportunity(input: {
  userId: string;
  opportunityId: string;
  status?: SavedStatusEnum;
  note?: string | null;
}) {
  const [existing] = await db
    .select()
    .from(savedOpportunities)
    .where(
      and(eq(savedOpportunities.userId, input.userId), eq(savedOpportunities.opportunityId, input.opportunityId)),
    )
    .limit(1);

  if (existing) {
    // Saving something already saved is not an error — it is a citizen tapping
    // twice. Return the existing record so the UI stays consistent.
    return { saved: existing, created: false };
  }

  const [row] = await db
    .insert(savedOpportunities)
    .values({
      userId: input.userId,
      opportunityId: input.opportunityId,
      status: input.status ?? 'interested',
      note: input.note ?? null,
    })
    .returning();

  await db.insert(savedStatusHistory).values({
    savedId: row!.id,
    fromStatus: null,
    toStatus: row!.status,
  });

  await db
    .update(opportunities)
    .set({ saveCount: sql`${opportunities.saveCount} + 1` })
    .where(eq(opportunities.id, input.opportunityId));

  return { saved: row!, created: true };
}

export async function updateSaved(input: {
  userId: string;
  savedId: string;
  status?: SavedStatusEnum;
  note?: string | null;
}) {
  const [existing] = await db
    .select()
    .from(savedOpportunities)
    .where(and(eq(savedOpportunities.id, input.savedId), eq(savedOpportunities.userId, input.userId)))
    .limit(1);
  if (!existing) return null;

  const patch: Partial<typeof savedOpportunities.$inferInsert> = { updatedAt: new Date() };
  if (input.status !== undefined) patch.status = input.status;
  if (input.note !== undefined) patch.note = input.note;

  const [updated] = await db
    .update(savedOpportunities)
    .set(patch)
    .where(eq(savedOpportunities.id, input.savedId))
    .returning();

  if (input.status && input.status !== existing.status) {
    await db.insert(savedStatusHistory).values({
      savedId: existing.id,
      fromStatus: existing.status,
      toStatus: input.status,
    });

    // Reaching "applied" is the conversion event the platform exists to cause.
    if (input.status === 'applied') {
      await db
        .update(opportunities)
        .set({ applicationCount: sql`${opportunities.applicationCount} + 1` })
        .where(eq(opportunities.id, existing.opportunityId));
      await createNotification({
        userId: input.userId,
        type: 'application_reminder',
        title: ['Application recorded', 'আবেদন রেকর্ড হয়েছে'],
        body: [
          'We will remind you to check the status. Keep your receipt safe.',
          'অবস্থা দেখতে আমরা আপনাকে মনে করিয়ে দেব। রসিদটি সংরক্ষণে রাখুন।',
        ],
      });
      // A status check reminder two weeks out, which is when most offices can
      // actually tell the citizen something.
      await db.insert(timelineEvents).values({
        userId: input.userId,
        opportunityId: existing.opportunityId,
        type: 'application_progress',
        title: 'Check application status',
        titleBn: 'আবেদনের অবস্থা দেখুন',
        eventDate: addDays(new Date(), 14),
        source: 'system',
      });
    }
  }

  return updated!;
}

export async function removeSaved(userId: string, savedId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: savedOpportunities.id, opportunityId: savedOpportunities.opportunityId })
    .from(savedOpportunities)
    .where(and(eq(savedOpportunities.id, savedId), eq(savedOpportunities.userId, userId)))
    .limit(1);
  if (!existing) return false;

  await db.delete(savedOpportunities).where(eq(savedOpportunities.id, savedId));
  await db
    .update(opportunities)
    .set({ saveCount: sql`max(0, ${opportunities.saveCount} - 1)` })
    .where(eq(opportunities.id, existing.opportunityId));
  return true;
}

export async function listSaved(userId: string, status?: SavedStatusEnum) {
  const conditions = [eq(savedOpportunities.userId, userId)];
  if (status) conditions.push(eq(savedOpportunities.status, status));

  return db
    .select({
      saved: savedOpportunities,
      opportunity: opportunities,
      organization: organizations,
    })
    .from(savedOpportunities)
    .innerJoin(opportunities, eq(savedOpportunities.opportunityId, opportunities.id))
    .innerJoin(organizations, eq(opportunities.organizationId, organizations.id))
    .where(and(...conditions))
    .orderBy(desc(savedOpportunities.updatedAt));
}

export async function savedCounts(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: savedOpportunities.status, n: sql<number>`count(*)` })
    .from(savedOpportunities)
    .where(eq(savedOpportunities.userId, userId))
    .groupBy(savedOpportunities.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

/* ---------------------------------------------------------- action plans */

/**
 * Builds a plan from the programme's OWN application steps and document list.
 *
 * Deliberately deterministic: PRD §33 forbids inventing a step, an office, or a
 * fee, so the task list is a transformation of verified data rather than a
 * generated one. Dates are spaced so a citizen is never asked to visit two
 * offices on the same day, and the deadline is respected if there is one.
 */
export async function generateActionPlan(userId: string, opportunityId: string) {
  const [existing] = await db
    .select()
    .from(actionPlans)
    .where(and(eq(actionPlans.userId, userId), eq(actionPlans.opportunityId, opportunityId)))
    .limit(1);
  if (existing) {
    const tasks = await db
      .select()
      .from(actionPlanTasks)
      .where(eq(actionPlanTasks.planId, existing.id))
      .orderBy(asc(actionPlanTasks.sortOrder));
    return { plan: existing, tasks, created: false };
  }

  const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (!opportunity) return null;

  const docs = await db
    .select()
    .from(requiredDocuments)
    .where(eq(requiredDocuments.opportunityId, opportunityId))
    .orderBy(asc(requiredDocuments.sortOrder));

  const [plan] = await db
    .insert(actionPlans)
    .values({
      userId,
      opportunityId,
      title: `Apply for ${opportunity.title}`,
      titleBn: `${opportunity.titleBn} এর জন্য আবেদন`,
      status: 'active',
      generatedBy: 'simulated',
    })
    .returning();

  const today = startOfDay(new Date());
  const tasks: (typeof actionPlanTasks.$inferInsert)[] = [];
  let order = 0;
  let dayOffset = 0;

  // Documents first: nothing else can proceed without them, and collecting
  // each one is a separate trip in practice.
  for (const doc of docs.filter((d) => d.required)) {
    tasks.push({
      planId: plan!.id,
      title: `Collect: ${doc.name}`,
      titleBn: `সংগ্রহ করুন: ${doc.nameBn}`,
      description: doc.issuingAuthority ? `Issued by ${doc.issuingAuthority}.` : null,
      descriptionBn: doc.issuingAuthorityBn ? `${doc.issuingAuthorityBn} থেকে পাওয়া যায়।` : null,
      dueDate: addDays(today, dayOffset),
      priority: 'high',
      estimatedMinutes: 90,
      status: 'pending',
      sortOrder: order,
      notes: doc.commonMistake ? `Common mistake: ${doc.commonMistake}` : null,
    });
    order += 1;
    // Two documents per day at most: each usually means a queue at an office.
    if (order % 2 === 0) dayOffset += 1;
  }

  for (const step of opportunity.applicationProcess) {
    dayOffset += 1;
    tasks.push({
      planId: plan!.id,
      title: step.en,
      titleBn: step.bn,
      dueDate: addDays(today, dayOffset),
      priority: step.step === opportunity.applicationProcess.length ? 'high' : 'medium',
      estimatedMinutes: 60,
      status: 'pending',
      sortOrder: order,
    });
    order += 1;
  }

  // If there is a deadline, compress the schedule so the final task lands
  // before it. A plan that finishes after the deadline is worse than useless.
  if (opportunity.deadline) {
    const lastDue = tasks[tasks.length - 1]?.dueDate;
    if (lastDue instanceof Date && lastDue.getTime() > opportunity.deadline.getTime()) {
      const available = Math.max(1, Math.floor((opportunity.deadline.getTime() - today.getTime()) / 86_400_000) - 1);
      const scale = available / Math.max(1, dayOffset);
      for (const [index, task] of tasks.entries()) {
        const offset = Math.min(available, Math.round((index / Math.max(1, tasks.length - 1)) * available * scale));
        task.dueDate = addDays(today, Math.max(0, offset));
      }
    }
  }

  const inserted = tasks.length > 0 ? await db.insert(actionPlanTasks).values(tasks).returning() : [];

  // Mirror the plan onto the timeline so the calendar and the plan agree.
  if (inserted.length > 0) {
    await db.insert(timelineEvents).values(
      inserted
        .filter((t) => t.dueDate)
        .map((t) => ({
          userId,
          opportunityId,
          taskId: t.id,
          type: 'task' as const,
          title: t.title,
          titleBn: t.titleBn,
          eventDate: t.dueDate!,
          source: 'system' as const,
        })),
    );
  }

  if (opportunity.deadline) {
    await db.insert(timelineEvents).values({
      userId,
      opportunityId,
      type: 'deadline',
      title: `Deadline: ${opportunity.title}`,
      titleBn: `শেষ তারিখ: ${opportunity.titleBn}`,
      eventDate: opportunity.deadline,
      source: 'system',
    });
  }

  await saveOpportunity({ userId, opportunityId, status: 'preparing' });

  return { plan: plan!, tasks: inserted, created: true };
}

export async function listActionPlans(userId: string) {
  const plans = await db
    .select({ plan: actionPlans, opportunity: opportunities })
    .from(actionPlans)
    .innerJoin(opportunities, eq(actionPlans.opportunityId, opportunities.id))
    .where(eq(actionPlans.userId, userId))
    .orderBy(desc(actionPlans.updatedAt));

  if (plans.length === 0) return [];

  const tasks = await db
    .select()
    .from(actionPlanTasks)
    .where(inArray(actionPlanTasks.planId, plans.map((p) => p.plan.id)))
    .orderBy(asc(actionPlanTasks.sortOrder));

  return plans.map((entry) => ({
    ...entry,
    tasks: tasks.filter((t) => t.planId === entry.plan.id),
  }));
}

export async function updateTask(input: {
  userId: string;
  taskId: string;
  status?: TaskStatus;
  notes?: string | null;
  dueDate?: Date | null;
}) {
  // Ownership is enforced by joining through the plan — a task id alone must
  // never be enough to modify another citizen's plan.
  const [row] = await db
    .select({ task: actionPlanTasks, planUserId: actionPlans.userId, planId: actionPlans.id })
    .from(actionPlanTasks)
    .innerJoin(actionPlans, eq(actionPlanTasks.planId, actionPlans.id))
    .where(eq(actionPlanTasks.id, input.taskId))
    .limit(1);

  if (!row || row.planUserId !== input.userId) return null;

  const patch: Partial<typeof actionPlanTasks.$inferInsert> = {};
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.completedAt = input.status === 'done' ? new Date() : null;
  }
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate;

  const [updated] = await db
    .update(actionPlanTasks)
    .set(patch)
    .where(eq(actionPlanTasks.id, input.taskId))
    .returning();

  // Keep the mirrored timeline entry in step.
  if (input.status !== undefined) {
    await db
      .update(timelineEvents)
      .set({ completed: input.status === 'done' })
      .where(eq(timelineEvents.taskId, input.taskId));
  }

  // Completing every task completes the plan — the "Completed Action Plans"
  // success metric in PRD §17.
  const remaining = await db
    .select({ n: sql<number>`count(*)` })
    .from(actionPlanTasks)
    .where(and(eq(actionPlanTasks.planId, row.planId), inArray(actionPlanTasks.status, ['pending', 'in_progress'])));

  if (Number(remaining[0]?.n ?? 0) === 0) {
    await db
      .update(actionPlans)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(actionPlans.id, row.planId));
  } else {
    await db.update(actionPlans).set({ updatedAt: new Date() }).where(eq(actionPlans.id, row.planId));
  }

  return updated!;
}

/* -------------------------------------------------------------- timeline */

export async function listTimeline(input: {
  userId: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const conditions = [eq(timelineEvents.userId, input.userId)];
  if (input.from) conditions.push(gte(timelineEvents.eventDate, input.from));
  if (input.to) conditions.push(lte(timelineEvents.eventDate, input.to));

  return db
    .select({ event: timelineEvents, opportunity: opportunities })
    .from(timelineEvents)
    .leftJoin(opportunities, eq(timelineEvents.opportunityId, opportunities.id))
    .where(and(...conditions))
    .orderBy(asc(timelineEvents.eventDate))
    .limit(input.limit ?? 200);
}

/**
 * Adds deadline entries for every saved programme that has one. Run when a
 * citizen opens the timeline so a programme saved before this feature existed
 * still appears, and re-runnable without duplicating.
 */
export async function syncTimelineDeadlines(userId: string): Promise<number> {
  const saved = await db
    .select({ opportunityId: savedOpportunities.opportunityId, deadline: opportunities.deadline, title: opportunities.title, titleBn: opportunities.titleBn })
    .from(savedOpportunities)
    .innerJoin(opportunities, eq(savedOpportunities.opportunityId, opportunities.id))
    .where(eq(savedOpportunities.userId, userId));

  const withDeadlines = saved.filter((s) => s.deadline !== null);
  if (withDeadlines.length === 0) return 0;

  const existing = await db
    .select({ opportunityId: timelineEvents.opportunityId })
    .from(timelineEvents)
    .where(and(eq(timelineEvents.userId, userId), eq(timelineEvents.type, 'deadline')));
  const known = new Set(existing.map((e) => e.opportunityId));

  const additions = withDeadlines
    .filter((s) => !known.has(s.opportunityId))
    .map((s) => ({
      userId,
      opportunityId: s.opportunityId,
      type: 'deadline' as const,
      title: `Deadline: ${s.title}`,
      titleBn: `শেষ তারিখ: ${s.titleBn}`,
      eventDate: s.deadline!,
      source: 'system' as const,
    }));

  if (additions.length > 0) await db.insert(timelineEvents).values(additions);
  return additions.length;
}

/* --------------------------------------------------------- notifications */

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: readonly [en: string, bn: string];
  body: readonly [en: string, bn: string];
  actionUrl?: string | null;
  scheduledAt?: Date | null;
}) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title[0],
      titleBn: input.title[1],
      body: input.body[0],
      bodyBn: input.body[1],
      actionUrl: input.actionUrl ?? null,
      scheduledAt: input.scheduledAt ?? null,
      sentAt: input.scheduledAt ? null : new Date(),
      channel: 'in_app',
    })
    .returning();
  return row!;
}

export async function listNotifications(userId: string, onlyUnread = false) {
  const conditions = [eq(notifications.userId, userId)];
  if (onlyUnread) conditions.push(eq(notifications.read, false));
  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function markNotificationsRead(userId: string, ids?: readonly string[]): Promise<number> {
  const conditions = [eq(notifications.userId, userId), eq(notifications.read, false)];
  if (ids && ids.length > 0) conditions.push(inArray(notifications.id, [...ids]));
  const updated = await db
    .update(notifications)
    .set({ read: true })
    .where(and(...conditions))
    .returning({ id: notifications.id });
  return updated.length;
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return Number(row?.n ?? 0);
}

/**
 * Deadline reminders for the scheduled job. Creates one notification per saved
 * programme whose deadline falls inside the window, and never twice for the
 * same programme and window.
 */
export async function generateDeadlineReminders(userId: string, withinDays = 7): Promise<number> {
  const now = new Date();
  const horizon = addDays(now, withinDays);

  const upcoming = await db
    .select({
      opportunityId: opportunities.id,
      title: opportunities.title,
      titleBn: opportunities.titleBn,
      slug: opportunities.slug,
      deadline: opportunities.deadline,
    })
    .from(savedOpportunities)
    .innerJoin(opportunities, eq(savedOpportunities.opportunityId, opportunities.id))
    .where(
      and(
        eq(savedOpportunities.userId, userId),
        gte(opportunities.deadline, now),
        lte(opportunities.deadline, horizon),
        inArray(savedOpportunities.status, ['interested', 'preparing', 'documents_ready']),
      ),
    );

  if (upcoming.length === 0) return 0;

  const existing = await db
    .select({ actionUrl: notifications.actionUrl })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, 'deadline_reminder')));
  const alreadyNotified = new Set(existing.map((e) => e.actionUrl));

  let created = 0;
  for (const item of upcoming) {
    const actionUrl = `/opportunities/${item.slug}`;
    if (alreadyNotified.has(actionUrl)) continue;
    const days = Math.max(0, Math.ceil((item.deadline!.getTime() - now.getTime()) / 86_400_000));
    await createNotification({
      userId,
      type: 'deadline_reminder',
      title: [`${days} days left: ${item.title}`, `${days} দিন বাকি: ${item.titleBn}`],
      body: [
        'Check that your documents are ready before the deadline.',
        'শেষ তারিখের আগে আপনার কাগজপত্র প্রস্তুত আছে কি না দেখে নিন।',
      ],
      actionUrl,
    });
    created += 1;
  }
  return created;
}
