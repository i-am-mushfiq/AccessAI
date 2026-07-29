import type { NumeralSystem } from '@/lib/domain/enums';

/**
 * BDS §4.3 — numeral handling.
 *
 * DEFAULT DIGIT SHAPE IS LATIN, even in Bangla UI. Phone keypads, operator
 * SMS, NID cards, bank statements and printed receipts in Bangladesh are
 * overwhelmingly Latin-digit; mixing shapes between the SMS a citizen reads
 * and the field they type into is a documented cause of OTP entry failure.
 * Bangla numerals are a display-only opt-in.
 */

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** Display-only conversion. Never applied to inputs or copyable codes. */
export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BENGALI_DIGITS[Number(d)]!);
}

/**
 * Accept BOTH digit shapes on every numeric input and normalise silently
 * (BDS §1.1 law 5 — forgiveness over precision). `০১৭১২৩৪৫৬৭৮` must work.
 */
export function toLatinDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d as (typeof BENGALI_DIGITS)[number])));
}

export function localiseDigits(text: string, numerals: NumeralSystem): string {
  return numerals === 'bengali' ? toBengaliDigits(text) : text;
}

/**
 * South-Asian (lakh/crore) grouping: three digits, then two-digit groups.
 * `12345678` → `1,23,45,678`. Never Western `12,345,678`.
 *
 * Implemented directly rather than via Intl because `Intl.NumberFormat('bn-BD')`
 * emits Bengali digits by default in some runtimes, which would silently defeat
 * the Latin-default rule above. Grouping is deterministic, so owning it is safer.
 */
export function groupSouthAsian(integerPart: string): string {
  const digits = integerPart.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  const grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${grouped},${tail}`;
}

export interface NumberFormatOptions {
  readonly numerals?: NumeralSystem;
  readonly decimals?: number;
  readonly grouping?: boolean;
}

export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const { numerals = 'latin', decimals = 0, grouping = true } = options;
  if (!Number.isFinite(value)) return '—';

  const negative = value < 0;
  const abs = Math.abs(value);
  const fixed = abs.toFixed(decimals);
  const [intRaw = '0', fracRaw] = fixed.split('.');
  const intPart = grouping ? groupSouthAsian(intRaw) : intRaw;
  const assembled = fracRaw ? `${intPart}.${fracRaw}` : intPart;
  const signed = negative ? `−${assembled}` : assembled;
  return localiseDigits(signed, numerals);
}

/**
 * Money. BDS §2.2 rule 3 and §4.3:
 *  • `৳` prefixed, no space
 *  • ALWAYS exactly two decimals in a transactional context, including `.00`
 *  • never abbreviated (`৳1.2K`, `৳5L` are red-line violations)
 *  • tabular figures (applied via the `.tabular` / `data-numeric` CSS hook)
 */
export function formatMoney(
  amount: number | null | undefined,
  options: { numerals?: NumeralSystem; decimals?: 0 | 2; withSymbol?: boolean } = {},
): string {
  const { numerals = 'latin', decimals = 2, withSymbol = true } = options;
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  const body = formatNumber(amount, { numerals, decimals, grouping: true });
  return withSymbol ? `৳${body}` : body;
}

/* ------------------------------------------------- amount in words (bn) */

/**
 * Bangla 0–99 is irregular, so a full table is the only correct approach —
 * generating "২১" as "বিশ এক" would be wrong (it is একুশ).
 */
/**
 * Exported so `number-words.ts` can INVERT these tables rather than retyping
 * them. Speech recognition hands back number words, and parsing them with a
 * second, hand-written vocabulary would let the two drift — a word this file can
 * produce but the parser cannot read is a spoken amount silently lost.
 */
export const BN_UNDER_100 = [
  'শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়',
  'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ',
  'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আটাশ', 'ঊনত্রিশ',
  'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'উনচল্লিশ',
  'চল্লিশ', 'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'উনপঞ্চাশ',
  'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'উনষাট',
  'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'উনসত্তর',
  'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'উনআশি',
  'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'উননব্বই',
  'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই',
] as const;

export const EN_UNDER_20 = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
] as const;
export const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;

function bnUnderThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${BN_UNDER_100[hundreds]} শত`);
  if (rest > 0) parts.push(BN_UNDER_100[rest]!);
  return parts.join(' ');
}

function enUnderThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${EN_UNDER_20[hundreds]} hundred`);
  if (rest > 0) {
    if (rest < 20) parts.push(EN_UNDER_20[rest]!);
    else {
      const t = EN_TENS[Math.floor(rest / 10)]!;
      const u = rest % 10;
      parts.push(u === 0 ? t : `${t}-${EN_UNDER_20[u]}`);
    }
  }
  return parts.join(' ');
}

/**
 * Amount echoed in words — BDS §10.2.3 calls this "the highest-value
 * error-prevention control in the whole system", because it makes a 10×
 * misreading impossible to miss. Applied to benefit amounts and any figure a
 * citizen must act on.
 */
export function amountInWords(amount: number, locale: 'bn' | 'en'): string {
  if (!Number.isFinite(amount)) return '';
  const whole = Math.floor(Math.abs(amount));
  const paisa = Math.round((Math.abs(amount) - whole) * 100);

  if (whole === 0 && paisa === 0) return locale === 'bn' ? 'শূন্য টাকা' : 'zero taka';

  const crore = Math.floor(whole / 10_000_000);
  const lakh = Math.floor((whole % 10_000_000) / 100_000);
  const thousand = Math.floor((whole % 100_000) / 1_000);
  const remainder = whole % 1_000;

  const segments: string[] = [];
  if (locale === 'bn') {
    if (crore > 0) segments.push(`${bnUnderThousand(crore)} কোটি`);
    if (lakh > 0) segments.push(`${BN_UNDER_100[lakh]} লাখ`);
    if (thousand > 0) segments.push(`${bnUnderThousand(thousand)} হাজার`);
    if (remainder > 0) segments.push(bnUnderThousand(remainder));
    let out = `${segments.join(' ')} টাকা`;
    if (paisa > 0) out += ` ${BN_UNDER_100[paisa]} পয়সা`;
    return out.replace(/\s+/g, ' ').trim();
  }

  if (crore > 0) segments.push(`${enUnderThousand(crore)} crore`);
  if (lakh > 0) segments.push(`${enUnderThousand(lakh)} lakh`);
  if (thousand > 0) segments.push(`${enUnderThousand(thousand)} thousand`);
  if (remainder > 0) segments.push(enUnderThousand(remainder));
  let out = `${segments.join(' ')} taka`;
  if (paisa > 0) out += ` and ${enUnderThousand(paisa)} paisa`;
  return out.replace(/\s+/g, ' ').trim();
}

/* --------------------------------------------------------------- phone */

/**
 * Normalise to the canonical 11-digit local form `01XXXXXXXXX`.
 * Accepts `+8801712345678`, `8801712345678`, `01712 345 678`, `০১৭১২৩৪৫৬৭৮`.
 */
export function normalisePhone(input: string): string | null {
  let local = toLatinDigits(input).replace(/\D/g, '');

  // Steps are sequential, not exclusive: "+8801712345678" must first lose the
  // country code and THEN regain its leading zero.
  if (local.length === 13 && local.startsWith('880')) local = local.slice(3);
  else if (local.length === 14 && local.startsWith('0880')) local = local.slice(4);
  if (local.length === 10 && local.startsWith('1')) local = `0${local}`;

  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

/** Display form `01712-345678` — 11 digits, single hyphen after 5 (BDS §4.3). */
export function formatPhone(input: string, numerals: NumeralSystem = 'latin'): string {
  const local = normalisePhone(input) ?? toLatinDigits(input).replace(/\D/g, '');
  if (local.length !== 11) return localiseDigits(input, numerals);
  return localiseDigits(`${local.slice(0, 5)}-${local.slice(5)}`, numerals);
}

/** Masked form for "we sent a code to …" without exposing the full number. */
export function maskPhone(input: string, numerals: NumeralSystem = 'latin'): string {
  const local = normalisePhone(input);
  if (!local) return input;
  return localiseDigits(`${local.slice(0, 5)}-***${local.slice(-3)}`, numerals);
}

/** Free confirmation that the right number was entered (BDS §10.2.4). */
const OPERATOR_PREFIXES: Record<string, { en: string; bn: string }> = {
  '013': { en: 'Grameenphone', bn: 'গ্রামীণফোন' },
  '017': { en: 'Grameenphone', bn: 'গ্রামীণফোন' },
  '014': { en: 'Banglalink', bn: 'বাংলালিংক' },
  '019': { en: 'Banglalink', bn: 'বাংলালিংক' },
  '015': { en: 'Teletalk', bn: 'টেলিটক' },
  '016': { en: 'Airtel', bn: 'এয়ারটেল' },
  '018': { en: 'Robi', bn: 'রবি' },
};

export function detectOperator(input: string, locale: 'bn' | 'en'): string | null {
  const digits = toLatinDigits(input).replace(/\D/g, '');
  const local = digits.startsWith('880') ? `0${digits.slice(3)}` : digits;
  const prefix = local.slice(0, 3);
  const hit = OPERATOR_PREFIXES[prefix];
  return hit ? hit[locale] : null;
}
