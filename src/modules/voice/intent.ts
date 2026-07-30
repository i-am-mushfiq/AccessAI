import {
  VOICE_COMMANDS, COMMAND_BY_ID, CATEGORY_PHRASES, LIFE_EVENT_PHRASES, DISTRICT_PHRASES,
  type VoiceCommand, type ConfirmPolicy,
} from './commands';
import { parseAmount } from '@/lib/format/number-words';

/**
 * Deterministic intent resolution for spoken commands.
 *
 * The contract this file owes the rest of the app:
 *
 *  1. It NEVER returns a command it is not reasonably sure of. Below the
 *     threshold it returns `kind: 'unmatched'` with suggestions, and the caller
 *     offers the utterance to the assistant as a question instead. Guessing is
 *     the failure mode that makes voice interfaces feel hostile.
 *
 *  2. It reports WHY it matched — exact, prefix, or fuzzy — so the UI can decide
 *     whether to confirm. A fuzzy match on a destructive action must always be
 *     read back.
 *
 *  3. It is a pure function of (transcript, context). No network, no clock, no
 *     model. That makes every routing decision reproducible from the transcript
 *     alone, which is what lets the whole thing be unit-tested.
 *
 * Scoring is intentionally simple and legible rather than clever: exact phrase,
 * then whole-phrase containment, then token overlap with a length-aware
 * tie-break. A citizen's command is three words long; there is nothing here that
 * needs an embedding.
 */

export type MatchQuality = 'exact' | 'contains' | 'fuzzy';

export interface ResolvedSlots {
  readonly query?: string;
  readonly district?: string;
  readonly category?: string;
  readonly lifeEvent?: string;
  readonly index?: number;
  readonly amount?: number;
}

export interface IntentMatch {
  readonly kind: 'command';
  readonly command: VoiceCommand;
  readonly quality: MatchQuality;
  /** 0–100. Not a probability — a legible ranking score. */
  readonly score: number;
  readonly slots: ResolvedSlots;
  /** The route with slots substituted, for navigate commands. */
  readonly href?: string;
  /** Whether the caller must confirm before acting. */
  readonly needsConfirmation: boolean;
  readonly transcript: string;
}

export interface IntentUnmatched {
  readonly kind: 'unmatched';
  readonly transcript: string;
  /** Best near-misses, for "did you mean…". */
  readonly suggestions: readonly { command: VoiceCommand; score: number }[];
}

export type IntentResult = IntentMatch | IntentUnmatched;

export interface IntentContext {
  readonly locale: 'bn' | 'en';
  readonly authenticated: boolean;
  readonly isStaff: boolean;
  /** Commands that only make sense on the current screen, e.g. "save this". */
  readonly availableActions?: readonly string[];
}

/* ----------------------------------------------------------- normalising */

/**
 * Normalises for comparison only. Keeps Bangla marks (`\p{M}`) — dropping them
 * shreds every Bangla word into consonants, which is a bug this codebase has
 * already been bitten by once, in the number-word tokeniser.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}\s*]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return normalise(text).split(' ').filter(Boolean);
}

/**
 * Bangla postpositions and English filler that carry no intent. Stripping them
 * lets "সংরক্ষিত তালিকা দেখাও" match the phrase "সংরক্ষিত".
 */
const STOPWORDS = new Set([
  'দাও', 'দেখাও', 'করো', 'করুন', 'দেখান', 'চাই', 'যাও', 'যাব', 'আমাকে', 'আমার', 'এর', 'এ', 'তে', 'কে', 'টা', 'টি',
  'please', 'show', 'me', 'my', 'the', 'to', 'go', 'open', 'take', 'i', 'want', 'a', 'an', 'of',
]);

function contentTokens(text: string): string[] {
  const all = tokens(text);
  const filtered = all.filter((t) => !STOPWORDS.has(t));
  // Never strip everything: "দেখাও" alone should still be comparable.
  return filtered.length > 0 ? filtered : all;
}

/* --------------------------------------------------------- slot matching */

