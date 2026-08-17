'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Mic, MicOff, Square, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useVoice } from '@/components/providers/VoiceProvider';

/**
 * The global microphone control.
 *
 * Design-system obligations, all load-bearing rather than decorative:
 *
 *  • It carries a VISIBLE LABEL, never a bare icon (BDS §9.5). A microphone
 *    glyph is not self-evident to a first-time user, and this is the control that
 *    exists for people who cannot read the rest of the screen.
 *  • 56 dp minimum, sitting above the bottom navigation so a thumb cannot hit
 *    both, and clear of the safe-area inset.
 *  • The listening state is shown three ways at once — changed label, changed
 *    icon, and a ring — and announced politely. Colour alone would fail.
 *
 * WHEN LISTENING IS IMPOSSIBLE it stays TAPPABLE and explains itself, rather than
 * greying out. Two reasons. First, BDS §10.1.4 prefers revealing the problem on
 * tap over a disabled dead end — and a disabled button whose only explanation is
 * an `aria-describedby` span is invisible to the sighted user staring at it,
 * which is how this component shipped its first version. Second, the reason is
 * usually fixable by the citizen (a browser without speech recognition, a denied
 * permission), and voice NAVIGATION still works by typing the command, because
 * intent resolution is deterministic and needs no microphone at all.
 */
export function VoiceButton({ className }: { readonly className?: string }) {
  const t = useTranslations('voice');
  // Two instances render at once — sidebar on desktop, floating on mobile — so a
  // hard-coded id would be duplicated in the document.
  const reasonId = useId();
  const { state, canListen, unavailableReason, start, stop, cancel, explainUnavailable } = useVoice();

  const listening = state === 'listening';
  const busy = state === 'transcribing';

  const reasonKey =
    unavailableReason === 'disabled' ? 'disabledInSettings'
    : unavailableReason === 'insecure' ? 'insecure'
    : unavailableReason === 'permission-denied' ? 'permissionDenied'
    : unavailableReason === 'no-microphone' ? 'noMicrophone'
    : unavailableReason === 'server-unavailable' ? 'serverSttUnavailable'
    : unavailableReason === 'browser-unavailable' ? 'browserRecognitionUnavailable'
    : unavailableReason === 'media-recorder-unavailable' ? 'mediaRecorderUnavailable'
    : unavailableReason === 'unsupported' ? 'unsupported'
    : null;

  const label = !canListen
    ? t('button')
    : listening
      ? t('stopListening')
      : busy
        ? t('transcribing')
        : t('button');

  const Icon = !canListen ? MicOff : listening ? Square : Mic;

  return (
    <div className={cn('flex flex-col items-stretch gap-1', className)}>
      <button
        type="button"
        onClick={() => {
          if (!canListen) {
            // Tapping tells you why, and offers the typed route.
            explainUnavailable();
            return;
          }
          if (listening) stop();
          else if (busy) cancel();
          else start();
        }}
        aria-describedby={reasonKey ? reasonId : undefined}
        aria-pressed={listening}
        className={cn(
          'inline-flex min-h-14 items-center justify-center gap-3 rounded-pill px-5',
          'type-label-lg shadow-elev-3 transition-colors duration-fast ease-standard',
          'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
          listening
            ? 'bg-ramp-error-600 text-text-on-brand ring-4 ring-ramp-error-200'
            : canListen
              ? 'bg-ramp-green-600 text-text-on-brand hover:bg-ramp-green-700 active:bg-ramp-green-800'
              : // Unavailable, not broken: a quiet secondary treatment that still
                // reads as pressable, since pressing it is how you learn why.
                'border-1.5 border-stroke bg-surface text-text-secondary shadow-none',
        )}
      >
        <Icon size={24} className="icon shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </button>

      {/* The reason, VISIBLE — not only exposed to assistive technology. */}
      {reasonKey ? (
        <button
          type="button"
          onClick={explainUnavailable}
          id={reasonId}
          className="flex items-center gap-1.5 rounded-md px-1 py-1 text-start type-caption text-text-secondary underline decoration-dotted underline-offset-2 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
        >
          <Keyboard size={16} className="icon shrink-0" aria-hidden="true" />
          <span>{t('typeInstead')}</span>
        </button>
      ) : null}

      {/* State changes are announced without stealing focus. */}
      <span aria-live="polite" className="sr-only">
        {listening ? t('listening') : busy ? t('transcribing') : ''}
      </span>
    </div>
  );
}
