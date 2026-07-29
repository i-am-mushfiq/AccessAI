import { toLatinDigits, BN_UNDER_100, EN_UNDER_20, EN_TENS } from './numerals';

/**
 * Spoken numbers → values. The inverse of `amountInWords`.
 *
 * WHY THIS EXISTS. Speech recognition never returns digits for a spoken amount.
 * A citizen saying "my income is four thousand taka" produces the WORDS
 * `চার হাজার টাকা`, and the eligibility engine needs `4000`. Without this the
 * income never reaches the profile, the rule stays `unknown`, and the citizen is
 * asked the same question again — a failure with no error message anywhere.
 *
 * Three things make Bangla harder than a word list:
 *
 *  1. 0–99 is irregular (২১ is একুশ, not বিশ এক), so the tables are INVERTED
 *     from the ones `amountInWords` prints. A word the formatter can produce is
 *     therefore always a word this parser can read; a test asserts the round
 *     trip for every value it can express.
 *
 *  2. Spoken money uses fraction words constantly, and they are not optional
 *     vocabulary — দেড় হাজার (1,500), আড়াই হাজার (2,500), সাড়ে চার হাজার
 *     (4,500), সোয়া দুই লাখ (2.25 lakh), পৌনে তিন হাজার (2,750). Someone
 *     describing an income near a threshold will very often use one of these.
 *
 *  3. Hundreds contract and join: পাঁচশো, পাঁচশ, পাঁচ শত are all 500, and the
 *     recogniser picks whichever it likes.
 *
 * Everything here is pure and locale-agnostic: Bangla, English, Banglish, and
 * digit/word mixtures ("4 হাজার", "1.5 lakh") all go through one path, because
 * code-switching mid-sentence is the norm for this audience, not an edge case.
 */

/* ------------------------------------------------------------ vocabulary */

/** Inverted from the formatter's own table, so the two cannot drift. */
const BN_WORD_VALUE = new Map<string, number>();
for (const [value, word] of BN_UNDER_100.entries()) BN_WORD_VALUE.set(word, value);

/** Common recogniser spellings the canonical table does not contain. */
const BN_VARIANTS: Record<string, number> = {
  'শুন্য': 0, 'সুন্য': 0,
  'একটা': 1, 'দুটা': 2, 'দুটো': 2, 'দু': 2, 'তিনটা': 3, 'চারটা': 4,
  'এগার': 11, 'বার': 12, 'তের': 13, 'চোদ্দ': 14, 'পনের': 15, 'ষোল': 16, 'সতের': 17, 'আঠার': 18,
  'উনত্রিশ': 29, 'ঊনিশ': 19, 'কুড়ি': 20,
  'পয়ত্রিশ': 35, 'পয়তাল্লিশ': 45, 'পয়ষট্টি': 65, 'পচিশ': 25, 'পচাত্তর': 75,
  'নব্বুই': 90, 'আশী': 80, 'সত্তুর': 70,
};

const EN_WORD_VALUE = new Map<string, number>();
for (const [value, word] of EN_UNDER_20.entries()) EN_WORD_VALUE.set(word, value);
for (const [tens, word] of EN_TENS.entries()) if (word) EN_WORD_VALUE.set(word, tens * 10);
EN_WORD_VALUE.set('a', 1);
EN_WORD_VALUE.set('an', 1);

/**
 * Banglish digits — Bangla words typed or transcribed in Latin script.
 *
 * Not a nicety: the life-event keyword sets in the seed corpus already carry
 * Banglish spellings because that is how a large share of this audience writes,
 * and an English-tagged recogniser hearing Bangla speech produces exactly this.
 * Without these, "char hajar" parses as 1,000 — the scale word survives and the
 * quantity is silently lost, which is the worst possible failure shape.
 */
const BANGLISH_VALUE: Record<string, number> = {
  'shunno': 0, 'shunyo': 0,
  'ek': 1, 'dui': 2, 'du': 2, 'tin': 3, 'char': 4, 'chaar': 4,
  'panch': 5, 'pach': 5, 'paanch': 5, 'choy': 6, 'chhoy': 6,
  'sat': 7, 'saat': 7, 'aat': 8, 'at': 8, 'noy': 9, 'nay': 9,
  'dosh': 10, 'dos': 10, 'egaro': 11, 'baro': 12, 'tero': 13, 'choddo': 14,
  'ponero': 15, 'sholo': 16, 'sotero': 17, 'atharo': 18, 'unish': 19,
  'bish': 20, 'trish': 30, 'chollish': 40, 'ponchash': 50,
  'shat': 60, 'sottor': 70, 'ashi': 80, 'nobboi': 90,
};

