'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mic, Square } from 'lucide-react';
import { useVoice } from '@/components/providers/VoiceProvider';
import { parseSpokenDigits } from '@/lib/format/number-words';

/**
 * Speaking a number instead of typing it.
 *
 * Eleven digits on a phone keypad, or six into six separate boxes, is the point
 * at which a lot of people give up: an older citizen with a tremor, anyone whose
 * eyesight cannot resolve the boxes, anyone holding a baby. BDS §10.2.5 calls the
 * code screen the most failure-prone in the whole category, and accessible
 * authentication is a WCAG 2.2 requirement rather than a nicety.
 *
 * Three rules make this safe enough to put next to an authentication field.
 *
 *  1. **Exact length or nothing.** `parseSpokenDigits` is given the expected
 *     count and returns null on any other result. A half-heard phone number is
 *     worse than none — it looks deliberate, so the citizen sends a code to a
 *     stranger's handset and cannot work out why nothing arrived.
 *
 *  2. **It never submits.** The digits land in the field and the citizen presses
 *     the button themselves. Auto-submitting a misheard code burns an attempt of
 *     the small number a challenge allows.
 *
 *  3. **A failure says what it heard.** "Could not understand" is a dead end;
 *     showing the actual transcript turns it into a fixable problem — the citizen
 *     sees "শূন্য এক সাত হাজার" and knows to say the digits separately. This is
 *     also the only way anyone can diagnose a Bangla recognition problem in the
 *     field.
 *
 * Deliberately NOT offered for the PIN. A PIN is a reusable secret; a code is
 * single-use and expires in minutes. Inviting someone to say their PIN out loud
 * in a shared room, a market, or a government office queue — which is where this
 * audience uses phones — would be handing it to whoever is standing there, and
 * unlike a misheard digit it is a harm the app cannot undo.
 */
export function DictateDigits({
  digits,
  onDigits,
  label,
  phone,
  className,
}: {
  /** Exactly how many digits the field takes. Anything else is rejected. */
  readonly digits: number;
  readonly onDigits: (value: string) => void;
  /** Accessible name, e.g. "Say your mobile number". */
  readonly label: string;
  /**
   * The number being signed in with, when this sits on the sign-in screen.
   * Lets the server authorise a clip from a citizen who has no session yet.
   */
  readonly phone?: string;
  readonly className?: string;
}) {
  const t = useTranslations('voice');
  const voice = useVoice();

  /** True only while THIS control owns the microphone. */
  const [mine, setMine] = useState(false);
  /** What was heard but could not be read as digits. */
  const [misheard, setMisheard] = useState<string | null>(null);

  const busy = mine && (voice.state === 'listening' || voice.state === 'transcribing');

  // If the shared voice layer moves on — an error, a cancel, a route change —
  // this control must stop claiming the microphone, or its spinner would run for
  // the rest of the session.
  const stateRef = useRef(voice.state);
  stateRef.current = voice.state;
  useEffect(() => {
    if (mine && voice.state !== 'listening' && voice.state !== 'transcribing') setMine(false);
  }, [mine, voice.state]);

  if (!voice.canListen) {
    // Not hidden. A citizen who cannot type the digits needs to know that voice
    // exists and why it is off, so they can act on it — enable it in settings,
    // or ask someone. A missing button teaches nothing.
    const reasonId = `dictate-reason-${digits}`;
    const reason =
      voice.unavailableReason === 'disabled'
        ? t('disabledInSettings')
        : voice.unavailableReason === 'insecure'
          ? t('insecure')
          : t('unsupported');

    return (
      <div className={className}>
        <button
          type="button"
          disabled
          aria-label={label}
          // The reason is wired up with aria-describedby AND rendered visibly.
          // A `title` tooltip alone reaches neither a keyboard user nor a touch
          // user, which between them is most of this audience.
          aria-describedby={reasonId}
          className="inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-md border-1.5 border-stroke px-3 type-label-md text-text-tertiary opacity-60"
        >
          <Mic size={20} className="icon" aria-hidden="true" />
          <span aria-hidden="true">{t('speakDigits')}</span>
        </button>
        <p id={reasonId} className="type-caption mt-1 text-text-secondary">
          {reason}
        </p>
      </div>
    );
  }

  const listen = () => {
    setMisheard(null);
    setMine(true);
    voice.dictate(
      (text) => {
        setMine(false);
        const parsed = parseSpokenDigits(text, digits);
        if (parsed) {
          onDigits(parsed);
          return;
        }
        setMisheard(text);
      },
      phone ? { phone } : {},
    );
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => (busy ? voice.stop() : listen())}
        aria-label={label}
        className="inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-md border-1.5 border-stroke px-3 type-label-md text-text-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
      >
        {busy ? (
          <Square size={20} className="icon" aria-hidden="true" />
        ) : (
          <Mic size={20} className="icon" aria-hidden="true" />
        )}
        <span aria-hidden="true">{busy ? t('stopListening') : t('speakDigits')}</span>
      </button>

      {/* One live region for every outcome, so a screen reader announces the
          state change without the control moving or resizing under a thumb. */}
      <p aria-live="polite" className="type-caption mt-1 text-text-secondary">
        {busy && voice.state === 'listening' ? t('listening') : null}
        {busy && voice.state === 'transcribing' ? t('transcribing') : null}
        {!busy && misheard ? (
          <span className="text-text-error">
            {t('digitsNotUnderstood', { count: digits })}
            {/* Shown verbatim: this is what makes the failure fixable. */}
            {' “'}
            {misheard}
            {'”'}
          </span>
        ) : null}
      </p>
    </div>
  );
}
