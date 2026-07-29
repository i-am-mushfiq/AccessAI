import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Consistent API envelope — PRD §50.
 *
 * Every response, success or failure, carries `success`, a timestamp, and a
 * request id. The error `code` is a stable machine-readable string; the
 * `message` is safe to show a citizen, and the two are separate so the UI can
 * localise without string-matching on prose.
 */

export interface ApiErrorBody {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    /** Per-field validation messages, keyed by field path. */
    readonly fields?: Record<string, string>;
    readonly details?: unknown;
  };
  readonly timestamp: string;
  readonly requestId: string;
}

export interface ApiSuccessBody<T> {
  readonly success: true;
  readonly data: T;
  readonly timestamp: string;
  readonly requestId: string;
  readonly meta?: Record<string, unknown>;
}

export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED',
  PIN_INVALID: 'PIN_INVALID',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  PHONE_NOT_REGISTERED: 'PHONE_NOT_REGISTERED',
  PHONE_ALREADY_REGISTERED: 'PHONE_ALREADY_REGISTERED',
  ELIGIBILITY_RULE_NOT_FOUND: 'ELIGIBILITY_RULE_NOT_FOUND',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

function requestId(): string {
  return crypto.randomUUID();
}

/**
 * An error a handler can throw to produce a specific envelope, instead of
 * returning a response from three levels down.
 */
export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status?: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Reads a JSON request body.
 *
 * `request.json()` throws a raw `SyntaxError` on an empty or malformed body,
 * which would otherwise surface as a 500 — telling the client "something went
 * wrong on our side" when in fact the request was unreadable. A truncated
 * request on a 2G connection is a normal event here, not a server fault.
 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(
      ERROR_CODES.VALIDATION_FAILED,
      'The request body could not be read. Please try again.',
      400,
    );
  }
}

export function ok<T>(data: T, init?: { status?: number; meta?: Record<string, unknown> }): NextResponse {
  const body: ApiSuccessBody<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: requestId(),
    ...(init?.meta ? { meta: init.meta } : {}),
  };
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function fail(
  code: ErrorCode,
  message: string,
  options: { status?: number; fields?: Record<string, string>; details?: unknown } = {},
): NextResponse {
  const status =
    options.status ??
    (code === ERROR_CODES.VALIDATION_FAILED
      ? 422
      : code === ERROR_CODES.UNAUTHENTICATED
        ? 401
        : code === ERROR_CODES.FORBIDDEN
          ? 403
          : code === ERROR_CODES.NOT_FOUND
            ? 404
            : code === ERROR_CODES.CONFLICT || code === ERROR_CODES.PHONE_ALREADY_REGISTERED
              ? 409
              : code === ERROR_CODES.RATE_LIMITED
                ? 429
                : 400);

  const body: ApiErrorBody = {
    success: false,
    error: {
      code,
      message,
      ...(options.fields ? { fields: options.fields } : {}),
      ...(options.details !== undefined ? { details: options.details } : {}),
    },
    timestamp: new Date().toISOString(),
    requestId: requestId(),
  };
  return NextResponse.json(body, { status });
}

/** Maps a Zod failure to per-field messages the form layer can display inline. */
export function failValidation(error: ZodError): NextResponse {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    // First message per field wins: showing three messages for one input is
    // noise, and the first is almost always the actionable one.
    if (!fields[path]) fields[path] = issue.message;
  }
  return fail(ERROR_CODES.VALIDATION_FAILED, 'Some of the information provided is not valid.', { fields });
}

/**
 * Wraps a handler so an unexpected throw becomes a logged 500 with a stable
 * envelope, never a stack trace leaked to a citizen.
 */
export async function handle(
  fn: () => Promise<NextResponse>,
  context?: string,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ZodError) return failValidation(error);
    if (error instanceof HttpError) {
      return fail(error.code, error.message, {
        ...(error.status ? { status: error.status } : {}),
        ...(error.fields ? { fields: error.fields } : {}),
      });
    }
    const id = requestId();
    // eslint-disable-next-line no-console
    console.error(`[api${context ? `:${context}` : ''}] ${id}`, error);
    return fail(ERROR_CODES.INTERNAL, 'Something went wrong on our side. Please try again.', {
      status: 500,
    });
  }
}