/** Multipliers. `শত` is handled separately because it combines, not scales. */
const SCALES: Record<string, number> = {
  // Bangla
  'হাজার': 1_000, 'হাযার': 1_000, 'হাজারো': 1_000,
  'লাখ': 100_000, 'লক্ষ': 100_000, 'লাক': 100_000,
  'কোটি': 10_000_000, 'কোটী': 10_000_000,
  // English / Banglish
  'thousand': 1_000, 'thousands': 1_000, 'hajar': 1_000, 'hazar': 1_000,
  'lakh': 100_000, 'lac': 100_000, 'lakhs': 100_000, 'lakkh': 100_000,
  'crore': 10_000_000, 'crores': 10_000_000, 'koti': 10_000_000,
  'million': 1_000_000, 'billion': 1_000_000_000,
  'k': 1_000, 'm': 1_000_000,
};

const HUNDREDS = new Set(['শত', 'শো', 'শ', 'শতক', 'hundred', 'hundreds', 'sho', 'shata']);

/**
 * Fraction words. `offset` is added to the number that FOLLOWS (সাড়ে চার → 4.5);
 * `value` means the word is itself a complete quantity (দেড় → 1.5).
 */
const FRACTION_PREFIX: Record<string, number> = {
  'সাড়ে': 0.5, 'সারে': 0.5, 'share': 0.5, 'sare': 0.5,
  'সোয়া': 0.25, 'soya': 0.25,
  'পৌনে': -0.25, 'poune': -0.25, 'পোনে': -0.25,
};

const FRACTION_VALUE: Record<string, number> = {
  'দেড়': 1.5, 'দেড়ে': 1.5, 'derh': 1.5, 'der': 1.5,
  'আড়াই': 2.5, 'aarai': 2.5, 'arai': 2.5,
  'অর্ধ': 0.5, 'আধা': 0.5, 'half': 0.5,
};

/** Words that carry no numeric meaning and must not break a run of digits. */
const FILLER = new Set([
  'টাকা', 'টাকার', 'taka', 'tk', 'bdt', 'takar',
  'and', 'ও', 'এবং', 'আর',
  'প্রায়', 'about', 'around', 'approximately', 'roughly',
  'মাসে', 'মাসিক', 'monthly', 'per', 'month', 'বছরে', 'yearly', 'annually', 'বার্ষিক',
  'হবে', 'হয়', 'is', 'was', 'the', 'my', 'আমার', 'আমি',
]);

/* ------------------------------------------------------------ tokenising */

/**
 * Splits joined hundred forms so `পাঁচশো` reads as `পাঁচ` + `শো`.
 *
 * Recognisers emit these joined far more often than separated, and treating
 * `পাঁচশো` as an unknown word would silently drop the 500 from "পাঁচশো টাকা".
 */
/**
 * Bangla counter suffixes. `তিনটি সন্তান` is "three children", and the counter
 * is glued to the numeral — so stripping it generalises to every number instead
 * of enumerating তিনটি, চারটি, পাঁচটি … one at a time.
 */
const COUNTER_SUFFIXES = ['টি', 'টা', 'টো', 'টে', 'জন', 'খানা', 'খানি', 'জনে'];

function stripCounter(token: string): string {
  for (const suffix of COUNTER_SUFFIXES) {
    if (token.length > suffix.length && token.endsWith(suffix)) {
      const head = token.slice(0, -suffix.length);
      if (BN_WORD_VALUE.has(head) || head in BN_VARIANTS) return head;
    }
  }
  return token;
}

function splitJoined(token: string): string[] {
  const stripped = stripCounter(token);
  if (stripped !== token) return [stripped];

  for (const suffix of ['শত', 'শো', 'শ']) {
    if (token.length > suffix.length && token.endsWith(suffix)) {
      const head = token.slice(0, -suffix.length);
      if (BN_WORD_VALUE.has(head) || head in BN_VARIANTS) return [head, suffix];
    }
  }
  for (const scale of ['হাজার', 'লাখ', 'কোটি']) {
    if (token.length > scale.length && token.endsWith(scale)) {
      const head = token.slice(0, -scale.length);
      if (BN_WORD_VALUE.has(head) || head in BN_VARIANTS) return [head, scale];
    }
  }
  // "50k" / "2.5k" — a digit run glued to a scale letter.
  const glued = /^(\d+(?:\.\d+)?)(k|m|lakh|lac|crore|thousand)$/i.exec(token);
  if (glued) return [glued[1]!, glued[2]!.toLowerCase()];
  return [token];
}

