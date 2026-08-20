import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { issues, issueVotes, issueStatusHistory, unionBoundaries, users } from '@/lib/db/schema';
import type { Issue } from '@/lib/db/schema';
import type { IssueCategory, IssueStatus } from '@/lib/domain/enums';
import { screenIssueText } from './moderation';
import { saveIssuePhoto } from './photo-storage';
import { moderateIssuePhoto } from './vision-moderation';
import { canTransition, PUBLICLY_VISIBLE_STATUSES } from './state-machine';

/**
 * Citizen issue reporting — Phase 2, the "Amar Union, Amar Sheba" module.
 *
 * Deliberately scoped tight to the citizen's OWN verified union rather than
 * accepting an arbitrary union id from the client: the source KB is explicit
 * that both viewing and voting are "union-scoped… limited to verified
 * same-union users," so the union a report is filed under, and the feed a
 * citizen sees, both come from their residency verification (Phase 1) — never
 * from a request parameter a citizen could set to any union they like.
 */

export interface SubmitIssueInput {
  readonly reporterId: string;
  readonly unionId: string;
  readonly category: IssueCategory;
  readonly title: string;
  readonly description: string;
  readonly lat: number;
  readonly lng: number;
  readonly photoDataUrl?: string | null;
}

export async function submitIssue(input: SubmitIssueInput): Promise<Issue> {
  const screen = screenIssueText(input.title, input.description);

  let photoUrl: string | null = null;
  let vision: { readonly status: 'not_applicable' | 'unavailable' | 'passed' | 'flagged'; readonly flagged: boolean; readonly reason: string | null } = {
    status: 'not_applicable',
    flagged: false,
    reason: null,
  };
  if (input.photoDataUrl) {
    vision = await moderateIssuePhoto(input.photoDataUrl);
    const saved = await saveIssuePhoto(input.photoDataUrl);
    photoUrl = saved.url;
  }

  const flagged = screen.flagged || vision.flagged;
  const flagReason = [screen.flagged ? screen.reason : null, vision.flagged ? vision.reason : null].filter(Boolean).join(' | ') || null;

  const [row] = await db
    .insert(issues)
    .values({
      reporterId: input.reporterId,
      unionId: input.unionId,
      category: input.category,
      title: input.title,
      description: input.description,
      lat: input.lat,
      lng: input.lng,
      photoUrl,
      // Moves straight to the moderation queue: "Submitted" is kept as a
      // distinct enum value for a future asynchronous intake channel
      // (SMS/USSD, Phase 5), not because the web flow pauses there.
      status: 'under_review',
      autoFlagged: flagged,
      autoFlagReason: flagReason,
      visionModerationStatus: vision.status,
    })
    .returning();

  await db.insert(issueStatusHistory).values({
    issueId: row!.id,
    fromStatus: null,
    toStatus: 'under_review',
    changedBy: input.reporterId,
    note: flagged ? `Auto-flagged: ${flagReason}` : null,
  });

  return row!;
}

export interface UnionFeedOptions {
  readonly sort?: 'top' | 'recent';
  readonly limit?: number;
}

/** The public feed for one union: only issues a moderator has verified onward. */
export async function listUnionFeed(unionId: string, options: UnionFeedOptions = {}) {
  const conditions = [
    eq(issues.unionId, unionId),
    inArray(issues.status, [...PUBLICLY_VISIBLE_STATUSES]),
  ];

  const orderBy =
    options.sort === 'recent'
      ? [desc(issues.createdAt)]
      : [desc(issues.voteCount), desc(issues.createdAt)];

  return db
    .select({
      issue: issues,
      reporterName: users.name,
    })
    .from(issues)
    .innerJoin(users, eq(issues.reporterId, users.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(options.limit ?? 50);
}

/** A citizen's own submissions, regardless of status — their personal tracker. */
export async function listMyIssues(reporterId: string, limit = 50) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.reporterId, reporterId))
    .orderBy(desc(issues.createdAt))
    .limit(limit);
}