function matchVocabulary(
  text: string,
  vocabulary: Record<string, readonly string[]>,
): { key: string; phrase: string } | null {
  const haystack = normalise(text);
  let best: { key: string; phrase: string } | null = null;

  for (const [key, phrases] of Object.entries(vocabulary)) {
    for (const phrase of phrases) {
      const needle = normalise(phrase);
      if (!needle) continue;
      if (haystack === needle || haystack.includes(needle)) {
        // Longest match wins: "স্বামী মারা" must beat a bare "মারা" elsewhere.
        if (!best || needle.length > normalise(best.phrase).length) {
          best = { key, phrase };
        }
      }
    }
  }
  return best;
}

function extractSlots(transcript: string, command: VoiceCommand): ResolvedSlots {
  const slots: Record<string, unknown> = {};

  for (const spec of command.slots ?? []) {
    switch (spec.name) {
      case 'category': {
        const hit = matchVocabulary(transcript, CATEGORY_PHRASES);
        if (hit) slots.category = hit.key;
        break;
      }
      case 'lifeEvent': {
        const hit = matchVocabulary(transcript, LIFE_EVENT_PHRASES);
        if (hit) slots.lifeEvent = hit.key;
        break;
      }
      case 'district': {
        const hit = matchVocabulary(transcript, DISTRICT_PHRASES);
        if (hit) slots.district = hit.key;
        break;
      }
      case 'amount': {
        const amount = parseAmount(transcript);
        if (amount !== null) slots.amount = amount;
        break;
      }
      case 'query': {
        // Whatever remains once the trigger words are removed IS the query.
        const query = stripTriggerWords(transcript, command);
        if (query) slots.query = query;
        break;
      }
      case 'index': {
        const amount = parseAmount(transcript);
        if (amount !== null && Number.isInteger(amount) && amount > 0) slots.index = amount;
        break;
      }
    }
  }

  return slots as ResolvedSlots;
}

/**
 * Removes the command's own trigger words, leaving the free-text payload.
 *
 * "খুঁজে দাও বিধবা ভাতা" must yield "বিধবা ভাতা", not the whole sentence —
 * searching for the words "search for" finds nothing.
 */
function stripTriggerWords(transcript: string, command: VoiceCommand): string {
  let remaining = normalise(transcript);

  const triggers = command.phrases
    .map((phrase) => normalise(phrase.replace(/\*/g, ' ')).trim())
    .filter(Boolean)
    // Longest first, so "search for" is removed before "search".
    .sort((a, b) => b.length - a.length);

  for (const trigger of triggers) {
    if (!trigger) continue;
    /**
     * The utterance is ONLY the trigger — "খুঁজে দাও" with nothing after it.
     * Without this case the trigger survives as its own payload and the app
     * searches for the words "search for", which returns nothing and looks
     * broken. An empty payload makes the required-slot check reject the command,
     * so the citizen is asked what to search for instead.
     */
    if (remaining === trigger) return '';
    if (remaining.startsWith(`${trigger} `)) {
      remaining = remaining.slice(trigger.length).trim();
      break;
    }
    if (remaining.endsWith(` ${trigger}`)) {
      remaining = remaining.slice(0, -trigger.length).trim();
      break;
    }
    if (remaining.includes(` ${trigger} `)) {
      remaining = remaining.replace(` ${trigger} `, ' ').trim();
      break;
    }
  }

  return remaining;
}

/* ------------------------------------------------------------- scoring */

interface Scored {
  readonly command: VoiceCommand;
  readonly score: number;
  readonly quality: MatchQuality;
}

/** Jaccard overlap on content tokens, 0–1. */
function overlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const token of new Set(a)) if (setB.has(token)) shared += 1;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : shared / union;
}

