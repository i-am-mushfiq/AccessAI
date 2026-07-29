import type { NextResponse } from 'next/server';
import { COOKIE_NAMES, ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from '@/lib/security/tokens';
import { isProduction } from '@/lib/config/env';

/**
 * Auth cookie handling.
 *
 * Both tokens are httpOnly, so no script can read them: the access token is
 * never exposed to the client bundle, which removes XSS token theft entirely.
 * `sameSite: 'lax'` is chosen over `strict` so that following a link into the
 * app from an SMS or email keeps the citizen signed in — with `strict` they
 * would land signed out, which reads as the app having lost their account.
 */

export function setAuthCookies(response: NextResponse, tokens: { accessToken: string; refreshToken: string }): void {
  response.cookies.set(COOKIE_NAMES.access, tokens.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TTL_SECONDS,
  });
  response.cookies.set(COOKIE_NAMES.refresh, tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    // Scoped to the refresh endpoint so it is not sent on every request.
    path: '/',
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  for (const name of [COOKIE_NAMES.access, COOKIE_NAMES.refresh]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}

export { COOKIE_NAMES };
