import { describe, it, expect } from 'vitest';
import {
  parseNumberWords, parseAmount, parseSpokenDigits, extractNumbers, hasNoNumber,
} from '@/lib/format/number-words';
import { amountInWords } from '@/lib/format/numerals';

/**
 * Spoken-number parsing.
 *
 * This is the piece that decides whether voice input actually works. Speech
 * recognition returns words, the eligibility engine needs values, and a failure
 * here is SILENT — the amount simply never reaches the profile and the citizen
 * gets asked again. So the cases below are drawn from how people actually say
 * money in Bangla, not from what is easy to parse.
 */

describe('digits, in either script', () => {
  it('reads Latin and Bengali digits alike', () => {
    expect(parseNumberWords('4000')).toBe(4000);
    expect(parseNumberWords('৪০০০')).toBe(4000);
    expect(parseNumberWords('৪০০০ টাকা')).toBe(4000);
  });

  it('ignores grouping punctuation', () => {
    expect(parseNumberWords('৳4,500')).toBe(4500);
    expect(parseNumberWords('1,23,456')).toBe(123456);
  });

  it('reads a decimal', () => {
    expect(parseNumberWords('1.5 lakh')).toBe(150_000);
    expect(parseNumberWords('২.৫ হাজার')).toBe(2500);
  });
});

describe('Bangla number words', () => {
  const cases: [string, number][] = [
    ['চার হাজার', 4000],
    ['চার হাজার টাকা', 4000],
    ['পাঁচ হাজার পাঁচশো', 5500],
    ['পাঁচশো', 500],
    ['পাঁচশ', 500],
    ['পাঁচ শত', 500],
    ['তিন লাখ', 300_000],
    ['তিন লক্ষ', 300_000],
    ['দুই কোটি', 20_000_000],
    ['সাতশো পঞ্চাশ', 750],
    ['বারো হাজার', 12_000],
    ['একুশ', 21],
    ['নিরানব্বই', 99],
    ['এক লাখ পঞ্চাশ হাজার', 150_000],
  ];

  for (const [phrase, expected] of cases) {
    it(`"${phrase}" → ${expected}`, () => {
      expect(parseNumberWords(phrase)).toBe(expected);
    });
  }
});

describe('fraction words — the ones people actually use for money', () => {
  const cases: [string, number][] = [
    ['দেড় হাজার', 1500],
    ['আড়াই হাজার', 2500],
    ['সাড়ে চার হাজার', 4500],
    ['সাড়ে তিন হাজার টাকা', 3500],
    ['সোয়া দুই লাখ', 225_000],
    ['পৌনে তিন হাজার', 2750],
    ['দেড় লাখ', 150_000],
    ['আড়াই লাখ', 250_000],
    ['সাড়ে সাতশো', 750],
  ];

  for (const [phrase, expected] of cases) {
    it(`"${phrase}" → ${expected}`, () => {
      expect(parseNumberWords(phrase)).toBe(expected);
    });
  }

  it('a fraction word with nothing after it is not a number', () => {
    // "সাড়ে" alone means nothing; inventing 0.5 would record a figure the
    // citizen never said.
    expect(parseNumberWords('সাড়ে')).toBeNull();
    expect(parseNumberWords('সোয়া')).toBeNull();
  });
});

describe('English and Banglish', () => {
  const cases: [string, number][] = [
    ['four thousand', 4000],
    ['four thousand five hundred', 4500],
    ['forty-five thousand', 45_000],
    ['two lakh', 200_000],
    ['one crore', 10_000_000],
    ['50k', 50_000],
    ['2.5k', 2500],
    ['char hajar', 4000],
    ['dui lakh', 200_000],
    ['half lakh', 50_000],
  ];

  for (const [phrase, expected] of cases) {
    it(`"${phrase}" → ${expected}`, () => {
      expect(parseNumberWords(phrase)).toBe(expected);
    });
  }

  it('handles a digit glued to a Bangla scale, as recognisers emit', () => {
    expect(parseNumberWords('4 হাজার')).toBe(4000);
    expect(parseNumberWords('৪ হাজার')).toBe(4000);
  });
});

