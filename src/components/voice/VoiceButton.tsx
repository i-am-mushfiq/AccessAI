'use client';

import { useTranslations } from 'next-intl';
import { Mic, MicOff, Square } from 'lucide-react';
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
 *  • When it cannot work it stays VISIBLE and DISABLED with the reason attached
 *    through `aria-describedby` — an accessibility affordance that silently does
 *    nothing is worse than one that explains itself (BDS §10.1.4).
 *  • The listening state is announced politely and shown three ways at once:
 *    a changed label, a changed icon, and a ring. Colour alone would fail.
 */
export function VoiceButton({ className }: { readonly className?: string }) {
  const t = useTranslations('voice');
  const { state, canListen, unavailableReason, start, stop, cancel } = useVoice();

  const listening = state === 'listening';
  const busy = state === 'transcribing';
  const disabled = !canListen;

  const reasonKey =
    unavailableReason === 'disabled' ? 'disabledInSettings'
    : unavailableReason === 'insecure' ? 'insecure'
    : unavailableReason === 'unsupported' ? 'unsupported'
    : null;

  const label = listening ? t('stopListening') : busy ? t('transcribing') : t('button');
  const Icon = disabled ? MicOff : listening ? Square : Mic;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          if (listening) stop();
          else if (busy) cancel();
          else start();
        }}
        disabled={disabled}
        aria-describedby={reasonKey ? 'voice-unavailable-reason' : undefined}
        aria-pressed={listening}
        className={cn(
          'inline-flex min-h-14 items-center justify-center gap-3 rounded-pill px-5',
          'type-label-lg shadow-elev-3 transition-colors duration-fast ease-standard',
          'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
          listening
            ? 'bg-ramp-error-600 text-text-on-brand ring-4 ring-ramp-error-200'
            : 'bg-ramp-green-600 text-text-on-brand hover:bg-ramp-green-700 active:bg-ramp-green-800',
          disabled && 'bg-surface-disabled text-text-disabled shadow-none',
          className,
        )}
      >
        <Icon size={24} className="icon shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </button>

      {reasonKey ? (
        <span id="voice-unavailable-reason" className="sr-only">
          {t(reasonKey)}
        </span>
      ) : null}

      {/* State changes are announced without stealing focus. */}
      <span aria-live="polite" className="sr-only">
        {listening ? t('listening') : busy ? t('transcribing') : ''}
      </span>
    </>
  );
}