function scoreCommand(transcript: string, command: VoiceCommand): Scored | null {
  const said = normalise(transcript);
  const saidTokens = new Set(tokens(said));
  const saidContent = contentTokens(transcript);
  let best: Scored | null = null;

  for (const rawPhrase of command.phrases) {
    // A `*` marks where free text goes; for scoring, compare only the fixed part.
    const wildcard = rawPhrase.includes('*');
    const phrase = normalise(rawPhrase.replace(/\*/g, ' ').replace(/:\w+/g, ' ')).trim();
    if (!phrase) continue;

    let score: number;
    let quality: MatchQuality;

    if (said === phrase) {
      score = 100;
      quality = 'exact';
    } else if (wildcard && (said.startsWith(`${phrase} `) || said.endsWith(` ${phrase}`))) {
      // "খুঁজে দাও বিধবা ভাতা" — the trigger is present and the rest is payload.
      score = 92;
      quality = 'contains';
    } else if (said.includes(phrase)) {
      // Longer matched phrases are stronger evidence than short ones.
      const coverage = phrase.length / Math.max(said.length, 1);
      score = 70 + Math.round(coverage * 22);
      quality = 'contains';
    } else if (phrase.includes(said) && said.length >= 3) {
      /**
       * The citizen said a PREFIX or fragment of a longer phrase — "সময়" for
       * "সময়সূচি". Recognisers truncate constantly on a short utterance, and
       * scoring these at zero produced the worst possible result: unmatched with
       * no suggestions, so the UI had nothing to offer.
       */
      const coverage = said.length / phrase.length;
      score = Math.round(coverage * 60);
      quality = 'fuzzy';
    } else {
      const ratio = overlap(saidContent, contentTokens(phrase));
      if (ratio === 0) continue;
      score = Math.round(ratio * 65);
      quality = 'fuzzy';
    }

    if (!best || score > best.score) best = { command, score, quality };
  }

  return best;
}

/* ------------------------------------------------------------- resolving */

/** Below this, we ask rather than act. */
const MATCH_THRESHOLD = 45;
/** A fuzzy match on a state-changing command must be read back first. */
const CONFIRM_BELOW = 92;

function isAvailable(command: VoiceCommand, context: IntentContext): boolean {
  // Yes/no are replies to a confirmation, never commands in their own right.
  if (command.confirmationOnly) return false;
  if (command.auth && !context.authenticated) return false;
  if (command.staffOnly && !context.isStaff) return false;
  if (command.kind === 'action' && context.availableActions) {
    return context.availableActions.includes(command.id);
  }
  return true;
}

function buildHref(command: VoiceCommand, slots: ResolvedSlots, locale: 'bn' | 'en'): string | undefined {
  if (!command.route) return undefined;

  let route = command.route;
  for (const [name, value] of Object.entries(slots)) {
    if (value === undefined || value === null || value === '') continue;
    route = route.replace(`:${name}`, encodeURIComponent(String(value)));
  }
  // An unfilled placeholder would produce a literal ":query" in the URL.
  if (route.includes(':')) return undefined;

  return `/${locale}${route}`;
}

function needsConfirmation(policy: ConfirmPolicy, score: number): boolean {
  if (policy === 'always') return true;
  if (policy === 'never') return false;
  return score < CONFIRM_BELOW;
}

