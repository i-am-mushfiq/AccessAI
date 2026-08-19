import type { IssueStatus } from '@/lib/domain/enums';

/**
 * The issue lifecycle, fixed by the source spec:
 * Submitted → UnderReview → (Verified | Rejected) → InProgress → Completed → Archived.
 *
 * Enforced here, not just documented — `transitionIssueStatus` in
 * issue.service.ts refuses any move not listed below, the same way
 * `modules/eligibility/engine.ts` refuses to guess at a missing field.
 */
const TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  submitted: ['under_review'],
  under_review: ['verified', 'rejected'],
  verified: ['in_progress', 'archived'],
  rejected: ['archived'],
  in_progress: ['completed', 'archived'],
  completed: ['archived'],
  archived: [],
};

export function canTransition(from: IssueStatus, to: IssueStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: IssueStatus): readonly IssueStatus[] {
  return TRANSITIONS[from];
}

/** Statuses a citizen browsing their union's feed is allowed to see. */
export const PUBLICLY_VISIBLE_STATUSES: readonly IssueStatus[] = [
  'verified',
  'in_progress',
  'completed',
  'archived',
];
