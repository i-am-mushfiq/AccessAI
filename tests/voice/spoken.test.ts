import { describe, it, expect } from 'vitest';
import {
  speakable, clause, spokenList, countInWords, SPOKEN_LIST_LIMIT,
} from '@/modules/voice/spoken';

/**
 * What a listener actually hears.
 *
 * Every assertion here stands for a failure that is INAUDIBLE to a sighted
 * reviewer: a missing দাঁড়ি produces text that looks fine and reads as one
 * unbroken breath; a silently truncated list looks complete on screen; a numeral
 * left in Bangla script is skipped outright by an English voice. None of these
 * show up in a screenshot, so they have to be pinned in a test.
 */

describe('speakable', () => {
  it('ends Bangla sentences with দাঁড়ি, not a full stop', () => {
    // A Bangla voice given "." frequently does not pause at all.
    expect(speakable('bn', ['বিধবা ভাতা', 'সমাজসেবা অধিদফতর'])).toBe(
      'বিধবা ভাতা। সমাজসেবা অধিদফতর।',
    );
  });

  it('ends English sentences with a full stop', () => {
    expect(speakable('en', ['Widow allowance', 'Department of Social Services'])).toBe(
      'Widow allowance. Department of Social Services.',
    );
  });

  it('leaves existing terminators alone', () => {
    // Appending "।" to a question would have the voice fall at the end of it.
    expect(speakable('bn', ['আপনি কি যোগ্য?'])).toBe('আপনি কি যোগ্য?');
    expect(speakable('bn', ['শেষ তারিখ ৩০ জুন।'])).toBe('শেষ তারিখ ৩০ জুন।');
    expect(speakable('en', ['Are you eligible?'])).toBe('Are you eligible?');
  });

  it('drops fragments a record does not have', () => {
    // Reading "Deadline: not known" for every absent field is how a 30-second
    // clip becomes 90.
    expect(speakable('bn', ['শিরোনাম', null, undefined, false, '   '])).toBe('শিরোনাম।');
  });

  it('collapses newlines and runs of whitespace', () => {
    // Database text arrives with line breaks; a synthesiser reads them as pauses
    // in the wrong places.
    expect(speakable('en', ['one\n\n  two   three'])).toBe('one two three.');
  });

  it('returns an empty string when there is nothing to say', () => {
    // The caller can then substitute a "nothing here" line rather than speaking
    // a single stray full stop.
    expect(speakable('bn', [])).toBe('');
    expect(speakable('bn', [null, false, ''])).toBe('');
  });
});

describe('clause', () => {
  it('pairs a label with its value', () => {
    expect(clause('শেষ তারিখ', '৩০ জুন')).toBe('শেষ তারিখ: ৩০ জুন');
  });

  it('yields nothing when the value is absent, so the label is not read alone', () => {
    expect(clause('শেষ তারিখ', null)).toBeNull();
    expect(clause('শেষ তারিখ', '')).toBeNull();
    expect(clause('শেষ তারিখ', '   ')).toBeNull();
    expect(clause('Deadline', false)).toBeNull();
  });
});

describe('spokenList', () => {
  const more = (remaining: number) => `আরও ${remaining}টি আছে`;

  it('reads a short list in full, with no trailing claim about more', () => {
    const result = spokenList('bn', ['এক', 'দুই'], { limit: 5, more });
    expect(result).toBe('এক। দুই।');
    expect(result).not.toContain('আরও');
  });

  it('admits what it left out', () => {
    // A list read aloud has no scrollbar. Cutting at the limit in silence tells
    // the listener they have heard everything.
    const items = ['এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত'];
    const result = spokenList('bn', items, { limit: 5, more });

    expect(result).toContain('পাঁচ');
    expect(result).not.toContain('ছয়');
    expect(result).toContain('আরও 2টি আছে');
  });

  it('counts only the fragments it could actually read', () => {
    // Blank rows must not inflate the "and N more" — that would announce items
    // that do not exist.
    const result = spokenList('bn', ['এক', null, '  ', 'দুই', undefined], { limit: 1, more });
    expect(result).toBe('এক। আরও 1টি আছে।');
  });

  it('says nothing at all for an empty list', () => {
    expect(spokenList('bn', [], { limit: 5, more })).toBe('');
    expect(spokenList('bn', [null, false], { limit: 5, more })).toBe('');
  });

  it('reads nothing but the tally when the limit is zero', () => {
    expect(spokenList('bn', ['এক', 'দুই'], { limit: 0, more })).toBe('আরও 2টি আছে।');
  });

  it('keeps a default limit that is worth listening to', () => {
    expect(SPOKEN_LIST_LIMIT).toBeGreaterThan(0);
    expect(SPOKEN_LIST_LIMIT).toBeLessThanOrEqual(10);
  });
});

describe('countInWords', () => {
  it('spells Bangla counts, including the irregular ones', () => {
    // ২১ is একুশ, never "বিশ এক" — this is why a table exists rather than a rule.
    expect(countInWords(0, 'bn')).toBe('শূন্য');
    expect(countInWords(1, 'bn')).toBe('এক');
    expect(countInWords(12, 'bn')).toBe('বারো');
    expect(countInWords(21, 'bn')).toBe('একুশ');
    expect(countInWords(48, 'bn')).toBe('আটচল্লিশ');
    expect(countInWords(99, 'bn')).toBe('নিরানব্বই');
  });

  it('spells English counts, hyphenating the compounds', () => {
    expect(countInWords(0, 'en')).toBe('zero');
    expect(countInWords(7, 'en')).toBe('seven');
    expect(countInWords(19, 'en')).toBe('nineteen');
    expect(countInWords(20, 'en')).toBe('twenty');
    expect(countInWords(42, 'en')).toBe('forty-two');
    expect(countInWords(90, 'en')).toBe('ninety');
  });

  it('falls back to a numeral above the table rather than inventing a word', () => {
    expect(countInWords(100, 'bn')).toBe('100');
    expect(countInWords(365, 'en')).toBe('365');
  });

  it('treats a day count as a magnitude', () => {
    // Callers phrase overdue separately; a spoken "minus four days" is nonsense.
    expect(countInWords(-4, 'bn')).toBe('চার');
    expect(countInWords(3.6, 'en')).toBe('four');
  });

  it('says nothing for a non-number rather than "NaN"', () => {
    expect(countInWords(Number.NaN, 'bn')).toBe('');
    expect(countInWords(Number.POSITIVE_INFINITY, 'en')).toBe('');
  });
});