export function resolveIntent(transcript: string, context: IntentContext): IntentResult {
  const cleaned = transcript.trim();
  if (!cleaned) return { kind: 'unmatched', transcript: cleaned, suggestions: [] };

  const scored = VOICE_COMMANDS
    .filter((command) => isAvailable(command, context))
    .map((command) => scoreCommand(cleaned, command))
    .filter((entry): entry is Scored => entry !== null)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < MATCH_THRESHOLD) {
    return {
      kind: 'unmatched',
      transcript: cleaned,
      suggestions: scored.slice(0, 3).map(({ command, score }) => ({ command, score })),
    };
  }

  /**
   * An ambiguous top pair is treated as no match rather than a coin flip.
   * "কর্মসূচি" scoring equally for the list and a category filter should ask,
   * not pick — and the threshold is tight (5 points) so genuine near-ties are
   * rare enough that this does not become annoying.
   */
  const runnerUp = scored[1];
  if (runnerUp && top.score - runnerUp.score < 5 && top.quality === 'fuzzy') {
    return {
      kind: 'unmatched',
      transcript: cleaned,
      suggestions: scored.slice(0, 3).map(({ command, score }) => ({ command, score })),
    };
  }

  /**
   * A wildcard trigger must not swallow a navigation command.
   *
   * "show me my saved programmes" matches the search trigger `show me *` with
   * high confidence, but the citizen asked for a SCREEN, not a search. So when
   * the top match is a wildcard search, the residual payload is re-resolved: if
   * it is itself a confident command, that command wins.
   *
   * The recursion is bounded — the payload is strictly shorter each time, and the
   * re-resolution runs against a context with search disabled, so it cannot
   * bounce back here.
   */
  if (top.command.slots?.some((s) => s.name === 'query')) {
    const payload = stripTriggerWords(cleaned, top.command);
    if (payload && payload !== normalise(cleaned)) {
      const inner = VOICE_COMMANDS
        .filter((command) => command.id !== top.command.id && isAvailable(command, context))
        .filter((command) => !command.slots?.some((s) => s.name === 'query'))
        .map((command) => scoreCommand(payload, command))
        .filter((entry): entry is Scored => entry !== null)
        .sort((a, b) => b.score - a.score)[0];

      if (inner && inner.score >= 70) {
        const innerSlots = extractSlots(payload, inner.command);
        const innerHref = buildHref(inner.command, innerSlots, context.locale);
        return {
          kind: 'command',
          command: inner.command,
          quality: inner.quality,
          score: inner.score,
          slots: innerSlots,
          ...(innerHref ? { href: innerHref } : {}),
          needsConfirmation: needsConfirmation(inner.command.confirm, inner.score),
          transcript: cleaned,
        };
      }
    }
  }

  const slots = extractSlots(cleaned, top.command);

  // A command that requires a slot it could not fill is not a match. Navigating
  // to a search page with no query wastes the citizen's turn.
  for (const spec of top.command.slots ?? []) {
    if (spec.required && (slots as Record<string, unknown>)[spec.name] === undefined) {
      return {
        kind: 'unmatched',
        transcript: cleaned,
        suggestions: scored.slice(0, 3).map(({ command, score }) => ({ command, score })),
      };
    }
  }

  const href = buildHref(top.command, slots, context.locale);

  return {
    kind: 'command',
    command: top.command,
    quality: top.quality,
    score: top.score,
    slots,
    ...(href ? { href } : {}),
    needsConfirmation: needsConfirmation(top.command.confirm, top.score),
    transcript: cleaned,
  };
}

/**
 * Yes/no detection for the confirmation step.
 *
 * Deliberately strict, in three ways:
 *
 *  • NO is tested first and by whole token, because "করো না" ("do NOT do it")
 *    contains "করো" ("do it"). Getting this backwards performs the action the
 *    citizen just refused.
 *  • A yes must be the whole utterance or a token in a SHORT one (≤3 tokens).
 *    A long sentence containing "ok" is someone thinking aloud, not consenting.
 *  • Anything else is `unclear`, which re-prompts. Silence is never consent.
 */
export function resolveConfirmation(transcript: string): 'yes' | 'no' | 'unclear' {
  const said = normalise(transcript);
  if (!said) return 'unclear';

  const spoken = tokens(said);
  const spokenSet = new Set(spoken);
  const yes = COMMAND_BY_ID.get('meta.yes')!;
  const no = COMMAND_BY_ID.get('meta.no')!;

  /**
   * A single-word reply matches only if EVERY word spoken belongs to that
   * reply's vocabulary.
   *
   * A token-anywhere rule is not safe enough. "সেভ করো" ("save it") is two tokens
   * and contains "করো", a yes-word — so during a confirmation for *unsaving*,
   * that sentence would have approved the unsave. Requiring the whole utterance
   * to be affirmative keeps "হ্যাঁ করো" working while rejecting any sentence
   * carrying other meaning. Multi-word phrases ("করো না", "cancel that") still
   * match by containment, since they are unambiguous alone.
   *
   * There is deliberately NO filler allowance. A first attempt permitted neutral
   * words like "ok", which then matched EVERY token of the utterance "ok" against
   * the *no* vocabulary as well and turned a plain yes into a refusal. Anything
   * not clearly affirmative or negative returns `unclear` and re-prompts, which
   * costs one extra second and cannot act against the citizen's wishes.
   */
  const matches = (command: VoiceCommand): boolean => {
    const single = new Set<string>();
    for (const phrase of command.phrases) {
      const needle = normalise(phrase);
      if (said === needle) return true;
      if (needle.includes(' ')) {
        if (said.includes(needle)) return true;
      } else {
        single.add(needle);
      }
    }
    return spoken.length > 0 && spoken.every((token) => single.has(token));
  };

  if (matches(no)) return 'no';
  if (matches(yes)) return 'yes';
  return 'unclear';
}
