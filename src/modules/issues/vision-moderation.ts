import { env } from '@/lib/config/env';
import type { VisionModerationStatus } from '@/lib/domain/enums';

/**
 * SJ-21 — vision-based moderation of a submitted issue photo.
 *
 * Same seam pattern as modules/voice/providers.ts's STT/TTS adapters: an
 * OpenAI-compatible endpoint, `null`/`unavailable` when unconfigured, and
 * — the one difference that matters here — an unconfigured moderator does
 * NOT mean "let the photo through." A photo nobody has checked is routed to
 * human review (`autoFlagged: true`), matching the existing text keyword
 * filter's own honesty rule: uncertain is a signal for a human, never a
 * silent pass. What this module explicitly does NOT attempt, even in demo
 * mode, is real NSFW/violence classification without a configured model —
 * that would require an actual vision model, which is exactly the seam
 * below calls out to when one is configured; there is no local heuristic
 * standing in for real content classification, because a wrong invented
 * verdict is worse than an honest "not checked."
 *
 * `VISION_MODERATION_PROVIDER=demo` is a separate, narrower thing: a
 * deterministic, declared-as-simulated size check (a photo under ~2KB —
 * the size of a placeholder/test image, not a real camera photo — is
 * flagged; anything larger passes) so the moderation pipeline can be
 * demonstrated end to end with no vendor key. Recorded as `demo_passed`/
 * `demo_flagged`, never `passed`/`flagged`, so it is never mistaken for a
 * real vision-model result later.
 */

export interface VisionModerationResult {
  readonly status: VisionModerationStatus;
  readonly flagged: boolean;
  readonly reason: string | null;
}

interface VisionVerdict {
  readonly violates_policy: boolean;
  readonly reason: string;
}

const MODERATION_PROMPT =
  'You are a content moderator for a Bangladeshi civic issue-reporting app. ' +
  'The photo should show a real local infrastructure problem (a road, a water source, a building, ' +
  'sanitation, etc.) reported by a citizen. Flag it if it shows graphic violence, sexual content, ' +
  'or is clearly irrelevant to a civic complaint (e.g. a selfie, a meme, a screenshot of unrelated text). ' +
  'Respond with ONLY a JSON object: {"violates_policy": boolean, "reason": string}.';

async function callVisionModerator(photoDataUrl: string): Promise<VisionVerdict> {
  const response = await fetch(`${env.VISION_MODERATION_BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.VISION_MODERATION_API_KEY ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.VISION_MODERATION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: MODERATION_PROMPT },
            { type: 'image_url', image_url: { url: photoDataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Vision moderation provider responded ${response.status}: ${body.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Vision moderation provider returned no content.');

  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== 'object' || parsed === null || !('violates_policy' in parsed)) {
    throw new Error('Vision moderation provider returned an unexpected shape.');
  }
  const verdict = parsed as { violates_policy: unknown; reason?: unknown };
  return {
    violates_policy: Boolean(verdict.violates_policy),
    reason: typeof verdict.reason === 'string' ? verdict.reason : 'No reason given.',
  };
}

const DEMO_MIN_BYTES = 2000;

/** A deterministic, clearly-simulated stand-in for a real vision check — see the module doc comment. */
function simulateModeration(photoDataUrl: string): VisionModerationResult {
  const base64 = photoDataUrl.slice(photoDataUrl.indexOf(',') + 1);
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes < DEMO_MIN_BYTES) {
    return {
      status: 'demo_flagged',
      flagged: true,
      reason: `Demo mode: this image is only ~${approxBytes} bytes, too small to be a genuine site photo (simulated check, not a real vision-model result).`,
    };
  }
  return { status: 'demo_passed', flagged: false, reason: null };
}

/**
 * Never throws: a provider error is treated the same as "not configured" —
 * routed to human review, since a moderation call that failed is exactly as
 * unverified as one that was never made.
 */
export async function moderateIssuePhoto(photoDataUrl: string): Promise<VisionModerationResult> {
  if (env.VISION_MODERATION_PROVIDER === 'demo') {
    return simulateModeration(photoDataUrl);
  }
  if (!env.VISION_MODERATION_API_KEY) {
    return { status: 'unavailable', flagged: true, reason: 'No vision moderation provider configured — routed for manual review.' };
  }

  try {
    const verdict = await callVisionModerator(photoDataUrl);
    return verdict.violates_policy
      ? { status: 'flagged', flagged: true, reason: verdict.reason }
      : { status: 'passed', flagged: false, reason: null };
  } catch (error) {
    return {
      status: 'unavailable',
      flagged: true,
      reason: `Vision moderation failed (${error instanceof Error ? error.message : String(error)}) — routed for manual review.`,
    };
  }
}
