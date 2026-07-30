/**
 * Turning a screen into something worth listening to.
 *
 * Read-aloud is NOT "read the page". A programme page is roughly nine hundred
 * words, and a synthesiser reads at about 150 a minute: six minutes of audio
 * before the citizen learns whether they qualify. Nobody listens to six minutes.
 * So each screen declares a SUMMARY, ordered by what the listener has to decide,
 * and the long tail — sources, trust factors, related programmes — is left to the
 * eye and to follow-up questions.
 *
 * Three things this module exists to get right:
 *
 *  1. **Sentence boundaries.** A synthesiser pauses on a terminator and runs
 *     everything else together. Bangla ends a sentence with দাঁড়ি (।), not a full
 *     stop, and a Bangla voice given "." often does not pause at all — the result
 *     is one unbroken minute-long breath that is far harder to follow than the
 *     written text it replaced.
 *
 *  2. **Truncation that says it truncated.** A list read aloud has no scrollbar.
 *     Cutting at five items without a word about the rest tells the listener they
 *     have heard everything — a citizen with eleven deadlines would put the phone
 *     down believing they had six fewer things to do.
 *
 *  3. **Numbers as words.** "৪৫০০" is a coin toss across synthesisers; some
 *     read the digits one by one, some ignore Bangla numerals entirely. Callers
 *     pass amounts through `amountInWords` first, and this module never
 *     synthesises a bare numeral into speech copy.
 */

import { BN_UNDER_100, EN_TENS, EN_UNDER_20 } from '@/lib/format/numerals';

/** A fragment that may not exist on this record; falsy entries are dropped. */
export type Fragment = string | null | undefined | false;

const TERMINATOR: Record<'bn' | 'en', string> = { bn: '।', en: '.' };

/** Anything that already closes a sentence, in either script. */
const ENDS_SENTENCE = /[।.!?:]$/u;

/**
 * Join fragments into spoken sentences.
 *
 * Each surviving fragment gets a terminator so the voice breathes between them,
 * unless it already ends in one — appending "।" to "কত টাকা?" would have the
 * synthesiser read a question with a statement's falling tone.
 */
export function speakable(locale: 'bn' | 'en', parts: readonly Fragment[]): string {
  const end = TERMINATOR[locale];

  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => {
      const trimmed = part.trim().replace(/\s+/gu, ' ');
      return ENDS_SENTENCE.test(trimmed) ? trimmed : `${trimmed}${end}`;
    })
    .join(' ');
}

/**
 * A label and its value as one spoken clause.
 *
 * Returns null when there is no value, so the caller can pass it straight into
 * `speakable` — reading "Deadline: not known" aloud for every field a programme
 * happens to lack is how a thirty-second clip becomes ninety.
 */
export function clause(label: string, value: Fragment): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return `${label}: ${value.trim()}`;
}

/** Read at most `limit` items, and say plainly how many were left out. */
export interface SpokenListOptions {
  readonly limit: number;
  /** Given the number NOT read, returns the sentence admitting it. */
  readonly more: (remaining: number) => string;
}

export function spokenList(
  locale: 'bn' | 'en',
  items: readonly Fragment[],
  { limit, more }: SpokenListOptions,
): string {
  const present = items.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
  const read = present.slice(0, Math.max(0, limit));
  const remaining = present.length - read.length;

  return speakable(locale, [...read, remaining > 0 ? more(remaining) : null]);
}

/**
 * How many list items a screen reads before summarising the rest.
 *
 * Five is roughly twenty seconds of Bangla speech — long enough to be useful,
 * short enough that a listener can still hold the first item in their head when
 * the last one finishes.
 */
export const SPOKEN_LIST_LIMIT = 5;

/**
 * A plain count as a spoken word: 12 → "বারো" / "twelve".
 *
 * Necessary because a numeral inside speech copy is only as good as the voice
 * reading it. The browser's own synthesiser — the offline fallback, and the only
 * option where no TTS key is configured — has no Bangla number handling at all:
 * given "১২ দিন বাকি" an English voice skips the numerals silently and says
 * "din baki", turning "twelve days left" into "days left". A citizen who cannot
 * read the screen has then been told nothing about their deadline.
 *
 * Only 0–99 is worth a table. Above that, a numeral is returned unchanged: day
 * counts and list lengths do not reach three digits here, and money already has
 * `amountInWords`, which handles লাখ and কোটি properly.
 */
export function countInWords(value: number, locale: 'bn' | 'en'): string {
  if (!Number.isFinite(value)) return '';
  const n = Math.abs(Math.round(value));
  if (n > 99) return String(n);

  if (locale === 'bn') return BN_UNDER_100[n] ?? String(n);
  if (n < 20) return EN_UNDER_20[n] ?? String(n);

  const tens = EN_TENS[Math.floor(n / 10)] ?? '';
  const units = n % 10;
  return units === 0 ? tens : `${tens}-${EN_UNDER_20[units]}`;
}
