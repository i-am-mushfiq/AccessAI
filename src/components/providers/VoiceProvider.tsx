'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { usePreferences } from './PreferencesProvider';
import {
  detectVoiceSupport, startRecognition, startRecording, speakLocally, stopSpeaking,
  textForSpeech, whenVoicesReady, hasBanglaVoice,
  type RecognitionError, type RecognitionHandle, type VoiceSupport,
} from '@/lib/voice/speech';
import { resolveIntent, resolveConfirmation, type IntentResult, type IntentMatch } from '@/modules/voice/intent';
import type { VoiceCommand } from '@/modules/voice/commands';
import { api } from '@/lib/api/client';

/**
 * The voice state machine for the whole app.
 *
 * Listening, transcription, intent resolution, confirmation and dispatch live in
 * ONE place rather than per screen, because the citizen does not think in
 * screens: "সংরক্ষিত" must work from anywhere, and the microphone must not
 * behave differently on the chat page than on the timeline.
 *
 * Three rules are enforced here rather than left to call sites:
 *
 *  1. A state-changing command is NEVER executed on the strength of a transcript
 *     alone. It moves to `confirming`, the app says what it is about to do, and
 *     it waits for an explicit yes. Screens register handlers; they do not get to
 *     opt out of the confirmation.
 *
 *  2. Voice is ALWAYS additive. Nothing here removes or replaces a tappable
 *     control, because a citizen in a shared room, a market, or a government
 *     office queue cannot speak.
 *
 *  3. Every failure is a state with words, not a silent no-op: permission denied,
 *     no speech heard, unsupported browser, and no provider configured each have
 *     their own message and their own next step.
 */

export type VoiceState =
  | 'idle'
  /** Microphone open. */
  | 'listening'
  /** Clip recorded, waiting on server transcription. */
  | 'transcribing'
  /** Understood, waiting for the citizen to confirm a consequential action. */
  | 'confirming'
  /** Heard something that is not a command. */
  | 'unclear'
  /**
   * Listening is impossible on this device, and the citizen has asked why.
   * Carries the typed-command fallback, so voice NAVIGATION still works — intent
   * resolution is deterministic and needs no microphone.
   */
  | 'unavailable'
  | 'error';

export type VoiceActionHandler = (match: IntentMatch) => void | Promise<void>;

export interface DictateOptions {
  /**
   * The number being signed in with, when dictating on the sign-in screen.
   *
   * Server transcription otherwise requires a session, which the sign-in screen
   * by definition does not have — so the endpoint accepts a clip while a live
   * code challenge exists for this number instead. Sent only from that screen;
   * everywhere else the session cookie is the credential.
   */
  readonly phone?: string;
}

export interface VoiceContextValue {
  readonly state: VoiceState;
  readonly support: VoiceSupport;
  /** Server transcription availability, fetched once. Null until known. */
  readonly serverStt: boolean | null;
  /** Server synthesis availability — read-aloud without a device voice. */
  readonly serverTts: boolean;
  /** Which path this deployment prefers. */
  readonly mode: 'auto' | 'server' | 'browser';
  /** Whether the microphone can be used at all, by any route. */
  readonly canListen: boolean;
  /** Why not, when it cannot. A catalogue key. */
  readonly unavailableReason: 'disabled' | 'insecure' | 'unsupported' | null;
  readonly interim: string;
  readonly transcript: string;
  readonly lastError: RecognitionError | null;
  /** The pending action awaiting a yes/no. */
  readonly pending: IntentMatch | null;
  readonly suggestions: readonly VoiceCommand[];
  readonly speaking: boolean;
  readonly canSpeak: boolean;

