import type { NextRequest } from 'next/server';
import { ok, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { getSession } from '@/lib/http/session';
import { guardRateLimit } from '@/lib/http/rate-limit';
import { hasLiveOtpChallenge } from '@/modules/auth/auth.service';
import { getSttProvider, SttError, describeVoiceCapabilities } from '@/modules/voice/providers';
import { sttPromptFor, type SttPurpose } from '@/modules/voice/stt-prompt';
import { env } from '@/lib/config/env';

/**
 * POST /api/v1/voice/transcribe — audio in, text out.
 * GET  /api/v1/voice/transcribe — what this server can and cannot do.
 *
 * Used only by browsers without a usable Web Speech API, which is most Android
 * WebViews. The client records with MediaRecorder and uploads one short clip
 * rather than streaming: on a 2G link a completed 30 KB Opus upload succeeds far
 * more reliably than a held-open realtime socket, which is the opposite of the
 * usual advice and the right call for this audience.
 *
 * THE AUDIO IS NEVER STORED. It is transcribed and discarded inside this handler.
 * Speech about widowhood, income and illness is sensitive text plus a biometric
 * identifier plus, often, other people audible in the room — and the PRD takes no
 * position on data residency, so the safest default is to keep nothing.
 */

/** 30 seconds of Opus is comfortably under this; a longer clip is a stuck mic. */
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

const ALLOWED_TYPES = [
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac',
];

export async function GET() {
  return handle(async () => ok({ voice: describeVoiceCapabilities() }), 'voice/transcribe:get');
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(ERROR_CODES.VALIDATION_FAILED, 'The recording could not be read. Please try again.', {
        status: 400,
      });
    }

    /* ------------------------------------------------------- who may speak */

    /**
     * Normally: a signed-in citizen.
     *
     * The exception is the sign-in screen itself, and it exists because of a
     * circularity that would otherwise lock people out. Speaking the six-digit
     * code is the accessible-authentication route BDS §10.2.5 requires — but
     * server transcription is the only speech path that works in Firefox and in
     * `VOICE_MODE=server`, and requiring a session for it means the one screen
     * where a citizen has no session is the one screen where the microphone is
     * dead. Someone who cannot read six boxes then cannot get in at all.
     *
     * So an unauthenticated clip is accepted ONLY while a live, unconsumed code
     * challenge exists for the number given. That is a deliberately expensive
     * door to walk through: it costs a real Bangladeshi mobile number, a
     * successful SMS send, and the per-number resend cooldown, all of which are
     * already limited — versus an open endpoint, which costs nothing and bills us
     * per minute of audio. The clip is still capped, still IP-limited, still
     * discarded, and grants nothing on its own: `verifyOtp` remains the only
     * thing that can turn a code into a session, and this path neither consumes
     * an attempt nor reveals whether the code was right.
     */
    const session = await getSession();

    let identity: string | undefined;
    if (session) {
      identity = session.userId;
    } else {
      const phoneField = form.get('phone');
      const phone = typeof phoneField === 'string' ? phoneField : '';
      if (!phone || !(await hasLiveOtpChallenge(phone))) {
        return fail(ERROR_CODES.UNAUTHENTICATED, 'Please sign in to use voice typing.', { status: 401 });
      }
      // Keyed by IP, not by phone: keying on the phone would let one caller
      // rotate numbers for a fresh budget each time.
      identity = undefined;
    }

    // Audio is the most expensive input in the system, so it has its own budget.
    const limited = await guardRateLimit(request, 'voice', identity);
    if (!limited.ok) return limited.response;

    const provider = getSttProvider();
    if (!provider) {
      // Say precisely what is missing. The client uses this to disable the
      // microphone with a reason rather than letting it fail on every press.
      return fail(
        ERROR_CODES.AI_UNAVAILABLE,
        'Voice typing is not available on this server. Your browser can still use its own speech recognition, or you can type instead.',
        { status: 503, details: { reason: 'no_stt_provider' } },
      );
    }

    const audio = form.get('audio');
    if (!(audio instanceof Blob)) {
      return fail(ERROR_CODES.VALIDATION_FAILED, 'No recording was received.', { status: 400 });
    }
    if (audio.size === 0) {
      return fail(ERROR_CODES.VALIDATION_FAILED, 'The recording was empty. Hold the button while you speak.', {
        status: 400,
      });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return fail(ERROR_CODES.VALIDATION_FAILED, 'That recording is too long. Try saying it more briefly.', {
        status: 413,
      });
    }
    // Type is advisory — the provider sniffs the container anyway — but an
    // obviously wrong type means the client is misconfigured, and a video upload
    // to a transcription endpoint is worth refusing before it costs money.
    const type = audio.type.split(';')[0]?.trim().toLowerCase() ?? '';
    if (type && !ALLOWED_TYPES.includes(type)) {
      return fail(ERROR_CODES.VALIDATION_FAILED, `Unsupported audio format: ${type}`, { status: 415 });
    }

    const localeRaw = form.get('locale');
    const language = localeRaw === 'en' ? 'en' : 'bn';

    try {
      /**
       * A one-word command and a dictated sentence want opposite vocabulary
       * hints, so the client says which it is. Defaults to `command`: it is the
       * shorter, more bleed-prone case, and getting it wrong the other way costs
       * only a slightly weaker hint on a long utterance.
       */
      const purpose: SttPurpose = form.get('purpose') === 'dictation' ? 'dictation' : 'command';

      const result = await provider.transcribe({
        audio,
        filename: `speech.${type === 'audio/ogg' ? 'ogg' : type === 'audio/mp4' ? 'mp4' : 'webm'}`,
        language,
        ...(sttPromptFor(purpose) ? { prompt: sttPromptFor(purpose)! } : {}),
      });

      /**
       * The transcript, in development only.
       *
       * "Accuracy is low" cannot be acted on without knowing what was heard, and
       * that is invisible everywhere: the audio is discarded by design, the
       * response goes to the browser, and the citizen only sees a transcript when
       * the matcher already failed. Without this, diagnosis is guesswork.
       *
       * Deliberately NOT in production, and deliberately not the audio. Speech
       * about widowhood, income and illness is sensitive text, and the clip is a
       * biometric identifier — the standing rule that audio is never stored is not
       * relaxed here. The clip's size and duration are printed alongside because a
       * very short or very quiet clip is itself the usual explanation, and one
       * line showing all three answers most accuracy questions immediately.
       */
      if (env.NODE_ENV !== 'production') {
        /**
         * Bytes per second depends on the container, so the estimate has to as
         * well. Assuming Opus for everything reported a one-second WAV as eight
         * seconds — and a diagnostic that lies about clip length is worse than no
         * diagnostic, because clip length is the first thing to suspect.
         *
         * Opus at the 48 kbps this app requests is ~6 KB/s; WAV at 16 kHz mono
         * 16-bit is ~32 KB/s.
         */
        const perSecond = type.includes('wav') ? 32_000 : 6_000;
        const seconds = (audio.size / perSecond).toFixed(1);
        // eslint-disable-next-line no-console
        console.log(
          `[voice] ${purpose} ${language} · ${audio.size}B (~${seconds}s ${type}) · ${result.durationMs}ms · "${result.text}"`,
        );
      }

      return ok(
        {
          text: result.text,
          /** Empty is a normal outcome — silence, noise, or a muted microphone. */
          heardNothing: result.text.length === 0,
          engine: result.engine,
          model: result.model,
          ...(result.detectedLanguage ? { detectedLanguage: result.detectedLanguage } : {}),
        },
        { meta: { durationMs: result.durationMs, bytes: audio.size } },
      );
    } catch (error) {
      if (error instanceof SttError) {
        return fail(
          ERROR_CODES.AI_UNAVAILABLE,
          'That recording could not be transcribed. Please try again, or type instead.',
          { status: 502, details: { retryable: error.retryable } },
        );
      }
      throw error;
    }
  }, 'voice/transcribe:post');
}

export const dynamic = 'force-dynamic';
