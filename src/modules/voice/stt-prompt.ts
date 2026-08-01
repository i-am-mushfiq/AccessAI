import { env } from '@/lib/config/env';
import { VOICE_COMMANDS } from './commands';

/**
 * The vocabulary hint sent to the recogniser, chosen by what the citizen is doing.
 *
 * Whisper's `prompt` biases the decoder toward words it expects. That cuts both
 * ways, and the evidence for both directions is direct:
 *
 *  • It genuinely helps rare multi-word terms. "বিধবা ভাতা" is not something a
 *    general model has any reason to prefer over similar-sounding nonsense.
 *  • It BLEEDS. Given one second of digital silence and the full domain prompt,
 *    Groq's whisper-large-v3 returned "সন্তান" — a word straight out of the
 *    prompt, present in no audio. On a one-word command that is not a curiosity:
 *    the model can emit a prompt word instead of what was said.
 *
 * The two uses of the microphone want opposite things, so they get different
 * prompts rather than one compromise:
 *
 *  COMMAND — a one-word utterance like "সংরক্ষিত". Short, and the set of things
 *  it could legitimately be is a FIXED, known list. Biasing toward exactly the
 *  phrases the matcher can resolve is close to free accuracy, and it keeps the
 *  prompt short, which limits how much there is to bleed. Built from the registry
 *  so it cannot drift: a command added without its vocabulary would otherwise be
 *  the one that transcribes worst.
 *
 *  DICTATION — a sentence typed into chat, describing a situation. Here the
 *  programme names and the money words are what matter, and the longer audio
 *  gives the model enough signal that bleed is not the dominant risk.
 */

export type SttPurpose = 'command' | 'dictation';

/**
 * Whisper truncates the prompt to its last 224 tokens, and Bangla tokenises
 * heavily — roughly a token per two or three characters. Capping by characters
 * keeps the whole hint inside that window; a prompt that overflows silently
 * loses its FRONT, which would quietly drop whichever commands sort first.
 */
const MAX_PROMPT_CHARS = 560;

const isBangla = (phrase: string) => /[ঀ-৿]/.test(phrase);

/**
 * The phrase to teach the recogniser for each command.
 *
 * One per command, not all of them: the registry holds many spellings and
 * politeness variants so the MATCHER is forgiving, but the recogniser only needs
 * the canonical form — the fuzzy matching downstream absorbs the rest.
 */
function commandVocabulary(): string[] {
  const phrases: string[] = [];

  // Navigation and meta first. If the cap bites, these are the ones a citizen
  // driving the app by voice actually says.
  const ordered = [
    ...VOICE_COMMANDS.filter((c) => c.kind === 'navigate'),
    ...VOICE_COMMANDS.filter((c) => c.kind === 'action'),
    ...VOICE_COMMANDS.filter((c) => c.kind === 'meta' && !c.confirmationOnly),
  ];

  for (const command of ordered) {
    const phrase = command.phrases.find(isBangla);
    // Wildcards are patterns, not utterances: "খুঁজে দাও *" would teach the model
    // to expect an asterisk.
    if (phrase && !phrase.includes('*') && !phrase.includes(':')) phrases.push(phrase);
  }

  return phrases;
}

/** Join, then trim to the cap on a phrase boundary rather than mid-word. */
function capped(phrases: readonly string[]): string {
  const out: string[] = [];
  let length = 0;

  for (const phrase of phrases) {
    const cost = phrase.length + 2;
    if (length + cost > MAX_PROMPT_CHARS) break;
    out.push(phrase);
    length += cost;
  }

  return out.join(', ');
}

let commandPromptCache: string | null = null;

export function sttPromptFor(purpose: SttPurpose): string | undefined {
  if (purpose === 'dictation') {
    // The configured domain vocabulary: programme names, money words.
    return env.STT_PROMPT || undefined;
  }

  commandPromptCache ??= capped(commandVocabulary());
  return commandPromptCache || undefined;
}

/** Exposed for the test that asserts the prompt stays inside Whisper's window. */
export const STT_PROMPT_LIMIT = MAX_PROMPT_CHARS;
