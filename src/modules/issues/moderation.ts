/**
 * Deterministic keyword filter for citizen-submitted issue reports — BRD
 * BR-1 ("AI filters spam/duplicates") and the original BRD's MVP scope
 * ("keyword filtering flags inappropriate content").
 *
 * Every report still goes to a human moderator (`under_review` on creation);
 * this only decides whether it is flagged for closer attention, the same way
 * `modules/ai/nlu.ts` is a deterministic classifier rather than a model call.
 * No report is ever auto-rejected by this function alone.
 */

export interface IssueScreenResult {
  readonly flagged: boolean;
  readonly reason: string | null;
}

const SPAM_TERMS_EN = ['viagra', 'crypto giveaway', 'click here', 'free money', 'http://', 'https://www.bit.ly'];
const ABUSE_TERMS_EN = ['fuck', 'bitch', 'asshole', 'slut'];
// A short, illustrative list — a real deployment would draw this from a
// maintained Bangla moderation lexicon rather than a handful of literals.
const ABUSE_TERMS_BN = ['শালা', 'মাগী', 'খানকি'];

// Above the Zod floor (8 chars) on purpose: this is a "look closer" signal
// for the moderation queue, not a resubmission of the same hard minimum.
const MIN_DESCRIPTION_LENGTH = 20;

export function screenIssueText(title: string, description: string): IssueScreenResult {
  const combined = `${title} ${description}`;
  const lower = combined.toLowerCase();

  for (const term of SPAM_TERMS_EN) {
    if (lower.includes(term)) return { flagged: true, reason: `Possible spam: contains "${term}".` };
  }
  for (const term of ABUSE_TERMS_EN) {
    if (lower.includes(term)) return { flagged: true, reason: 'Possible abusive language.' };
  }
  for (const term of ABUSE_TERMS_BN) {
    if (combined.includes(term)) return { flagged: true, reason: 'Possible abusive language.' };
  }
  if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
    return { flagged: true, reason: 'Description is very short — needs a human check.' };
  }
  return { flagged: false, reason: null };
}
