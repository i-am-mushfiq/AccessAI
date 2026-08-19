import { describe, it, expect } from 'vitest';
import { screenIssueText } from '@/modules/issues/moderation';

describe('screenIssueText', () => {
  it('does not flag an ordinary, detailed report', () => {
    const result = screenIssueText(
      'Broken tube well',
      'The hand tube well near the primary school has been broken for two weeks and families are walking far for water.',
    );
    expect(result.flagged).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('flags an obviously thin description', () => {
    const result = screenIssueText('Road bad', 'fix it');
    expect(result.flagged).toBe(true);
    expect(result.reason).toBeTruthy();
  });

  it('flags spam-shaped content', () => {
    const result = screenIssueText('Great offer', 'Click here for free money, crypto giveaway ongoing now.');
    expect(result.flagged).toBe(true);
  });

  it('flags abusive language, English or Bangla', () => {
    expect(screenIssueText('title', 'this bitch of a road is never fixed by anyone here').flagged).toBe(true);
    expect(screenIssueText('শিরোনাম', 'এই শালা রাস্তা কখনো ঠিক হয় না কেউ দেখে না').flagged).toBe(true);
  });

  it('never returns flagged with a null reason', () => {
    const result = screenIssueText('Great offer', 'Click here for free money now please.');
    if (result.flagged) expect(result.reason).not.toBeNull();
  });
});
