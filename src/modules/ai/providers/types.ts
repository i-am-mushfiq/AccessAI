import type { AiEngine } from '@/lib/domain/enums';

/**
 * The provider contract.
 *
 * Exactly one seam between AccessAI and any language model. Services depend on
 * this interface only, so the deterministic engine and a hosted model are
 * interchangeable — and, critically, the engine that served a response is
 * always known and is reported to the citizen (never silently swapped).
 */

export interface GenerateInput {
  readonly system: string;
  readonly user: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  /** Abort signal so a slow model cannot hold a request open indefinitely. */
  readonly signal?: AbortSignal;
}

export interface GenerateResult {
  readonly text: string;
  readonly engine: AiEngine;
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
  /**
   * True when the provider could not be reached and a deterministic fallback
   * produced this text instead. Surfaced in the UI — a degraded answer must
   * never look like a normal one.
   */
  readonly degraded?: boolean;
  readonly error?: string;
}

export type ProviderFailureCode =
  | 'missing-api-key'
  | 'authentication'
  | 'unsupported-model'
  | 'rate-limit'
  | 'network-unavailable'
  | 'malformed-response'
  | 'provider-error';

export interface EmbedResult {
  readonly vectors: readonly number[][];
  readonly model: string;
  readonly engine: AiEngine;
}

export interface LlmProvider {
  readonly engine: AiEngine;
  readonly model: string;
  /** Whether this provider performs real inference against a hosted model. */
  readonly isLive: boolean;
  generate(input: GenerateInput): Promise<GenerateResult>;
  /** Null when the provider cannot embed; the retriever then uses BM25 only. */
  embed?(texts: readonly string[]): Promise<EmbedResult | null>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
    readonly code: ProviderFailureCode = 'provider-error',
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

function codeForStatus(status: number, body = ''): ProviderFailureCode {
  if (status === 401 || status === 403) return 'authentication';
  if (status === 404) return 'unsupported-model';
  if (status === 429) return 'rate-limit';
  if (status === 400 && /model.{0,40}(invalid|not found|does not exist)|invalid.{0,40}model/i.test(body)) {
    return 'unsupported-model';
  }
  if (status >= 500) return 'network-unavailable';
  return 'provider-error';
}

/** Safe operator-facing failure text; upstream bodies are intentionally omitted. */
export function safeProviderFailure(error: unknown): { code: ProviderFailureCode; status?: number; message: string } {
  if (error instanceof ProviderError) {
    const labels: Record<ProviderFailureCode, string> = {
      'missing-api-key': 'Provider API key is missing.',
      authentication: 'Provider authentication failed.',
      'unsupported-model': 'Configured model is not available at the provider.',
      'rate-limit': 'Provider rate limit reached.',
      'network-unavailable': 'Provider is unavailable or the network timed out.',
      'malformed-response': 'Provider returned a malformed response.',
      'provider-error': 'Provider request failed.',
    };
    return { code: error.code, ...(error.status ? { status: error.status } : {}), message: labels[error.code] };
  }
  return { code: 'network-unavailable', message: 'Provider is unavailable or the network timed out.' };
}

/** Shared fetch with timeout + bounded retry for transient upstream failures. */
export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  options: { signal?: AbortSignal; timeoutMs?: number; retries?: number } = {},
): Promise<unknown> {
  const { timeoutMs = 30_000, retries = 1 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const upstreamBody = await response.text().catch(() => '');
        // 4xx is a request problem — retrying cannot help and only adds latency.
        const retryable = response.status === 429 || response.status >= 500;
        // Do not retain or propagate the response body: providers sometimes
        // echo request metadata, account identifiers, or secret-bearing detail.
        throw new ProviderError('Provider request failed', response.status, retryable, codeForStatus(response.status, upstreamBody));
      }
      try {
        return await response.json();
      } catch {
        throw new ProviderError('Provider returned malformed JSON', response.status, false, 'malformed-response');
      }
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ProviderError ? error.retryable : true;
      if (!retryable || attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  if (lastError instanceof ProviderError) throw lastError;
  throw new ProviderError('Provider is unavailable or the network timed out.', undefined, true, 'network-unavailable');
}