export async function getIssue(issueId: string, viewerId?: string) {
  const [row] = await db
    .select({ issue: issues, reporterName: users.name, unionName: unionBoundaries.name, unionNameBn: unionBoundaries.nameBn })
    .from(issues)
    .innerJoin(users, eq(issues.reporterId, users.id))
    .innerJoin(unionBoundaries, eq(issues.unionId, unionBoundaries.id))
    .where(eq(issues.id, issueId))
    .limit(1);
  if (!row) return null;

  const [history, voted] = await Promise.all([
    db
      .select()
      .from(issueStatusHistory)
      .where(eq(issueStatusHistory.issueId, issueId))
      .orderBy(issueStatusHistory.changedAt),
    viewerId
      ? db
          .select({ id: issueVotes.id })
          .from(issueVotes)
          .where(and(eq(issueVotes.issueId, issueId), eq(issueVotes.userId, viewerId)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return { ...row, history, hasVoted: voted.length > 0 };
}

/** Pending items for the staff moderation queue — extends `/admin/moderation`. */
export async function listPendingIssues(limit = 100) {
  return db
    .select({ issue: issues, reporterName: users.name, unionName: unionBoundaries.name })
    .from(issues)
    .innerJoin(users, eq(issues.reporterId, users.id))
    .innerJoin(unionBoundaries, eq(issues.unionId, unionBoundaries.id))
    .where(eq(issues.status, 'under_review'))
    .orderBy(desc(issues.autoFlagged), desc(issues.createdAt))
    .limit(limit);
}

export interface VoteResult {
  readonly voted: boolean;
  readonly voteCount: number;
}

/** Toggle: voting again withdraws the endorsement, matching a citizen tapping twice. */
export async function toggleVote(issueId: string, userId: string): Promise<VoteResult | null> {
  const [issue] = await db.select({ id: issues.id }).from(issues).where(eq(issues.id, issueId)).limit(1);
  if (!issue) return null;

  const [existing] = await db
    .select()
    .from(issueVotes)
    .where(and(eq(issueVotes.issueId, issueId), eq(issueVotes.userId, userId)))
    .limit(1);

  if (existing) {
    await db.delete(issueVotes).where(eq(issueVotes.id, existing.id));
    const [updated] = await db
      .update(issues)
      .set({ voteCount: sql`max(0, ${issues.voteCount} - 1)` })
      .where(eq(issues.id, issueId))
      .returning({ voteCount: issues.voteCount });
    return { voted: false, voteCount: updated!.voteCount };
  }

  await db.insert(issueVotes).values({ issueId, userId });
  const [updated] = await db
    .update(issues)
    .set({ voteCount: sql`${issues.voteCount} + 1` })
    .where(eq(issues.id, issueId))
    .returning({ voteCount: issues.voteCount });
  return { voted: true, voteCount: updated!.voteCount };
}

export interface TransitionInput {
  readonly issueId: string;
  readonly toStatus: IssueStatus;
  readonly actorId: string;
  readonly note?: string | null;
  readonly resolutionPhotoUrl?: string | null;
}

export interface TransitionResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly issue?: Issue;
}

/**
 * The only path by which an issue's status changes. Refuses any move the
 * state machine does not list — the same discipline `evaluateEligibility`
 * applies to a missing profile field: no code path improvises a shortcut.
 */
export async function transitionIssueStatus(input: TransitionInput): Promise<TransitionResult> {
  const [existing] = await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1);
  if (!existing) return { ok: false, reason: 'That report could not be found.' };

  if (!canTransition(existing.status, input.toStatus)) {
    return { ok: false, reason: `An issue cannot move from "${existing.status}" to "${input.toStatus}".` };
  }

  const patch: Partial<typeof issues.$inferInsert> = {
    status: input.toStatus,
    updatedAt: new Date(),
  };
  if (input.toStatus === 'verified' || input.toStatus === 'rejected') {
    patch.moderatedBy = input.actorId;
    patch.moderationNote = input.note ?? null;
  }
  if (input.toStatus === 'in_progress' || input.toStatus === 'completed') {
    patch.resolvedBy = input.actorId;
    if (input.note !== undefined) patch.resolutionNote = input.note;
    if (input.resolutionPhotoUrl !== undefined) patch.resolutionPhotoUrl = input.resolutionPhotoUrl;
  }
  if (input.toStatus === 'completed') {
    patch.resolvedAt = new Date();
  }

  const [updated] = await db.update(issues).set(patch).where(eq(issues.id, input.issueId)).returning();

  await db.insert(issueStatusHistory).values({
    issueId: input.issueId,
    fromStatus: existing.status,
    toStatus: input.toStatus,
    changedBy: input.actorId,
    note: input.note ?? null,
  });

  return { ok: true, issue: updated! };
}
