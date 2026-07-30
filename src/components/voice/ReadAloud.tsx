'use client';

import { useVoiceReadable } from '@/components/providers/VoiceProvider';
import { SpeakButton } from './SpeakButton';

/**
 * A screen's read-aloud: the tappable control AND the target of "পড়ে শোনাও".
 *
 * The two are deliberately one component. Registering the spoken summary without
 * rendering a button leaves the feature reachable only by someone who already
 * knows the phrase; rendering a button without registering leaves the phrase
 * silently doing nothing on that screen. Both failures were live in this app —
 * "পড়ে শোনাও" resolved everywhere but only the chat screen had anything to read.
 *
 * `useVoiceReadable` is a SINGLE slot, last registration wins. So this belongs
 * once per screen, summarising the screen. For an individual row that a citizen
 * might want repeated on its own — one chat message, one notification — use
 * `SpeakButton` directly, which speaks without claiming the slot.
 *
 * The text is passed in already composed, because what is worth hearing is a
 * per-screen judgement (see `modules/voice/spoken`) and not something a generic
 * component can infer from the DOM. Reading the DOM would also read the
 * navigation, the badges and the icon labels.
 */
export function ReadAloud({
  text,
  size = 'sm',
  className,
}: {
  readonly text: string;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}) {
  // A getter, not the string: the summary changes as the citizen filters,
  // switches tabs or marks something done, and "read it again" must read what is
  // on screen NOW rather than what was there when the screen mounted.
  useVoiceReadable(() => text);

  return <SpeakButton text={text} size={size} className={className} />;
}
