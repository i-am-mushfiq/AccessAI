'use client';

import { useTranslations } from 'next-intl';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { useVoice } from '@/components/providers/VoiceProvider';

/**
 * Read-aloud for one block of content.
 *
 * This is the half of voice access that matters most and is easiest to forget:
 * dictation lets a citizen ASK, but without this they are then handed a wall of
 * text they may not be able to read. Voice input alone is half a bridge.
 *
 * When the device has no Bangla voice the control is not hidden — it is shown
 * disabled with the reason, because the fix is on the device (install a Bangla
 * voice) and a silently absent button teaches nothing.
 */
export function SpeakButton({
  text,
  size = 'sm',
  className,
}: {
  readonly text: string;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}) {
  const t = useTranslations('voice');
  const { speak, silence, speaking, canSpeak, support, serverTts } = useVoice();

  // Nothing anywhere can turn text into sound — not the device, not the server —
  // so there is no honest control to render.
  //
  // The server is checked FIRST and separately from `canSpeak`. Gating on
  // `support.synthesis` alone hid this button on exactly the devices server
  // synthesis was built for: a cheap Android browser with no Bangla voice, where
  // the app could have spoken perfectly well through the server and instead
  // showed nothing at all.
  if (!serverTts && !support.synthesis) return null;

  if (!canSpeak) {
    return (
      <Button
        variant="tertiary"
        size={size}
        fullWidth={false}
        disabled
        disabledReason={t('noBanglaVoice')}
        leadingIcon={<VolumeX size={20} className="icon" />}
        className={className}
      >
        {t('readAloud')}
      </Button>
    );
  }

  return (
    <Button
      variant="tertiary"
      size={size}
      fullWidth={false}
      onClick={() => (speaking ? silence() : speak(text))}
      leadingIcon={
        speaking ? <VolumeX size={20} className="icon" /> : <Volume2 size={20} className="icon" />
      }
      className={className}
    >
      {speaking ? t('stopReading') : t('readAloud')}
    </Button>
  );
}
