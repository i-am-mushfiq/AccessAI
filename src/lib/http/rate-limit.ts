import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { rateLimitBuckets } from '@/lib/db/schema';
import { env } from '@/lib/config/env';
import { fail, ERROR_CODES } from './response';
import type { NextResponse } from 'next/server';

/**
 * Token-bucket rate limiting — PRD §48.
 *
 * PRD §37 specifies Redis. This implementation stores buckets in the primary
 * database so the prototype needs no second service; the interface is the same
 * one a Redis implementation would expose, so swapping is a single-file change
 * (docs/DEVIATIONS.md §7).
 *
 * A token bucket rather than a fixed window because a fixed window lets a
 * client burst the full quota in the last millisecond of one window and again
 * in the first of the next — twice the intended rate at the boundary.
 */

export interface RateLimitOptions {
  /** Requests allowed per window. */
  readonly limit: number;
  readonly windowMs: number;
  /** Bucket key: an IP for anonymous traffic, a user id when signed in. */
  readonly key: string;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterMs: number;
}

export async function consume(options: RateLimitOptions): Promise<RateLimitResult> {
  const { limit, windowMs, key } = options;
  const now = Date.now();
  const refillPerMs = limit / windowMs;

  const [existing] = await db
    .select()
    .from(rateLimitBuckets)
    .where(eq(rateLimitBuckets.key, key))
    .limit(1);

  if (!existing) {
    await db
      .insert(rateLimitBuckets)
      .values({ key, tokens: limit - 1, updatedAt: new Date(now) })
      .onConflictDoUpdate({
        target: rateLimitBuckets.key,
        set: { tokens: sql`max(0, ${rateLimitBuckets.tokens} - 1)`, updatedAt: new Date(now) },
      });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  const elapsed = Math.max(0, now - existing.updatedAt.getTime());
  const refilled = Math.min(limit, existing.tokens + elapsed * refillPerMs);

  if (refilled < 1) {
    // Time until one whole token is available again.
    const retryAfterMs = Math.ceil((1 - refilled) / refillPerMs);
    await db
      .update(rateLimitBuckets)
      .set({ tokens: refilled, updatedAt: new Date(now) })
      .where(eq(rateLimitBuckets.key, key));
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  const remaining = refilled - 1;
  await db
    .update(rateLimitBuckets)
    .set({ tokens: remaining, updatedAt: new Date(now) })
    .where(eq(rateLimitBuckets.key, key));

  return { allowed: true, remaining: Math.floor(remaining), retryAfterMs: 0 };
}

/** Client identity for anonymous limiting. Trusts proxy headers by necessity. */
export function clientKey(request: Request, suffix: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `${suffix}:${ip}`;
}

export function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined;
}

/**
 * Guard helper. `scope` picks the quota: AI turns are far more expensive than a
 * list read, so they get their own, much smaller budget (PRD §128 cost risk).
 */
export async function guardRateLimit(
  request: Request,
  scope: 'default' | 'ai' | 'auth' | 'voice',
  identity?: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const limits = {
    default: { limit: env.RATE_LIMIT_MAX_REQUESTS, windowMs: env.RATE_LIMIT_WINDOW_MS },
    ai: { limit: env.RATE_LIMIT_AI_MAX_REQUESTS, windowMs: env.RATE_LIMIT_WINDOW_MS },
    // Deliberately tight: this is the brute-force surface.
    auth: { limit: 10, windowMs: 60_000 },
    /**
     * Audio is the most expensive input in the system — a megabyte of upload and
     * a per-minute transcription charge per press — so it gets the smallest
     * budget. 30/min still allows continuous voice navigation, where each command
     * is a two-second clip.
     */
    voice: { limit: env.RATE_LIMIT_VOICE_MAX_REQUESTS, windowMs: env.RATE_LIMIT_WINDOW_MS },
  }[scope];

  const key = identity ? `${scope}:user:${identity}` : clientKey(request, scope);
  const result = await consume({ ...limits, key });

  if (!result.allowed) {
    const seconds = Math.ceil(result.retryAfterMs / 1000);
    const response = fail(
      ERROR_CODES.RATE_LIMITED,
      `Too many requests. Please wait ${seconds} second${seconds === 1 ? '' : 's'} and try again.`,
      { status: 429, details: { retryAfterMs: result.retryAfterMs } },
    );
    response.headers.set('Retry-After', String(seconds));
    return { ok: false, response };
  }
  return { ok: true };
}
