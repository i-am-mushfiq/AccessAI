import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { handle, fail, ERROR_CODES, readJson } from '@/lib/http/response';
import { requireSession } from '@/lib/http/session';
import { guardRateLimit } from '@/lib/http/rate-limit';
import { getTtsProvider, SttError } from '@/modules/voice/providers';

/**
 * POST /api/v1/voice/speak — text in, audio out.
 *
 * This exists so read-aloud does not depend on a voice being installed on the
 * device. `speechSynthesis` is free and offline, but Android frequently ships
 * with no `bn-BD` voice at all, and then it either stays silent or reads Bangla
 * with an English voice — unintelligible, and worse than nothing because it
 * sounds like the feature is working. For the citizens this product is for, that
 * is the difference between an answer they can receive and one they cannot.
 *
 * COST IS BOUNDED BY CACHING, not by rationing. Nearly everything this app reads
 * aloud is deterministic — programme titles, condition reasons, next steps, UI
 * copy all come from the catalogue and the rule set — so the same short strings
 * recur across every citizen. A strong ETag over (text, locale, voice, model)
 * lets the browser and any CDN serve repeats without touching the provider, and
 * only live model-rendered prose is ever genuinely new.
 */

const speakSchema = z.object({
  /**
   * Bounded well below a provider's limit. Read-aloud is applied per block —
   * one reply, one card — never a whole page, because a citizen needs to be able
   * to stop and re-hear a section rather than restart a monologue.
   */
  text: z.string().trim().min(1, 'Nothing to read.').max(3000, 'That is too long to read in one go.'),
  locale: z.enum(['bn', 'en']).default('bn'),
});

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    const limited = await guardRateLimit(request, 'voice', guard.session.userId);
    if (!limited.ok) return limited.response;

    const provider = getTtsProvider();
    if (!provider) {
      return fail(
        ERROR_CODES.AI_UNAVAILABLE,
        'Reading aloud is not available on this server. Your device may still be able to read the text itself.',
        { status: 503, details: { reason: 'no_tts_provider' } },
      );
    }

    const body = speakSchema.parse(await readJson(request));

    // The voice and model are part of the identity: changing either must not
    // serve stale audio from a cache.
    const etag = `"${createHash('sha256')
      .update(`${provider.model}:${body.locale}:${body.text}`)
      .digest('base64url')
      .slice(0, 27)}"`;

    if (request.headers.get('if-none-match') === etag) {
      // Nothing spent, nothing transferred — the common case once a citizen
      // re-reads a programme they have already heard.
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    try {
      const { audio, contentType } = await provider.synthesise({
        text: body.text,
        locale: body.locale,
      });

      return new NextResponse(audio, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(audio.byteLength),
          ETag: etag,
          // Private: the text can be about this citizen's own circumstances, so
          // it must not sit in a shared cache. Immutable because the same text in
          // the same voice is always the same audio.
          'Cache-Control': 'private, max-age=604800, immutable',
        },
      });
    } catch (error) {
      if (error instanceof SttError) {
        return fail(ERROR_CODES.AI_UNAVAILABLE, 'That could not be read aloud just now. Please try again.', {
          status: 502,
        });
      }
      throw error;
    }
  }, 'voice/speak');
}

export const dynamic = 'force-dynamic';