describe('round trip with the formatter', () => {
  /**
   * The parser inverts the formatter's own tables, so every value the formatter
   * can express in words must parse back to itself. This is what stops the two
   * vocabularies drifting apart as either side is edited.
   */
  it('every 0–99 survives amountInWords → parse, in Bangla', () => {
    for (let n = 1; n < 100; n += 1) {
      const words = amountInWords(n, 'bn');
      expect(parseNumberWords(words), `${n} → "${words}"`).toBe(n);
    }
  });

  it('every 0–99 survives amountInWords → parse, in English', () => {
    for (let n = 1; n < 100; n += 1) {
      const words = amountInWords(n, 'en');
      expect(parseNumberWords(words), `${n} → "${words}"`).toBe(n);
    }
  });

  it('realistic benefit and income amounts survive the round trip', () => {
    const amounts = [550, 750, 1000, 1500, 2000, 3000, 4000, 4500, 5000, 8000,
      12_000, 25_000, 50_000, 100_000, 150_000, 300_000, 1_000_000];
    for (const amount of amounts) {
      for (const locale of ['bn', 'en'] as const) {
        const words = amountInWords(amount, locale);
        expect(parseNumberWords(words), `${amount} ${locale} → "${words}"`).toBe(amount);
      }
    }
  });
});

describe('amounts inside a whole sentence', () => {
  it('picks the amount, not the first number, using currency context', () => {
    // The sentence a widow actually says. "three children" must not become the
    // income, and the income must not be missed.
    expect(parseAmount('আমার তিনটি সন্তান আছে, আয় চার হাজার টাকা')).toBe(4000);
  });

  it('uses a scale word as evidence when currency is absent', () => {
    expect(parseAmount('I have 3 children and earn four thousand')).toBe(4000);
  });

  it('returns null rather than guessing between two bare numbers', () => {
    // "between 4000 and 5000" is a range, not a value. Recording either end
    // would be inventing precision the citizen did not give.
    expect(parseAmount('আমার আয় ৪০০০ থেকে ৫০০০')).toBeNull();
  });

  it('finds every number in order when asked', () => {
    const found = extractNumbers('তিনটি সন্তান, আয় চার হাজার টাকা, বয়স ৫৮');
    expect(found.map((f) => f.value)).toEqual([3, 4000, 58]);
  });

  it('reports the absence of a number distinctly from a parse failure', () => {
    expect(hasNoNumber('আমার স্বামী মারা গেছেন')).toBe(true);
    expect(hasNoNumber('আয় চার হাজার')).toBe(false);
  });

  it('ignores period and currency filler words', () => {
    expect(parseAmount('মাসিক আয় প্রায় সাড়ে চার হাজার টাকা হবে')).toBe(4500);
    expect(parseAmount('about four thousand taka per month')).toBe(4000);
  });
});

describe('digit-by-digit dictation, for phones and OTPs', () => {
  it('reads a spoken phone number', () => {
    expect(parseSpokenDigits('শূন্য এক সাত এক দুই তিন চার পাঁচ ছয় সাত আট', 11))
      .toBe('01712345678');
  });

  it('reads a spoken OTP', () => {
    expect(parseSpokenDigits('এক দুই তিন চার পাঁচ ছয়', 6)).toBe('123456');
    expect(parseSpokenDigits('one two three four five six', 6)).toBe('123456');
  });

  it('accepts digits the recogniser already grouped', () => {
    expect(parseSpokenDigits('01712 345 678', 11)).toBe('01712345678');
  });

  it('refuses a run containing a non-digit quantity', () => {
    // "সাত হাজার" in the middle of a phone number means something was misheard.
    // A half-right phone number is worse than none, so this must fail loudly.
    expect(parseSpokenDigits('শূন্য এক সাত হাজার', 11)).toBeNull();
  });

  it('refuses a length that does not match what was asked for', () => {
    expect(parseSpokenDigits('এক দুই তিন', 6)).toBeNull();
  });
});