  start(): void;
  /**
   * Listen for TEXT rather than a command — used by the chat composer.
   *
   * Dictation deliberately does not auto-send. A chat message updates the
   * citizen's profile, and a misheard income produces a confidently wrong
   * eligibility answer, so the transcript lands in the composer for review and
   * the citizen presses send. Same microphone stack, same server fallback; only
   * the destination differs.
   */
  dictate(onText: (text: string) => void, options?: DictateOptions): void;
  stop(): void;
  cancel(): void;
  confirm(): void;
  reject(): void;
  /** Submit a corrected or typed transcript, bypassing the microphone. */
  submitText(text: string): void;
  /** Show why listening is unavailable, with the typed-command alternative. */
  explainUnavailable(): void;
  speak(text: string): void;
  silence(): void;
  /** Screens declare which on-screen actions exist right now. */
  registerActions(actions: Record<string, VoiceActionHandler>): () => void;
  /** What "read this" should read on the current screen. */
  registerReadable(getText: () => string): () => void;
  readonly helpVisible: boolean;
  showHelp(): void;
  hideHelp(): void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({
  children,
  authenticated,
  isStaff = false,
}: {
  readonly children: ReactNode;
  readonly authenticated: boolean;
  readonly isStaff?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, voiceEnabled } = usePreferences();

  const [support, setSupport] = useState<VoiceSupport>({
    recognition: false, recording: false, synthesis: false, banglaVoice: false, secureContext: false,
  });
  const [serverStt, setServerStt] = useState<boolean | null>(null);
  const [serverTts, setServerTts] = useState(false);
  const [mode, setMode] = useState<'auto' | 'server' | 'browser'>('auto');
  const [state, setState] = useState<VoiceState>('idle');
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState('');
  const [lastError, setLastError] = useState<RecognitionError | null>(null);
  const [pending, setPending] = useState<IntentMatch | null>(null);
  const [suggestions, setSuggestions] = useState<readonly VoiceCommand[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);

  const recognitionRef = useRef<RecognitionHandle | null>(null);
  const recordingRef = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const actionsRef = useRef<Record<string, VoiceActionHandler>>({});
  const readableRef = useRef<(() => string) | null>(null);
  /** True while a confirmation is open, so the next utterance is read as yes/no. */
  const awaitingConfirmRef = useRef(false);
  /** Set while dictating, so a final transcript becomes text instead of a command. */
  const dictationRef = useRef<((text: string) => void) | null>(null);
  /** Credentials the upload needs when there is no session yet. Cleared after use. */
  const dictateOptionsRef = useRef<DictateOptions>({});
  /** The currently playing server-synthesised clip, so it can be stopped. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /**
   * Counter identifying the current listening attempt.
   *
   * Needed because `getUserMedia` resolves whenever the citizen answers the
   * permission prompt, which may be long after they gave up and pressed cancel.
   * Comparing generations tells a late-arriving recorder that nobody wants it.
   */
  const attemptRef = useRef(0);

  /* ------------------------------------------------------- capabilities */

  useEffect(() => {
    let cancelled = false;
    setSupport(detectVoiceSupport());

    // Voices arrive asynchronously; a Bangla voice present on the device is often
    // invisible on the first synchronous check.
    void whenVoicesReady().then(() => {
      if (!cancelled) setSupport((current) => ({ ...current, banglaVoice: hasBanglaVoice() }));
    });

    // Ask the server once whether it can transcribe, so the microphone can be
    // disabled with a reason instead of failing on every press.
    void api
      .get<{ voice: { serverStt: boolean; serverTts: boolean; mode: 'auto' | 'server' | 'browser' } }>(
        '/voice/transcribe',
      )
      .then((data) => {
        if (cancelled) return;
        setServerStt(data.voice.serverStt);
        setServerTts(data.voice.serverTts);
        setMode(data.voice.mode);
      })
      .catch(() => {
        if (!cancelled) setServerStt(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Whether Web Speech may be used at all.
   *
   * In `server` mode it is refused even where it exists, so every browser takes
   * the same path: one transcription engine, one accuracy profile, one place to
   * improve — and no audio leaving for Google's servers as a side effect of an
   * API the app never asked to involve them in.
   */
  const useBrowserRecognition = support.recognition && mode !== 'server';
  const useServerStt = support.recording && serverStt === true && mode !== 'browser';

  const canListen = voiceEnabled && support.secureContext && (useBrowserRecognition || useServerStt);

  const unavailableReason: VoiceContextValue['unavailableReason'] = !voiceEnabled
    ? 'disabled'
    : !support.secureContext
      ? 'insecure'
      : canListen
        ? null
        : 'unsupported';

  /**
   * Read-aloud is possible if EITHER the server can synthesise or the device has
   * a voice that can pronounce this locale. Server availability is what makes
   * read-aloud work on a phone with no Bangla voice installed.
   */
  const canSpeak = serverTts || (support.synthesis && (locale === 'en' || support.banglaVoice));

  /* ------------------------------------------------------------ speaking */

  /**
   * Read text aloud, preferring the server when it can.
   *
   * Order matters and is not the obvious one. Server audio is tried FIRST
   * whenever it is configured, because the device's own synthesiser is the
   * unreliable option here: Android often has no `bn-BD` voice, and the failure
   * is silent. The browser is the fallback, not the default.
   *
   * `speechSynthesis` is still worth keeping as that fallback — it is free,
   * instant and works offline, which matters on a 2G connection.
   */
  const speak = useCallback(
    (text: string) => {
      const clean = textForSpeech(text);
      if (!clean) return;

      const playLocally = () => {
        const started = speakLocally(clean, {
          locale,
          onEnd: () => setSpeaking(false),
          onError: () => setSpeaking(false),
        });
        setSpeaking(started);
        // If this returns false the device cannot pronounce Bangla. Nothing is
        // spoken, and the SpeakButton is already showing why.
      };

      if (!serverTts) {
        playLocally();
        return;
      }

      setSpeaking(true);
      audioRef.current?.pause();

      void fetch('/api/v1/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ text: clean, locale }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`speak ${response.status}`);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          // Revoke on both paths, or a long session leaks a blob per utterance.
          const release = () => URL.revokeObjectURL(url);
          audio.onended = () => {
            release();
            setSpeaking(false);
          };
          audio.onerror = () => {
            release();
            setSpeaking(false);
          };
          await audio.play();
        })
        .catch(() => {
          // The server could not synthesise. Fall back rather than going silent.
          setSpeaking(false);
          playLocally();
        });
    },
    [locale, serverTts],
  );

  const silence = useCallback(() => {
    stopSpeaking();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setSpeaking(false);
  }, []);

  /* ----------------------------------------------------------- dispatch */

  const runCommand = useCallback(
    async (match: IntentMatch) => {
      const { command } = match;

      if (command.kind === 'meta') {
        switch (command.id) {
          case 'meta.readAloud': {
            const text = readableRef.current?.();
            if (text) speak(text);
            break;
          }
          case 'meta.stopReading':
            silence();
            break;
          case 'meta.repeat': {
            const text = readableRef.current?.();
            if (text) speak(text);
            break;
          }
          case 'meta.help':
            setHelpVisible(true);
            break;
          case 'meta.back':
            router.back();
            break;
        }
        setState('idle');
        return;
      }

      if (command.kind === 'navigate' && match.href) {
        // The href already carries the locale prefix from the resolver, and
        // `router` here is the locale-aware one, so it is stripped to avoid
        // `/bn/bn/...`.
        const withoutLocale = match.href.replace(new RegExp(`^/${locale}`), '') || '/';
        router.push(withoutLocale);
        setState('idle');
        return;
      }

      if (command.kind === 'action') {
        const handler = actionsRef.current[command.id];
        if (!handler) {
          // The screen changed between hearing and acting. Say so rather than
          // doing nothing.
          setState('unclear');
          return;
        }
        await handler(match);
        setState('idle');
        return;
      }

      setState('idle');
    },
    [locale, router, silence, speak],
  );

  const handleIntent = useCallback(
    (result: IntentResult) => {
      setTranscript(result.transcript);

      if (result.kind === 'unmatched') {
        setSuggestions(result.suggestions.map((s) => s.command));
        setState('unclear');
        return;
      }

      setSuggestions([]);

      if (result.needsConfirmation) {
        setPending(result);
        awaitingConfirmRef.current = true;
        setState('confirming');
        return;
      }

      void runCommand(result);
    },
    [runCommand],
  );

  const process = useCallback(
    (text: string) => {
      // Dictation: the words are the payload, not an instruction.
      const dictateTo = dictationRef.current;
      if (dictateTo) {
        dictationRef.current = null;
        // The upload has already happened, so the credential is spent; holding it
        // would attach a phone number to unrelated clips later in the session.
        dictateOptionsRef.current = {};
        dictateTo(text);
        setState('idle');
        return;
      }

      // Mid-confirmation the utterance is a REPLY, never a new command. Resolving
      // it as a command here is how "না" could be read as something else and the
      // refused action performed anyway.
      if (awaitingConfirmRef.current) {
        const answer = resolveConfirmation(text);
        if (answer === 'yes' && pending) {
          awaitingConfirmRef.current = false;
          const toRun = pending;
          setPending(null);
          void runCommand(toRun);
          return;
        }
        if (answer === 'no') {
          awaitingConfirmRef.current = false;
          setPending(null);
          setState('idle');
          return;
        }
        // Unclear: stay in the confirmation. Silence is never consent.
        setState('confirming');
        return;
      }

      handleIntent(
        resolveIntent(text, {
          locale,
          authenticated,
          isStaff,
          availableActions: Object.keys(actionsRef.current),
        }),
      );
    },
    [authenticated, handleIntent, isStaff, locale, pending, runCommand],
  );

  /* ---------------------------------------------------------- listening */

  const transcribeOnServer = useCallback(
    async (clip: Blob) => {
      setState('transcribing');
      try {
        const form = new FormData();
        form.append('audio', clip, 'speech.webm');
        form.append('locale', locale);
        // Only present on the sign-in screen; see DictateOptions.
        const { phone } = dictateOptionsRef.current;
        if (phone) form.append('phone', phone);

        // FormData must not go through the JSON client, which would stringify it.
        const response = await fetch('/api/v1/voice/transcribe', {
          method: 'POST',
          body: form,
          credentials: 'same-origin',
        });
        const payload = (await response.json()) as
          | { success: true; data: { text: string; heardNothing: boolean } }
          | { success: false; error: { message: string } };

        if (!payload.success) {
          setLastError({ kind: 'unknown', retryable: true });
          setState('error');
          return;
        }
        if (payload.data.heardNothing) {
          setLastError({ kind: 'no-speech', retryable: true });
          setState('error');
          return;
        }
        process(payload.data.text);
      } catch {
        setLastError({ kind: 'network', retryable: true });
        setState('error');
      }
    },
    [locale, process],
  );

  const start = useCallback(() => {
    if (!canListen || state === 'listening' || state === 'transcribing') return;

    setLastError(null);
    setInterim('');
    setTranscript('');
    setSuggestions([]);
    // Never listen while speaking — the microphone would hear the synthesiser.
    silence();
    setState('listening');

    if (useBrowserRecognition) {
      recognitionRef.current = startRecognition(locale, {
        onInterim: setInterim,
        onFinal: (text) => {
          setInterim('');
          process(text);
        },
        onError: (error) => {
          setLastError(error);
          setState('error');
        },
        onEnd: () => {
          recognitionRef.current = null;
        },
      });
      return;
    }

    /**
     * Server path: record a clip and upload it when the citizen says they have
     * finished.
     *
     * `getUserMedia` does not resolve until the permission prompt is answered,
     * which can take as long as the citizen takes. The generation token covers
     * that window: if they press done or cancel while the prompt is still open,
     * the handle that arrives afterwards belongs to a session nobody is waiting
     * for, and storing it would leave the microphone open with nothing able to
     * close it.
     */
    const generation = (attemptRef.current += 1);

    void startRecording()
      .then((handle) => {
        if (attemptRef.current !== generation) {
          handle.cancel();
          return;
        }
        recordingRef.current = handle;
      })
      .catch(() => {
        if (attemptRef.current !== generation) return;
        setLastError({ kind: 'permission-denied', retryable: false });
        setState('error');
      });
  }, [canListen, locale, process, silence, state, useBrowserRecognition]);

  const dictate = useCallback(
    (onText: (text: string) => void, options: DictateOptions = {}) => {
      dictationRef.current = onText;
      dictateOptionsRef.current = options;
      start();
    },
    [start],
  );

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      return;
    }

    const recording = recordingRef.current;
    if (recording) {
      recordingRef.current = null;
      void recording.stop().then((clip) => {
        if (!clip) {
          setLastError({ kind: 'no-speech', retryable: true });
          setState('error');
          return;
        }
        void transcribeOnServer(clip);
      });
      return;
    }

    /**
     * Nothing to stop yet — the recorder is still waiting on the permission
     * prompt. This used to fall through and do NOTHING, leaving the sheet saying
     * "listening" with no recording, no upload, and no way out but cancel: the
     * citizen pressed done, was told the app was still listening, and waited.
     *
     * Invalidating the attempt makes the pending handle self-cancel when it
     * arrives, so the microphone is not left open either.
     */
    attemptRef.current += 1;
    setLastError({ kind: 'no-speech', retryable: true });
    setState('error');
  }, [transcribeOnServer]);

  const cancel = useCallback(() => {
    // Any recorder still opening belongs to an attempt nobody is waiting for.
    attemptRef.current += 1;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    recordingRef.current?.cancel();
    recordingRef.current = null;
    awaitingConfirmRef.current = false;
    dictationRef.current = null;
    dictateOptionsRef.current = {};
    setPending(null);
    setInterim('');
    setSuggestions([]);
    setState('idle');
  }, []);

  const confirm = useCallback(() => {
    if (!pending) return;
    awaitingConfirmRef.current = false;
    const toRun = pending;
    setPending(null);
    void runCommand(toRun);
  }, [pending, runCommand]);

  const reject = useCallback(() => {
    awaitingConfirmRef.current = false;
    setPending(null);
    setState('idle');
  }, []);

  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      process(trimmed);
    },
    [process],
  );

