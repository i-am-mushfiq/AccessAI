/**
 * Browser speech: recognition, recording, and synthesis.
 *
 * Everything here is a thin, honestly-typed wrapper over APIs that are missing,
 * half-implemented, or silently broken on exactly the devices this product
 * targets. The job of this file is to find out WHICH, and say so, rather than
 * calling something and hoping.
 *
 * The three capabilities degrade independently:
 *
 *   recognition  Web Speech API → server transcription → disabled with a reason
 *   recording    MediaRecorder (needed for the server path)
 *   synthesis    speechSynthesis with a real Bangla voice → server TTS → text only
 *
 * `SpeechRecognition` and `OTPCredential` are not in TypeScript's DOM lib, so
 * they are reached through narrow local shapes rather than by disabling checking.
 */

export type RecognitionErrorKind =
  | 'not-supported'
  | 'permission-denied'
  | 'no-speech'
  | 'no-microphone'
  | 'network'
  | 'aborted'
  | 'unknown';

export interface RecognitionError {
  readonly kind: RecognitionErrorKind;
  /** Whether pressing the button again could plausibly work. */
  readonly retryable: boolean;
}

/* ------------------------------------------------- capability detection */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
}

interface SpeechResultEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<
    ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }
  >;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface VoiceSupport {
  /** Web Speech API present — free, instant, no upload. */
  readonly recognition: boolean;
  /** MediaRecorder + getUserMedia, needed for the server transcription path. */
  readonly recording: boolean;
  readonly synthesis: boolean;
  /**
   * A voice that can actually pronounce Bangla. Android frequently ships without
   * one, and `speechSynthesis` then either stays silent or reads Bangla text with
   * an English voice — unintelligible, and worse than nothing because it sounds
   * like the feature is working.
   */
  readonly banglaVoice: boolean;
  /** True only where geolocation-style secure-context rules are satisfied. */
  readonly secureContext: boolean;
}

export function detectVoiceSupport(): VoiceSupport {
  if (typeof window === 'undefined') {
    return { recognition: false, recording: false, synthesis: false, banglaVoice: false, secureContext: false };
  }

  const secureContext = window.isSecureContext || window.location.hostname === 'localhost';

  return {
    // Microphone APIs require a secure context. Reporting them as available over
    // plain HTTP would produce a button that always fails.
    recognition: secureContext && recognitionConstructor() !== null,
    recording:
      secureContext &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof window.MediaRecorder === 'function',
    synthesis: typeof window.speechSynthesis !== 'undefined',
    banglaVoice: hasBanglaVoice(),
    secureContext,
  };
}

/** Voices load asynchronously in most browsers, so this can change after boot. */
export function hasBanglaVoice(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return window.speechSynthesis.getVoices().some((voice) => /^bn\b|^bn[-_]/i.test(voice.lang));
}

/**
 * Resolves once the voice list is populated.
 *
 * Chrome returns an empty array on the first call and fires `voiceschanged`
 * later, so a naive check at mount time reports "no Bangla voice" on a device
 * that has one.
 */
export function whenVoicesReady(timeoutMs = 2000): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(finish, timeoutMs);
    function finish() {
      clearTimeout(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', finish);
      resolve();
    }
    window.speechSynthesis.addEventListener('voiceschanged', finish);
  });
}

/* ------------------------------------------------------------ recognition */

export interface RecognitionHandle {
  stop(): void;
  abort(): void;
}

export interface RecognitionCallbacks {
  /** Fired repeatedly with the best-guess text so far. */
  readonly onInterim?: (text: string) => void;
  /** Fired once with the settled transcript. */
  readonly onFinal: (text: string, confidence: number) => void;
  readonly onError: (error: RecognitionError) => void;
  /** Always fired, success or failure, so the UI can leave the listening state. */
  readonly onEnd?: () => void;
}

const ERROR_MAP: Record<string, RecognitionError> = {
  'not-allowed': { kind: 'permission-denied', retryable: false },
  'service-not-allowed': { kind: 'permission-denied', retryable: false },
  'no-speech': { kind: 'no-speech', retryable: true },
  'audio-capture': { kind: 'no-microphone', retryable: false },
  network: { kind: 'network', retryable: true },
  aborted: { kind: 'aborted', retryable: true },
};

export function startRecognition(
  locale: 'bn' | 'en',
  callbacks: RecognitionCallbacks,
): RecognitionHandle | null {
  const Ctor = recognitionConstructor();
  if (!Ctor) {
    callbacks.onError({ kind: 'not-supported', retryable: false });
    return null;
  }

  const recognition = new Ctor();
  /**
   * The language tag matters more than anything else here. `bn-BD` versus a
   * default of `en-US` is the difference between a usable transcript and noise —
   * and `en-IN` is chosen over `en-US` for the English path because the accent
   * models are far closer for South Asian speakers.
   */
  recognition.lang = locale === 'bn' ? 'bn-BD' : 'en-IN';
  // A command is one utterance. Continuous mode would keep the microphone open,
  // draining battery and recording the room after the citizen has finished.
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let settled = false;

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    let confidence = 0;

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (!result) continue;
      const alternative = result[0];
      if (!alternative) continue;
      if (result.isFinal) {
        final += alternative.transcript;
        confidence = alternative.confidence;
      } else {
        interim += alternative.transcript;
      }
    }

    if (interim) callbacks.onInterim?.(interim);
    if (final) {
      settled = true;
      callbacks.onFinal(final.trim(), confidence);
    }
  };

  recognition.onerror = (event) => {
    const mapped = ERROR_MAP[event.error ?? ''] ?? { kind: 'unknown' as const, retryable: true };
    callbacks.onError(mapped);
  };

  recognition.onend = () => {
    // Some engines end without ever firing a final result — a short utterance in
    // a noisy room. Reporting "heard nothing" beats leaving a spinner running.
    if (!settled) callbacks.onError({ kind: 'no-speech', retryable: true });
    callbacks.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    // Calling start() twice throws; treat it as an abort rather than crashing.
    callbacks.onError({ kind: 'aborted', retryable: true });
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}

