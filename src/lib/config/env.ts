import { z } from 'zod';

/**
 * Typed, validated, fail-fast configuration.
 *
 * Everything optional degrades to a documented in-process fallback so the
 * product runs with an empty .env.
 *
 * This module is SERVER-ONLY and must never be imported by a client component:
 * it reads secrets, and a single client import would bundle them. The two
 * browser-relevant values (`NEXT_PUBLIC_MAP_PROVIDER`, `NEXT_PUBLIC_APP_NAME`)
 * are read in a server component and passed down as props instead, so there is
 * no need for a second client-safe config module.
 */

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));

const int = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number.parseInt(v, 10)))
    .pipe(z.number().int().positive());

const nonEmpty = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v.length > 0, 'must not be empty');

const optionalStr = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: nonEmpty.default('file:./data/accessai.db'),
  DATABASE_AUTH_TOKEN: optionalStr,

  JWT_SECRET: nonEmpty.default('dev-only-access-secret-change-me-0000000000000000'),
  JWT_REFRESH_SECRET: nonEmpty.default('dev-only-refresh-secret-change-me-000000000000000'),
  ACCESS_TOKEN_TTL: nonEmpty.default('15m'),
  REFRESH_TOKEN_TTL: nonEmpty.default('30d'),

  /**
   * Forces a provider regardless of which keys are present. Without it, the
   * first configured key wins in a fixed order, which is surprising on a machine
   * that happens to have two keys in its environment.
   */
  AI_PROVIDER: z.enum(['anthropic', 'openai', 'deepseek', 'simulated']).optional(),

  ANTHROPIC_API_KEY: optionalStr,
  OPENAI_API_KEY: optionalStr,
  DEEPSEEK_API_KEY: optionalStr,
  ANTHROPIC_MODEL: nonEmpty.default('claude-sonnet-5'),
  OPENAI_MODEL: nonEmpty.default('gpt-4.1-mini'),
  OPENAI_EMBEDDING_MODEL: nonEmpty.default('text-embedding-3-small'),

  DEEPSEEK_MODEL: nonEmpty.default('deepseek-v4-flash'),
  /** OpenAI-compatible base URL. Override for a proxy or a regional endpoint. */
  DEEPSEEK_BASE_URL: nonEmpty.default('https://api.deepseek.com/v1'),
  /**
   * Whether the model produces a chain of thought. Values are the ones the API
   * actually accepts, verified against the live endpoint: `adaptive` (the
   * vendor's own default — it thinks whenever it judges thinking useful),
   * `enabled`, or `disabled`.
   *
   * DEFAULT IS `disabled`, deliberately, for three reasons:
   *  • This product does not need it. Every decision — eligibility, ranking,
   *    citations — is made deterministically BEFORE the model is called. The
   *    model only rewrites a fixed ResponsePlan into fluent prose, and there is
   *    nothing in that task to reason about.
   *  • A trace would be discarded unread, so leaving it on means paying for
   *    tokens that are thrown away. Measured on this account: ~52–79 reasoning
   *    tokens per call on `adaptive`, versus 0 when disabled — roughly 4x the
   *    output tokens for identical answers.
   *  • A chain of thought contains discarded hypotheses phrased as statements.
   *    Storing one beside a benefits decision would put rejected reasoning into
   *    an audit trail that is supposed to be defensible.
   */
  DEEPSEEK_THINKING: z.enum(['disabled', 'adaptive', 'enabled']).default('disabled'),
  /**
   * Only sent when thinking is not disabled. The API rejects `none` — turning
   * thinking off is `DEEPSEEK_THINKING`, not an effort level.
   */
  DEEPSEEK_REASONING_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
  /**
   * Escape hatch merged into the request body last, so it can override anything
   * above if the API changes. Empty by default: sending a field the endpoint does
   * not recognise is a 400, not a no-op.
   */
  DEEPSEEK_EXTRA_BODY: optionalStr,

  OTP_DEV_ECHO: bool(true),
  SMS_PROVIDER: optionalStr,
  SMS_API_KEY: optionalStr,
  SMS_SENDER_ID: optionalStr,

  /* ------------------------------------------------------------- voice */
  /**
   * Speech-to-text, OPTIONAL. Without it, dictation uses the browser's Web
   * Speech API where available and the microphone is disabled with a stated
   * reason where it is not. Nothing is ever simulated: an invented transcript
   * would be acted on.
   *
   * The endpoint is the OpenAI-compatible `/audio/transcriptions` shape, which
   * hosted Whisper and a self-hosted whisper.cpp server both speak — so
   * `STT_BASE_URL` is the only thing that changes between them.
   */
  STT_API_KEY: optionalStr,
  STT_BASE_URL: nonEmpty.default('https://api.openai.com/v1'),
  STT_MODEL: nonEmpty.default('whisper-1'),
  /**
   * Vocabulary bias for the decoder. Seeding the domain words this app needs
   * measurably cuts the mishearings that matter, because a general model has no
   * reason to prefer "বিধবা ভাতা" over similar-sounding nonsense.
   */
  STT_PROMPT: optionalStr,

  /** Text-to-speech, OPTIONAL — used only when the browser has no Bangla voice. */
  TTS_API_KEY: optionalStr,
  TTS_BASE_URL: nonEmpty.default('https://api.openai.com/v1'),
  TTS_MODEL: nonEmpty.default('tts-1'),
  TTS_VOICE: nonEmpty.default('alloy'),

  GOOGLE_MAPS_API_KEY: optionalStr,
  NEXT_PUBLIC_MAPBOX_TOKEN: optionalStr,
  NEXT_PUBLIC_MAP_PROVIDER: z.enum(['none', 'mapbox', 'google']).default('none'),

  SMTP_HOST: optionalStr,
  SMTP_PORT: int(587),
  SMTP_USER: optionalStr,
  SMTP_PASSWORD: optionalStr,
  SMTP_FROM: nonEmpty.default('AccessAI <no-reply@accessai.local>'),

  S3_BUCKET: optionalStr,
  S3_REGION: optionalStr,
  S3_ACCESS_KEY: optionalStr,
  S3_SECRET_KEY: optionalStr,
  S3_ENDPOINT: optionalStr,

  NEXT_PUBLIC_APP_NAME: nonEmpty.default('AccessAI'),

  RATE_LIMIT_WINDOW_MS: int(60_000),
  RATE_LIMIT_MAX_REQUESTS: int(120),
  RATE_LIMIT_AI_MAX_REQUESTS: int(20),
  RATE_LIMIT_VOICE_MAX_REQUESTS: int(30),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }
  return parsed.data;
}

