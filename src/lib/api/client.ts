import type { ApiErrorBody, ApiSuccessBody } from '@/lib/http/response';

/**
 * Typed browser API client.
 *
 * One place where every request goes, so three cross-cutting behaviours are
 * guaranteed rather than repeated:
 *
 *  1. The envelope is unwrapped, and a failure becomes a THROWN `ApiError`
 *     carrying the machine code and per-field messages. Forms can therefore map
 *     server validation onto inputs without parsing prose.
 *  2. A 401 triggers exactly ONE refresh attempt, then retries the original
 *     request. Without the single-flight guard, ten parallel queries on a
 *     dashboard would fire ten refreshes and the rotation-reuse detector would
 *     correctly revoke the whole session.
 *  3. A network failure is distinguished from a server error, because the two
 *     need different copy ("check your connection" vs "try again").
 */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isValidation(): boolean {
    return this.code === 'VALIDATION_FAILED';
  }
  get isUnauthenticated(): boolean {
    return this.code === 'UNAUTHENTICATED';
  }
  get isRateLimited(): boolean {
    return this.code === 'RATE_LIMITED';
  }
  get isNotFound(): boolean {
    return this.code === 'NOT_FOUND';
  }
  get retryAfterMs(): number | undefined {
    const details = this.details as { retryAfterMs?: number } | undefined;
    return details?.retryAfterMs;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

const BASE = '/api/v1';

/** Single-flight refresh, shared across concurrent 401s. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE}/auth/session`, { method: 'PUT', credentials: 'same-origin' })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        // Cleared on the next tick so callers awaiting this promise all observe
        // the same result before a new attempt can start.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      });
  }
  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  readonly body?: unknown;
  readonly query?: Record<string, string | number | boolean | undefined | null | readonly string[]>;
  /** Set false to skip the refresh-and-retry behaviour (used by auth calls). */
  readonly retryOnUnauthenticated?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE}${path}`, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const entry of value) url.searchParams.append(key, String(entry));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return `${url.pathname}${url.search}`;
}

async function execute<T>(path: string, options: RequestOptions, isRetry = false): Promise<T> {
  const { body, query, retryOnUnauthenticated = true, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new NetworkError();
  }

  if (response.status === 401 && retryOnUnauthenticated && !isRetry) {
    const refreshed = await refreshSession();
    if (refreshed) return execute<T>(path, options, true);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError('INTERNAL', 'The server returned an unreadable response.', response.status);
    }
    return undefined as T;
  }

  if (!response.ok || (payload as { success?: boolean }).success === false) {
    const error = payload as ApiErrorBody;
    throw new ApiError(
      error.error?.code ?? 'INTERNAL',
      error.error?.message ?? 'Something went wrong.',
      response.status,
      error.error?.fields,
      error.error?.details,
    );
  }

  return (payload as ApiSuccessBody<T>).data;
}

/** Returns both `data` and `meta`, for paginated reads. */
async function executeWithMeta<T>(
  path: string,
  options: RequestOptions,
): Promise<{ data: T; meta: Record<string, unknown> | undefined }> {
  const { body, query, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      credentials: 'same-origin',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new NetworkError();
  }

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) return executeWithMeta<T>(path, options);
  }

  const payload = (await response.json().catch(() => null)) as ApiSuccessBody<T> | ApiErrorBody | null;
  if (!payload || !response.ok || payload.success === false) {
    const error = payload as ApiErrorBody | null;
    throw new ApiError(
      error?.error?.code ?? 'INTERNAL',
      error?.error?.message ?? 'Something went wrong.',
      response.status,
      error?.error?.fields,
      error?.error?.details,
    );
  }
  return { data: payload.data, meta: payload.meta };
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) =>
    execute<T>(path, { method: 'GET', ...(query ? { query } : {}) }),
  getWithMeta: <T>(path: string, query?: RequestOptions['query']) =>
    executeWithMeta<T>(path, { method: 'GET', ...(query ? { query } : {}) }),
  post: <T>(path: string, body?: unknown, options?: Partial<RequestOptions>) =>
    execute<T>(path, { method: 'POST', body, ...options }),
  patch: <T>(path: string, body?: unknown) => execute<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => execute<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown) => execute<T>(path, { method: 'DELETE', body }),
};

/** Maps an ApiError onto localised copy keys the UI already has. */
export function errorMessageKey(error: unknown): string {
  if (error instanceof NetworkError) return 'errors.networkTitle';
  if (error instanceof ApiError) {
    if (error.isRateLimited) return 'errors.rateLimitTitle';
    if (error.isUnauthenticated) return 'errors.sessionExpiredTitle';
    if (error.isNotFound) return 'errors.notFoundTitle';
    if (error.code === 'FORBIDDEN') return 'errors.forbiddenTitle';
    if (error.code === 'AI_UNAVAILABLE') return 'errors.aiUnavailableTitle';
  }
  return 'errors.genericTitle';
}