/* -------------------------------------------------------------- recording */

export interface RecordingHandle {
  /** Resolves with the recorded clip, or null if nothing was captured. */
  stop(): Promise<Blob | null>;
  cancel(): void;
}

/** Ordered by preference: Opus is the smallest, which matters most on 2G. */
const PREFERRED_TYPES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

function pickMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return undefined;
  for (const type of PREFERRED_TYPES) {
    if (window.MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

/**
 * Below this, a clip is a mis-tap rather than speech.
 *
 * An Opus container costs roughly a kilobyte in headers before any audio, so a
 * clip this small cannot contain a word. The guard exists because Whisper does
 * NOT return an empty transcript for silence — measured against Groq's
 * whisper-large-v3, one second of digital silence came back as " Guys" and as
 * " প্রাক্ষন প্রাক্ষন প্রাক্ষন". Uploading a mis-tap therefore costs an API call and
 * produces a hallucination, which the citizen is then told is "not a command
 * I understand" — the wrong diagnosis, with the wrong next step, for someone
 * whose real problem is that the microphone heard nothing.
 *
 * Returning null instead routes to the `no-speech` state, whose message is
 * "nothing was heard, press and hold, then speak". Conservative on purpose:
 * even at the lowest bitrate a browser will choose, a real one-word command is
 * several times this size, so no genuine utterance is discarded.
 */
const MIN_CLIP_BYTES = 1500;

/**
 * Records a short clip for server transcription.
 *
 * Deliberately batch, not streaming. On a flaky 2G link a completed ~30 KB
 * upload succeeds far more often than a held-open realtime socket, and a failed
 * upload can simply be retried — which is the opposite of the usual advice and
 * the right trade for this audience.
 */
export async function startRecording(options: { maxMs?: number } = {}): Promise<RecordingHandle> {
  const { maxMs = 30_000 } = options;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // Phone speakers and market noise are the normal case, not the exception.
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };

  // A stuck recorder would hold the microphone open indefinitely and upload a
  // megabyte of room noise, so it is bounded here as well as server-side.
  const cap = setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop();
  }, maxMs);

  recorder.start();

  /** One place to decide whether what was captured is worth uploading. */
  const finish = (): Blob | null => {
    if (chunks.length === 0) return null;
    const clip = new Blob(chunks, { type: mimeType ?? 'audio/webm' });
    return clip.size >= MIN_CLIP_BYTES ? clip : null;
  };

  return {
    stop: () =>
      new Promise<Blob | null>((resolve) => {
        clearTimeout(cap);
        if (recorder.state === 'inactive') {
          release();
          resolve(finish());
          return;
        }
        recorder.onstop = () => {
          release();
          resolve(finish());
        };
        recorder.stop();
      }),
    cancel: () => {
      clearTimeout(cap);
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } finally {
        release();
      }
    },
  };
}

/* -------------------------------------------------------------- synthesis */

export interface SpeakOptions {
  readonly locale: 'bn' | 'en';
  /** 0.5–2. Slower than default for Bangla, which is dense in syllables. */
  readonly rate?: number;
  readonly onEnd?: () => void;
  readonly onError?: () => void;
}

/**
 * Reads text aloud with the browser's own synthesiser.
 *
 * Returns false when it CANNOT do so intelligibly — no synthesiser, or Bangla
 * text with no Bangla voice installed. The caller then falls back to server TTS
 * or leaves the text on screen. Silently speaking Bangla with an English voice is
 * the failure this return value exists to prevent.
 */
export function speakLocally(text: string, options: SpeakOptions): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  const voices = window.speechSynthesis.getVoices();
  const wanted = options.locale === 'bn' ? /^bn\b|^bn[-_]/i : /^en\b|^en[-_]/i;
  const voice = voices.find((v) => wanted.test(v.lang));

  if (options.locale === 'bn' && !voice) return false;

  // Cancel first: queued utterances otherwise stack up and the citizen hears the
  // previous answer read over the new one.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(trimmed);
  if (voice) utterance.voice = voice;
  utterance.lang = options.locale === 'bn' ? 'bn-BD' : 'en-IN';
  utterance.rate = options.rate ?? (options.locale === 'bn' ? 0.92 : 1);
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onError?.();

  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking;
}

/**
 * Strips markup and citation furniture before speech.
 *
 * Read verbatim, the assistant's markdown becomes "star star widow allowance
 * star star", and a bare URL becomes a minute of spelled-out punctuation. Both
 * make a read-aloud answer unusable, so this runs on every string before it is
 * spoken.
 */
export function textForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_#>|]/g, ' ')
    .replace(/^\s*[-•]\s*/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
