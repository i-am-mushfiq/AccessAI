import type { NextRequest } from 'next/server';
import { ok, handle, fail, ERROR_CODES } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { guardRateLimit } from '@/lib/http/rate-limit';
import { getSttProvider, SttError, describeVoiceCapabilities } from '@/modules/voice/providers';

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
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    // Audio is the most expensive input in the system, so it has its own budget.
    const limited = await guardRateLimit(request, 'voice', guard.session.userId);
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

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(ERROR_CODES.VALIDATION_FAILED, 'The recording could not be read. Please try again.', {
        status: 400,
      });
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
      const result = await provider.transcribe({
        audio,
        filename: `speech.${type === 'audio/ogg' ? 'ogg' : type === 'audio/mp4' ? 'mp4' : 'webm'}`,
        language,
      });

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
