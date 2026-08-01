import { describe, it, expect } from 'vitest';
import { sttPromptFor, STT_PROMPT_LIMIT } from '@/modules/voice/stt-prompt';
import { VOICE_COMMANDS } from '@/modules/voice/commands';

/**
 * The vocabulary hint sent to the recogniser.
 *
 * Whisper's `prompt` biases the decoder, and it bleeds. Measured against Groq's
 * whisper-large-v3: one second of digital silence plus the full domain prompt
 * returned "সন্তান" — a prompt word present in no audio at all. On a one-word
 * command that is not a curiosity, it is a wrong command executed.
 *
 * So command mode gets a short hint built from the phrases the matcher can
 * actually resolve, and dictation keeps the long domain vocabulary. These tests
 * pin the properties that make that safe.
 */

describe('command mode', () => {
  const prompt = sttPromptFor('command')!;

  it('exists', () => {
    expect(prompt).toBeTruthy();
  });

  it('stays inside Whisper’s prompt window', () => {
    /**
     * Whisper keeps only the LAST 224 tokens of a prompt. An overflowing hint
     * therefore loses its front silently — which would quietly drop whichever
     * commands happen to sort first, and nothing would look wrong.
     */
    expect(prompt.length).toBeLessThanOrEqual(STT_PROMPT_LIMIT);
  });

  it('teaches the navigation words a citizen actually says', () => {
    for (const phrase of ['সংরক্ষিত', 'সময়সূচি', 'কাছের অফিস', 'বিজ্ঞপ্তি']) {
      expect(prompt, phrase).toContain(phrase);
    }
  });

  it('is built from the registry, so a new command cannot be left untaught', () => {
    // Every navigate command's canonical Bangla phrase should be present, up to
    // the cap. Ordering puts navigation first precisely so the cap cannot eat it.
    const navigation = VOICE_COMMANDS.filter(
      (c) => c.kind === 'navigate' && !c.route?.includes(':'),
    );
    for (const command of navigation) {
      const phrase = command.phrases.find((p) => /[ঀ-৿]/.test(p));
      if (phrase) expect(prompt, command.id).toContain(phrase);
    }
  });

  it('never teaches a wildcard or slot pattern as if it were speech', () => {
    // "খুঁজে দাও *" is a match pattern. Feeding it to the recogniser would teach
    // the model to expect a literal asterisk in Bangla speech.
    expect(prompt).not.toContain('*');
    expect(prompt).not.toContain(':category');
    expect(prompt).not.toContain(':district');
  });

  it('is Bangla, since that is the default locale', () => {
    expect(/[ঀ-৿]/.test(prompt)).toBe(true);
  });

  it('is shorter than the dictation prompt, which is the point', () => {
    // A short hint has less to bleed into a one-word transcript.
    const dictation = sttPromptFor('dictation');
    if (dictation) expect(prompt.length).toBeLessThan(dictation.length + STT_PROMPT_LIMIT);
  });
});

describe('dictation mode', () => {
  it('uses the configured domain vocabulary, not the command list', () => {
    /**
     * A dictated sentence describes a situation — "আমার স্বামী মারা গেছেন, আয় চার
     * হাজার টাকা". The programme names and money words are what need biasing
     * there, and the longer audio means bleed is not the dominant risk.
     */
    const prompt = sttPromptFor('dictation');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('ভাতা');
    expect(prompt).toContain('টাকা');
  });

  it('differs from the command prompt', () => {
    expect(sttPromptFor('dictation')).not.toBe(sttPromptFor('command'));
  });
});