  const explainUnavailable = useCallback(() => {
    setLastError(null);
    setState('unavailable');
  }, []);

  /* --------------------------------------------------------- registries */

  const registerActions = useCallback((actions: Record<string, VoiceActionHandler>) => {
    actionsRef.current = { ...actionsRef.current, ...actions };
    const keys = Object.keys(actions);
    return () => {
      const next = { ...actionsRef.current };
      for (const key of keys) delete next[key];
      actionsRef.current = next;
    };
  }, []);

  const registerReadable = useCallback((getText: () => string) => {
    readableRef.current = getText;
    return () => {
      if (readableRef.current === getText) readableRef.current = null;
    };
  }, []);

  // A route change invalidates anything mid-flight: a pending "save this" refers
  // to a screen that is gone, and acting on it would touch the wrong record.
  useEffect(() => {
    cancel();
    silence();
  }, [pathname, cancel, silence]);

  const value = useMemo<VoiceContextValue>(
    () => ({
      state, support, serverStt, serverTts, mode, canListen, unavailableReason,
      interim, transcript, lastError, pending, suggestions, speaking, canSpeak,
      start, dictate, stop, cancel, confirm, reject, submitText, explainUnavailable, speak, silence,
      registerActions, registerReadable,
      helpVisible,
      showHelp: () => setHelpVisible(true),
      hideHelp: () => setHelpVisible(false),
    }),
    [
      state, support, serverStt, serverTts, mode, canListen, unavailableReason, interim, transcript,
      lastError, pending, suggestions, speaking, canSpeak, start, dictate, stop, cancel,
      confirm, reject, submitText, explainUnavailable, speak, silence, registerActions,
      registerReadable, helpVisible,
    ],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceContextValue {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('useVoice must be used inside a VoiceProvider');
  return context;
}

/**
 * Declares the voice actions a screen supports, for as long as it is mounted.
 *
 * `resolveIntent` is given these ids, so "সেভ করো" is only ever offered on a
 * screen that can actually save something — a command that resolves and then
 * finds no handler is a dead end the citizen cannot diagnose.
 */
export function useVoiceActions(actions: Record<string, VoiceActionHandler>): void {
  const { registerActions } = useVoice();
  // The identity of the handler object changes every render; the ids do not.
  const signature = Object.keys(actions).sort().join('|');
  const latest = useRef(actions);
  latest.current = actions;

  useEffect(() => {
    const stable: Record<string, VoiceActionHandler> = {};
    for (const id of signature.split('|').filter(Boolean)) {
      stable[id] = (match) => latest.current[id]?.(match);
    }
    return registerActions(stable);
  }, [signature, registerActions]);
}

/** Declares what "read this aloud" reads on the current screen. */
export function useVoiceReadable(getText: () => string): void {
  const { registerReadable } = useVoice();
  const latest = useRef(getText);
  latest.current = getText;

  useEffect(() => registerReadable(() => latest.current()), [registerReadable]);
}