function tokenise(text: string): string[] {
  return toLatinDigits(text)
    .toLowerCase()
    /**
     * Digit-grouping commas are removed BEFORE punctuation becomes a separator.
     * Otherwise `৳4,500` splits into `4` and `500`, which the accumulator reads
     * as 504 — a plausible-looking number that is wrong by an order of
     * magnitude, and exactly the kind of figure a citizen would not question.
     */
    .replace(/(?<=\d),(?=\d)/g, '')
    /**
     * Keep letters, COMBINING MARKS, digits and decimal points; everything else
     * (commas, currency symbols, hyphens, punctuation) separates tokens.
     *
     * `\p{M}` is not optional here. Bangla vowel signs and the nukta — া ি ে ়
     * — are category Mark, not Letter, so a `\p{L}`-only class deletes them and
     * `চার` arrives as `চ র`. Every Bangla word silently stops matching while
     * English keeps working, which is exactly the kind of bug that reaches
     * production: the tests written in English all pass.
     */
    .replace(/[^\p{L}\p{M}\p{N}.]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(splitJoined);
}

/* -------------------------------------------------------------- parsing */

interface Run {
  readonly value: number;
  /** Token indices consumed, for callers that need to strip the match. */
  readonly from: number;
  readonly to: number;
}

/** Numeric value of a single token, or null if it is not a bare number. */
function tokenValue(token: string): number | null {
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  const bn = BN_WORD_VALUE.get(token) ?? BN_VARIANTS[token];
  if (bn !== undefined) return bn;
  const en = EN_WORD_VALUE.get(token) ?? BANGLISH_VALUE[token];
  if (en !== undefined) return en;
  // Hyphenated English tens ("forty-five") need no case here: the tokeniser
  // treats the hyphen as a separator, so this arrives as two tokens and the
  // accumulator adds them. Asserted by the English round-trip test, which feeds
  // it exactly the hyphenated form the formatter emits.
  return null;
}

/**
 * Reads one numeric run starting at `start`, returning null if there is none.
 *
 * The accumulator is the standard two-register approach: `group` builds the
 * current sub-thousand quantity, and a scale word flushes it into `total`. What
 * is not standard is the fraction handling, which has to apply BEFORE the scale
 * multiplies — "সাড়ে চার হাজার" is (4 + 0.5) × 1000, not 4 × 1000 + 0.5.
 */
function readRun(tokens: readonly string[], start: number): Run | null {
  let total = 0;
  let group = 0;
  let pendingFraction: number | null = null;
  let sawNumber = false;
  let index = start;
  let lastConsumed = start - 1;

  while (index < tokens.length) {
    const token = tokens[index]!;

    if (FILLER.has(token)) {
      // Filler is skipped, but only INSIDE a run that has already started —
      // otherwise "আমার" at the start of a sentence would begin a phantom run.
      if (!sawNumber) break;
      index += 1;
      continue;
    }

    const fractionValue = FRACTION_VALUE[token];
    if (fractionValue !== undefined) {
      group += fractionValue;
      sawNumber = true;
      lastConsumed = index;
      index += 1;
      continue;
    }

    const fractionOffset = FRACTION_PREFIX[token];
    if (fractionOffset !== undefined) {
      pendingFraction = fractionOffset;
      sawNumber = true;
      lastConsumed = index;
      index += 1;
      continue;
    }

    if (HUNDREDS.has(token)) {
      if (!sawNumber) {
        group = 100;
      } else {
        group = (group === 0 ? 1 : group) * 100;
      }
      sawNumber = true;
      lastConsumed = index;
      index += 1;
      continue;
    }

    const scale = SCALES[token];
    if (scale !== undefined) {
      const base = group === 0 ? 1 : group;
      total += base * scale;
      group = 0;
      sawNumber = true;
      lastConsumed = index;
      index += 1;
      continue;
    }

    const value = tokenValue(token);
    if (value !== null) {
      if (pendingFraction !== null) {
        group += value + pendingFraction;
        pendingFraction = null;
      } else if (group > 0 && group % 100 === 0 && value < 100) {
        // "পাঁচশো পঞ্চাশ" — hundreds then a remainder.
        group += value;
      } else if (group > 0 && value < 10 && group < 10) {
        // Digit-by-digit dictation inside a run ("four five" → 45) is ambiguous
        // and deliberately NOT merged here; see parseSpokenDigits for that case.
        group = group * 10 + value;
      } else {
        group += value;
      }
      sawNumber = true;
      lastConsumed = index;
      index += 1;
      continue;
    }

    break;
  }

  if (!sawNumber) return null;
  // A dangling fraction prefix with nothing after it ("সাড়ে" alone) is not a
  // number; treating it as 0.5 would invent a value the citizen never said.
  if (pendingFraction !== null && group === 0 && total === 0) return null;

  const value = total + group;
  return { value, from: start, to: lastConsumed };
}

/** Every numeric quantity in the text, in order. */
export function extractNumbers(text: string): { value: number; tokens: string[] }[] {
  const tokens = tokenise(text);
  const out: { value: number; tokens: string[] }[] = [];
  let index = 0;
  while (index < tokens.length) {
    const run = readRun(tokens, index);
    if (run) {
      out.push({ value: run.value, tokens: tokens.slice(run.from, run.to + 1) });
      index = run.to + 1;
    } else {
      index += 1;
    }
  }
  return out;
}

/**
 * The single number in a phrase, or null if there is none or more than one.
 *
 * Returning null for "৪০০০ থেকে ৫০০০" is deliberate: a range is not a value,
 * and picking one end would silently record something the citizen did not say.
 */
export function parseNumberWords(text: string): number | null {
  const found = extractNumbers(text);
  if (found.length !== 1) return null;
  return found[0]!.value;
}

/**
 * The most plausible MONEY amount in a sentence.
 *
 * When several numbers appear, currency context decides rather than position:
 * in "আমার তিনটি সন্তান আছে, আয় চার হাজার টাকা" the answer is 4000, not 3.
 * Falling back to the largest value would be wrong as often as it is right, so
 * an unqualified multi-number sentence returns null and the caller asks.
 */
export function parseAmount(text: string): number | null {
  const tokens = tokenise(text);
  const runs: Run[] = [];
  let index = 0;
  while (index < tokens.length) {
    const run = readRun(tokens, index);
    if (run) {
      runs.push(run);
      index = run.to + 1;
    } else {
      index += 1;
    }
  }
  if (runs.length === 0) return null;
  if (runs.length === 1) return runs[0]!.value;

  const CURRENCY = new Set(['টাকা', 'টাকার', 'takar', 'taka', 'tk', 'bdt']);
  const withCurrency = runs.filter((run) => {
    const after = tokens[run.to + 1];
    const before = tokens[run.from - 1];
    return (after !== undefined && CURRENCY.has(after)) || (before !== undefined && CURRENCY.has(before));
  });
  if (withCurrency.length === 1) return withCurrency[0]!.value;

  // A scale word (হাজার/লাখ/কোটি) is itself strong evidence of an amount:
  // nobody says "three lakh children".
  const scaled = runs.filter((run) => tokens.slice(run.from, run.to + 1).some((t) => SCALES[t] !== undefined));
  if (scaled.length === 1) return scaled[0]!.value;

  return null;
}

/**
 * Digit-by-digit dictation, for phone numbers and OTP codes.
 *
 * A phone number is spoken as eleven separate digits — "শূন্য এক সাত এক দুই …" —
 * so it must NOT go through the accumulator above, which would read the first
 * two as eleven. Only tokens worth exactly one digit are accepted; anything else
 * aborts, because a half-heard phone number is worse than none.
 */
export function parseSpokenDigits(text: string, expected?: number): string | null {
  const tokens = tokenise(text).filter((t) => !FILLER.has(t));
  let digits = '';

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      digits += token;
      continue;
    }
    const value = tokenValue(token);
    if (value === null || value > 9 || !Number.isInteger(value)) return null;
    digits += String(value);
  }

  if (!digits) return null;
  if (expected !== undefined && digits.length !== expected) return null;
  return digits;
}

/**
 * True when the text contains no numeric information at all, so a caller can
 * tell "said nothing about money" apart from "said something unparseable".
 */
export function hasNoNumber(text: string): boolean {
  return extractNumbers(text).length === 0;
}
