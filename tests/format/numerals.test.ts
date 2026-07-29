import { describe, it, expect } from 'vitest';
import {
  toBengaliDigits, toLatinDigits, groupSouthAsian, formatNumber, formatMoney,
  amountInWords, normalisePhone, formatPhone, maskPhone, detectOperator,
} from '@/lib/format/numerals';
import { deadlineUrgency, daysBetween, formatRelativeDay, formatDate } from '@/lib/format/dates';

describe('digit shapes', () => {
  it('converts Latin to Bengali for display', () => {
    expect(toBengaliDigits('01712345678')).toBe('০১৭১২৩৪৫৬৭৮');
    expect(toBengaliDigits(2026)).toBe('২০২৬');
  });

  it('normalises Bengali input back to Latin', () => {
    expect(toLatinDigits('০১৭১২৩৪৫৬৭৮')).toBe('01712345678');
  });

  it('round-trips', () => {
    expect(toLatinDigits(toBengaliDigits('3.82'))).toBe('3.82');
  });
});

describe('South-Asian grouping', () => {
  it('groups three digits then twos — never Western thousands', () => {
    expect(groupSouthAsian('123')).toBe('123');
    expect(groupSouthAsian('1234')).toBe('1,234');
    expect(groupSouthAsian('123456')).toBe('1,23,456');
    expect(groupSouthAsian('12345678')).toBe('1,23,45,678');
    expect(groupSouthAsian('123456789')).toBe('12,34,56,789');
  });
});

describe('money', () => {
  it('always shows exactly two decimals, including .00', () => {
    expect(formatMoney(500)).toBe('৳500.00');
    expect(formatMoney(5000)).toBe('৳5,000.00');
    expect(formatMoney(123456.5)).toBe('৳1,23,456.50');
  });

  it('prefixes ৳ with no space', () => {
    expect(formatMoney(50)).toMatch(/^৳50\.00$/);
  });

  it('never abbreviates large amounts', () => {
    const out = formatMoney(1_200_000);
    expect(out).toBe('৳12,00,000.00');
    expect(out).not.toMatch(/[KLMk]|lac|crore/);
  });

  it('renders Bengali numerals when the citizen opts in', () => {
    expect(formatMoney(5000, { numerals: 'bengali' })).toBe('৳৫,০০০.০০');
  });

  it('renders an em dash for unknown rather than ৳0.00', () => {
    // Showing ০ for "amount not published" would be a factual claim we cannot make.
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
  });

  it('formats negatives with a true minus sign', () => {
    expect(formatMoney(-250)).toBe('৳−250.00');
  });
});

describe('amount in words', () => {
  it('handles the irregular Bangla teens and twenties', () => {
    expect(amountInWords(21, 'bn')).toBe('একুশ টাকা');
    expect(amountInWords(16, 'bn')).toBe('ষোলো টাকা');
    expect(amountInWords(39, 'bn')).toBe('উনচল্লিশ টাকা');
  });

  it('uses the lakh/crore system', () => {
    expect(amountInWords(5000, 'bn')).toBe('পাঁচ হাজার টাকা');
    expect(amountInWords(100000, 'bn')).toBe('এক লাখ টাকা');
    expect(amountInWords(123456, 'bn')).toBe('এক লাখ তেইশ হাজার চার শত ছাপ্পান্ন টাকা');
    expect(amountInWords(10000000, 'bn')).toBe('এক কোটি টাকা');
  });

  it('speaks English in the Indian numbering system too', () => {
    expect(amountInWords(123456, 'en')).toBe('one lakh twenty-three thousand four hundred fifty-six taka');
    expect(amountInWords(5000, 'en')).toBe('five thousand taka');
  });

  it('includes paisa when present', () => {
    expect(amountInWords(50.25, 'bn')).toBe('পঞ্চাশ টাকা পঁচিশ পয়সা');
  });

  it('handles zero', () => {
    expect(amountInWords(0, 'bn')).toBe('শূন্য টাকা');
  });
});

describe('phone handling', () => {
  it('accepts every real-world input shape', () => {
    const expected = '01712345678';
    expect(normalisePhone('01712345678')).toBe(expected);
    expect(normalisePhone('+8801712345678')).toBe(expected);
    expect(normalisePhone('8801712345678')).toBe(expected);
    expect(normalisePhone('01712 345 678')).toBe(expected);
    expect(normalisePhone('01712-345678')).toBe(expected);
    expect(normalisePhone('০১৭১২৩৪৫৬৭৮')).toBe(expected);
    expect(normalisePhone('1712345678')).toBe(expected);
  });

  it('rejects genuinely invalid numbers', () => {
    expect(normalisePhone('0171234567')).toBeNull();   // 10 digits
    expect(normalisePhone('01212345678')).toBeNull();  // invalid operator digit
    expect(normalisePhone('abcdefghijk')).toBeNull();
    expect(normalisePhone('')).toBeNull();
  });

  it('displays with a single hyphen after 5 digits', () => {
    expect(formatPhone('01712345678')).toBe('01712-345678');
    expect(formatPhone('+8801712345678')).toBe('01712-345678');
  });

  it('masks for "we sent a code to…"', () => {
    expect(maskPhone('01712345678')).toBe('01712-***678');
  });

  it('recognises the operator as a free confirmation cue', () => {
    expect(detectOperator('01712345678', 'bn')).toBe('গ্রামীণফোন');
    expect(detectOperator('01812345678', 'en')).toBe('Robi');
    expect(detectOperator('01512345678', 'bn')).toBe('টেলিটক');
    expect(detectOperator('02212345678', 'en')).toBeNull();
  });
});

describe('dates', () => {
  const now = new Date(2026, 6, 28); // 28 July 2026

  it('formats Bangla dates with Latin digits by default', () => {
    expect(formatDate(new Date(2026, 7, 20), 'bn')).toBe('20 আগস্ট 2026');
  });

  it('honours the Bengali numeral opt-in', () => {
    expect(formatDate(new Date(2026, 7, 20), 'bn', { numerals: 'bengali' })).toBe('২০ আগস্ট ২০২৬');
  });

  it('counts whole days regardless of time of day', () => {
    expect(daysBetween(new Date(2026, 6, 28, 23, 59), new Date(2026, 6, 29, 0, 1))).toBe(1);
  });

  it('uses concrete words near the present', () => {
    expect(formatRelativeDay(new Date(2026, 6, 28), 'bn', { now })).toBe('আজ');
    expect(formatRelativeDay(new Date(2026, 6, 29), 'bn', { now })).toBe('আগামীকাল');
    expect(formatRelativeDay(new Date(2026, 6, 30), 'bn', { now })).toBe('পরশু');
    expect(formatRelativeDay(new Date(2026, 6, 29), 'en', { now })).toBe('Tomorrow');
  });

  it('falls back to an absolute date beyond a week', () => {
    expect(formatRelativeDay(new Date(2026, 8, 15), 'en', { now })).toBe('15 September 2026');
  });

  it('bands deadline urgency and distinguishes rolling from unknown', () => {
    expect(deadlineUrgency(new Date(2026, 6, 20), now)).toBe('expired');
    expect(deadlineUrgency(new Date(2026, 6, 30), now)).toBe('critical');
    expect(deadlineUrgency(new Date(2026, 7, 5), now)).toBe('soon');
    expect(deadlineUrgency(new Date(2026, 7, 25), now)).toBe('upcoming');
    expect(deadlineUrgency(new Date(2026, 11, 1), now)).toBe('distant');
    expect(deadlineUrgency(null, now)).toBe('rolling');
  });
});