export const env = load();

/** Which AI provider will actually serve requests. */
export type AiMode = 'anthropic' | 'openai' | 'deepseek' | 'simulated';

export function resolveAiMode(): AiMode {
  // An explicit choice always wins, and is honoured even when it is wrong: if
  // AI_PROVIDER names a provider whose key is missing, `aiConfigProblems()`
  // reports it rather than this function silently falling back to another
  // provider the operator did not choose.
  if (env.AI_PROVIDER) return env.AI_PROVIDER;
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.DEEPSEEK_API_KEY) return 'deepseek';
  return 'simulated';
}

/**
 * Misconfigurations that would make the AI layer fail at request time rather
 * than at startup. Surfaced on the admin overview so an operator who sets
 * AI_PROVIDER without the matching key finds out immediately.
 */
export function aiConfigProblems(): string[] {
  const problems: string[] = [];
  const mode = resolveAiMode();
  const keyFor: Record<string, string | undefined> = {
    anthropic: env.ANTHROPIC_API_KEY,
    openai: env.OPENAI_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
  };
  if (mode !== 'simulated' && !keyFor[mode]) {
    problems.push(`AI_PROVIDER is "${mode}" but ${mode.toUpperCase()}_API_KEY is not set.`);
  }
  if (mode === 'deepseek' && env.DEEPSEEK_THINKING !== 'disabled') {
    problems.push(
      `DEEPSEEK_THINKING is "${env.DEEPSEEK_THINKING}", so the model will produce a chain of thought. This product discards it unread — you are paying for tokens nothing uses.`,
    );
  }
  if (env.DEEPSEEK_REASONING_EFFORT && env.DEEPSEEK_THINKING === 'disabled') {
    problems.push(
      'DEEPSEEK_REASONING_EFFORT is set but thinking is disabled, so it has no effect and is not sent.',
    );
  }
  if (env.DEEPSEEK_EXTRA_BODY) {
    try {
      const parsed: unknown = JSON.parse(env.DEEPSEEK_EXTRA_BODY);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        problems.push('DEEPSEEK_EXTRA_BODY must be a JSON object.');
      }
    } catch {
      problems.push('DEEPSEEK_EXTRA_BODY is not valid JSON and will be ignored.');
    }
  }
  return problems;
}

/** True when real vector embeddings are available; otherwise BM25 is used. */
export const hasEmbeddingProvider = Boolean(env.OPENAI_API_KEY);

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Refuse to boot a production deployment on the shipped dev secrets.
 * A weak JWT secret is a total-compromise defect, not a warning.
 */
export function assertProductionSafety(): string[] {
  const problems: string[] = [];
  if (!isProduction) return problems;
  if (env.JWT_SECRET.startsWith('dev-only')) problems.push('JWT_SECRET is still the shipped development value.');
  if (env.JWT_REFRESH_SECRET.startsWith('dev-only')) problems.push('JWT_REFRESH_SECRET is still the shipped development value.');
  if (env.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be at least 32 characters.');
  if (env.OTP_DEV_ECHO) problems.push('OTP_DEV_ECHO must be false in production — it reveals OTPs to the client.');
  return problems;
}
