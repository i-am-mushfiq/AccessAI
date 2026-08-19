import { describe, it, expect } from 'vitest';
import { canTransition, nextStatuses, PUBLICLY_VISIBLE_STATUSES } from '@/modules/issues/state-machine';
import { ISSUE_STATUSES } from '@/lib/domain/enums';

describe('issue state machine', () => {
  it('follows the documented lifecycle: submitted → under_review → verified → in_progress → completed → archived', () => {
    expect(canTransition('submitted', 'under_review')).toBe(true);
    expect(canTransition('under_review', 'verified')).toBe(true);
    expect(canTransition('under_review', 'rejected')).toBe(true);
    expect(canTransition('verified', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'completed')).toBe(true);
    expect(canTransition('completed', 'archived')).toBe(true);
  });

  it('refuses to skip a stage', () => {
    expect(canTransition('submitted', 'verified')).toBe(false);
    expect(canTransition('under_review', 'completed')).toBe(false);
    expect(canTransition('verified', 'completed')).toBe(false);
  });

  it('refuses to revive a rejected or archived report', () => {
    expect(canTransition('rejected', 'verified')).toBe(false);
    expect(canTransition('rejected', 'under_review')).toBe(false);
    expect(nextStatuses('archived')).toEqual([]);
  });

  it('every status has a defined (possibly empty) set of next statuses', () => {
    for (const status of ISSUE_STATUSES) {
      expect(Array.isArray(nextStatuses(status))).toBe(true);
    }
  });

  it('publicly-visible statuses are exactly the ones past moderation', () => {
    expect(PUBLICLY_VISIBLE_STATUSES).toEqual(['verified', 'in_progress', 'completed', 'archived']);
    expect(PUBLICLY_VISIBLE_STATUSES).not.toContain('submitted');
    expect(PUBLICLY_VISIBLE_STATUSES).not.toContain('under_review');
    expect(PUBLICLY_VISIBLE_STATUSES).not.toContain('rejected');
  });
});
