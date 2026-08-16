'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mic, AlertCircle, HelpCircle, Volume2 } from 'lucide-react';
import { Sheet } from '@/components/primitives/Sheet';
import { Button } from '@/components/primitives/Button';
import { Textarea } from '@/components/primitives/Textarea';
import { Banner } from '@/components/primitives/Banner';
import { useVoice } from '@/components/providers/VoiceProvider';
import { VOICE_COMMANDS } from '@/modules/voice/commands';

/**
 * Everything the voice layer needs to SHOW: what it heard, what it is about to
 * do, what went wrong, and what can be said.
 *
 * The confirmation step is the reason this component exists. A citizen who
 * cannot read the screen has no way to notice that a mishearing just unsaved a
 * programme, so anything consequential is stated back — in words, in their
 * language, with the action spelled out — and waits for an explicit yes. Both a
 * spoken "হ্যাঁ" and a large button are accepted, because the person may be
 * unable to do either one at that moment.
 */
export function VoiceSheet() {
  const t = useTranslations('voice');
  const tc = useTranslations('common');
  const {
    state, transcript, interim, lastError, pending, suggestions,
    confirm, reject, cancel, submitText, start, canSpeak, speak,
    helpVisible, hideHelp, activeInput,
  } = useVoice();

  const [correction, setCorrection] = useState('');

  // Seed the correction box with what was heard, so fixing one wrong word does
  // not mean retyping the whole sentence.
  useEffect(() => {
    if (state === 'unclear') setCorrection(transcript);
  }, [state, transcript]);

  /**
   * Read the confirmation aloud when it opens.
   *
   * Without this the confirmation is useless to the very people voice exists for:
   * they would be asked to approve something they cannot read.
   */
  useEffect(() => {
    if (state === 'confirming' && pending && canSpeak) {
      speak(`${t('confirmTitle')} ${t(pending.command.labelKey)}`);
    }
    // `speak` and `t` are stable for the life of the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending]);

  const listening = state === 'listening';
  const transcribing = state === 'transcribing';

  const errorMessage =
    lastError?.kind === 'permission-denied' ? t('permissionDenied')
    : lastError?.kind === 'no-microphone' ? t('noMicrophone')
    : lastError?.kind === 'no-speech' ? t('heardNothing')
    : lastError?.kind === 'network' ? t('networkError')
    : lastError?.kind === 'server-unavailable' ? t('serverSttUnavailable')
    : lastError?.kind === 'not-supported' ? t('unsupported')
    : t('genericError');

  return (
    <>
      {/* -------------------------------------------------- listening */}
      <Sheet
        open={listening || transcribing}
        onClose={cancel}
        title={listening ? t('listening') : t('transcribing')}
        description={listening ? t('listeningHint') : undefined}
        closeLabel={t('cancel')}
      >
        <div className="flex flex-col items-center gap-5 py-4">
          <span
            aria-hidden="true"
            className={
              listening
                ? 'flex h-24 w-24 items-center justify-center rounded-pill bg-surface-error text-text-error ring-8 ring-ramp-error-100 motion-safe:animate-pulse'
                : 'flex h-24 w-24 items-center justify-center rounded-pill bg-surface-brand-subtle text-text-brand'
            }
          >
            <Mic size={40} className="icon" />
          </span>

          {/* Interim text is the only feedback that speech is being picked up at
              all, which matters on a device where nothing else moves. */}
          <p className="type-body-lg min-h-8 text-center text-text-primary" aria-live="polite">
            {interim || (listening ? '' : transcript)}
          </p>

          {activeInput === 'server' ? (
            <p className="type-caption max-w-sm text-center text-text-secondary">
              {t('serverAudioNotice')}
            </p>
          ) : null}

          {listening ? (
            <Button variant="secondary" onClick={cancel} fullWidth={false}>
              {t('cancel')}
            </Button>
          ) : null}
        </div>
      </Sheet>

      {/* ----------------------------------------------- confirmation */}
      <Sheet
        open={state === 'confirming' && pending !== null}
        onClose={reject}
        title={t('confirmTitle')}
        // Not dismissible: a consequential action must be answered, not
        // accidentally swiped away into an unknown state.
        dismissible={false}
        closeLabel={t('confirmNo')}
        footer={
          <div className="flex flex-col gap-3">
            {/* The affirmative is 64 dp — a commit action under BDS §10.1.2. */}
            <Button size="xl" onClick={confirm}>
              {t('confirmYes')}
            </Button>
            <Button variant="secondary" onClick={reject}>
              {t('confirmNo')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {pending ? (
            <p className="type-heading-sm text-text-primary">{t(pending.command.labelKey)}</p>
          ) : null}

          {transcript ? (
            <p className="type-body-md text-text-secondary">
              {t('heard')}: <span className="text-text-primary">“{transcript}”</span>
            </p>
          ) : null}

          <p className="type-body-md text-text-secondary">{t('confirmSpokenHint')}</p>

          <Button
            variant="tertiary"
            fullWidth={false}
            leadingIcon={<Mic size={20} className="icon" />}
            onClick={start}
          >
            {t('buttonShort')}
          </Button>
        </div>
      </Sheet>

      {/* -------------------------------------------------- not understood */}
      <Sheet
        open={state === 'unclear'}
        onClose={cancel}
        title={t('unclearTitle')}
        closeLabel={tc('close')}
        footer={
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                submitText(correction);
              }}
              disabled={correction.trim().length === 0}
            >
              {t('submitCorrection')}
            </Button>
            <Button variant="secondary" onClick={start} leadingIcon={<Mic size={20} className="icon" />}>
              {t('tryAgain')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {transcript ? (
            <Banner tone="info" statusWord={t('heard')}>
              “{transcript}”
            </Banner>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="type-label-lg text-text-primary">{t('unclearBody')}</p>
              <ul className="flex flex-col gap-2">
                {suggestions.map((command) => (
                  <li key={command.id}>
                    <button
                      type="button"
                      onClick={() => submitText(command.phrases[0] ?? '')}
                      className="flex min-h-14 w-full items-center rounded-md border border-stroke-subtle bg-surface px-4 py-3 text-start type-body-lg text-text-primary hover:bg-surface-sunken focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                    >
                      {t(command.labelKey)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Typing is always available. Voice is additive, never a replacement. */}
          <Textarea
            label={t('correctIt')}
            value={correction}
            onChange={(event) => setCorrection(event.target.value)}
            rows={2}
          />
        </div>
      </Sheet>

      {/* ------------------------------------------------------- error */}
      <Sheet
        open={state === 'error'}
        onClose={cancel}
        title={t('unclearTitle')}
        closeLabel={tc('close')}
        footer={
          lastError?.retryable !== false ? (
            <Button onClick={start} leadingIcon={<Mic size={20} className="icon" />}>
              {t('tryAgain')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={cancel}>
              {tc('close')}
            </Button>
          )
        }
      >
        <Banner tone="warning" statusWord={tc('appName')}>
          <span className="flex items-start gap-2">
            <AlertCircle size={20} className="icon mt-0.5 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </span>
        </Banner>
      </Sheet>

      {/* --------------------------------------- listening unavailable */}
      <UnavailableSheet />

      {/* -------------------------------------------------------- help */}
      <VoiceHelpSheet open={helpVisible} onClose={hideHelp} />
    </>
  );
}

/**
 * Why the microphone cannot be used here — and the way round it.
 *
 * The important half is the typed-command box. Voice NAVIGATION is deterministic
 * phrase matching, so it needs no microphone, no API key and no network: typing
 * "সংরক্ষিত" routes exactly as saying it would. That keeps the whole command
 * layer usable on a browser with no speech recognition, and makes it testable
 * without one.
 *
 * The capability readout at the bottom exists so the next person to ask "why
 * doesn't the button work?" can answer it from the screen instead of the source.
 */
function UnavailableSheet() {
  const t = useTranslations('voice');
  const tc = useTranslations('common');
  const { state, cancel, submitText, unavailableReason, support, serverStt, showHelp } = useVoice();
  const [typed, setTyped] = useState('');

  const reasonKey =
    unavailableReason === 'disabled' ? 'disabledInSettings'
    : unavailableReason === 'insecure' ? 'insecure'
    : unavailableReason === 'permission-denied' ? 'permissionDenied'
    : unavailableReason === 'no-microphone' ? 'noMicrophone'
    : unavailableReason === 'server-unavailable' ? 'serverSttUnavailable'
    : unavailableReason === 'browser-unavailable' ? 'browserRecognitionUnavailable'
    : unavailableReason === 'media-recorder-unavailable' ? 'mediaRecorderUnavailable'
    : 'unsupported';

  const capability = (label: string, ok: boolean) => (
    <li className="flex items-center justify-between gap-3">
      <span className="type-body-md text-text-secondary">{label}</span>
      <span className={ok ? 'type-label-md text-text-success' : 'type-label-md text-text-secondary'}>
        {ok ? tc('yes') : tc('no')}
      </span>
    </li>
  );

  const permissionLabel = support.microphonePermission === 'granted'
    ? t('permissionGranted')
    : support.microphonePermission === 'denied'
      ? t('permissionDeniedShort')
      : support.microphonePermission === 'prompt'
        ? t('permissionPrompt')
        : t('permissionUnknown');

  return (
    <Sheet
      open={state === 'unavailable'}
      onClose={cancel}
      title={t('typeInstead')}
      closeLabel={tc('close')}
      footer={
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => {
              submitText(typed);
              setTyped('');
            }}
            disabled={typed.trim().length === 0}
          >
            {t('runCommand')}
          </Button>
          <Button variant="tertiary" onClick={showHelp}>
            {t('helpTitle')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Banner tone="info" statusWord={tc('appName')}>
          {t(reasonKey)}
        </Banner>

        <p className="type-body-md text-text-secondary">{t('typeInsteadBody')}</p>

        <Textarea
          label={t('typeCommandLabel')}
          helper={t('typeCommandHelper')}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          rows={2}
        />

        <details className="rounded-md border border-stroke-subtle bg-surface-sunken p-3">
          <summary className="type-label-md cursor-pointer text-text-secondary">
            {t('capabilities')}
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {capability(t('capRecognition'), support.recognition)}
            {capability(t('capMicrophoneApi'), support.microphone)}
            <li className="flex items-center justify-between gap-3">
              <span className="type-body-md text-text-secondary">{t('capMicrophonePermission')}</span>
              <span className="type-label-md text-text-secondary">{permissionLabel}</span>
            </li>
            {capability(t('capMediaRecorder'), support.mediaRecorder)}
            {capability(t('capServerStt'), serverStt === true)}
            {capability(t('capTypedFallback'), true)}
            {capability(t('capSynthesis'), support.synthesis)}
            {capability(t('capBanglaVoice'), support.banglaVoice)}
            {capability(t('capSecure'), support.secureContext)}
          </ul>
        </details>
      </div>
    </Sheet>
  );
}

/**
 * The discoverability answer.
 *
 * A voice interface whose vocabulary is invisible is a guessing game, and this
 * audience will not guess twice. Because the command registry is a fixed list,
 * the help screen can be GENERATED from it — so it can never drift out of date,
 * which is the usual fate of a hand-written "things you can say" page.
 */
function VoiceHelpSheet({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const t = useTranslations('voice');
  const tc = useTranslations('common');
  const { canSpeak, speak } = useVoice();

  const groups = [
    { key: 'helpGroupNavigate', kinds: ['navigate'] as const },
    { key: 'helpGroupAction', kinds: ['action'] as const },
    { key: 'helpGroupMeta', kinds: ['meta'] as const },
  ];

  return (
    <Sheet open={open} onClose={onClose} title={t('helpTitle')} closeLabel={tc('close')}>
      <div className="flex flex-col gap-5">
        <p className="type-body-md text-text-secondary">{t('helpIntro')}</p>

        {canSpeak ? (
          <Button
            variant="tertiary"
            fullWidth={false}
            leadingIcon={<Volume2 size={20} className="icon" />}
            onClick={() => speak(t('helpIntro'))}
          >
            {t('readAloud')}
          </Button>
        ) : null}

        {groups.map((group) => {
          const commands = VOICE_COMMANDS.filter(
            (command) => !command.confirmationOnly && group.kinds.includes(command.kind as never),
          );
          if (commands.length === 0) return null;

          return (
            <section key={group.key} className="flex flex-col gap-2">
              <h3 className="type-label-lg text-text-primary">{t(group.key)}</h3>
              <ul className="flex flex-col gap-2">
                {commands.map((command) => (
                  <li
                    key={command.id}
                    className="flex flex-col gap-1 rounded-md border border-stroke-subtle bg-surface px-4 py-3"
                  >
                    <span className="type-body-lg text-text-primary">
                      {/* The first Bangla phrase is the one to teach: it is what a
                          Bangla-speaking citizen would actually say. */}
                      “{command.phrases.find((p) => /[ঀ-৿]/.test(p)) ?? command.phrases[0]}”
                    </span>
                    <span className="type-body-md text-text-secondary">{t(command.labelKey)}</span>
                    {command.confirm === 'always' ? (
                      <span className="type-caption flex items-center gap-1 text-text-secondary">
                        <HelpCircle size={16} className="icon shrink-0" aria-hidden="true" />
                        {t('helpConfirmNote')}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}
