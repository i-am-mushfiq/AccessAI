import type { NextResponse } from 'next/server';
import { fail, ERROR_CODES, type ErrorCode } from './response';
import { AuthError } from '@/modules/auth/auth.service';

/**
 * Maps a domain AuthError onto the HTTP envelope.
 *
 * Kept in the HTTP layer, not the service, so the auth service stays free of
 * framework types and remains directly unit-testable.
 */
const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  ACCOUNT_LOCKED: 423,
  PHONE_ALREADY_REGISTERED: 409,
  PHONE_NOT_REGISTERED: 404,
  OTP_INVALID: 400,
  OTP_EXPIRED: 410,
  OTP_ATTEMPTS_EXCEEDED: 429,
  PIN_INVALID: 401,
  INTERNAL: 500,
};

const KNOWN_CODES = new Set<string>(Object.values(ERROR_CODES));

export function authErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthError)) return null;
  const code: ErrorCode = KNOWN_CODES.has(error.code)
    ? (error.code as ErrorCode)
    : ERROR_CODES.INTERNAL;
  return fail(code, error.message, {
    status: STATUS_BY_CODE[error.code] ?? 400,
    ...(error.meta ? { details: error.meta } : {}),
  });
}

/** Rethrows anything that is not an AuthError, so `handle()` logs it as a 500. */
export function rethrowUnlessAuth(error: unknown): NextResponse {
  const mapped = authErrorResponse(error);
  if (mapped) return mapped;
  throw error;
}
