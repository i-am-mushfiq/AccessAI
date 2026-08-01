import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { handle } from '@/lib/http/response';
import { setAuthCookies, clearAuthCookies, COOKIE_NAMES } from '@/lib/http/cookies';
import { clientIp } from '@/lib/http/rate-limit';
import { safeNextPath } from '@/lib/routing/next-path';
import { refresh } from '@/modules/auth/auth.service';

/**
 * GET /api/v1/auth/renew?next=/bn/dashboard
 *
 * Rotates the session and sends the citizen onward to where they were going.
 *
 * This exists because a PAGE NAVIGATION cannot refresh itself. The browser API
 * client retries a 401 by calling `PUT /auth/session` (see src/lib/api/client.ts),
 * but a link click never reaches that code: it is intercepted by middleware,
 * which runs on the Edge runtime and cannot open a database connection to
 * validate and rotate a refresh token.
 *
 * The result, before this route existed, was a session that stayed alive as long
 * as you kept clicking things inside a page but died the moment you navigated
 * after the 15-minute access token expired — while a valid 30-day refresh token
 * sat unused in the cookie jar. Middleware now redirects here instead of to the
 * login screen, and this handler (Node runtime, full database access) does the
 * exchange and bounces back.
 *
 * A GET that mutates state needs two guards, both present below: the request
 * must be same-origin, and `next` must be a local path.
 */

/**
 * Only same-document or same-origin navigations may rotate a session.
 *
 * `SameSite=Lax` sends the refresh cookie on top-level cross-site GETs, so
 * without this check any page on the internet could link here and force a
 * rotation. That is not a privilege escalation, but two forced rotations in
 * parallel would trip reuse detection and sign the citizen out — a denial of
 * service against their session, triggerable by a hyperlink.
 */
function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'same-site' || site === 'none';

  // Older browsers: fall back to the referer, and accept its absence only when
  // there is no cross-origin evidence either way.
  const referer = request.headers.get('referer');
  if (!referer) return true;
  try {
    return new URL(referer).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  return handle(async () => {
    const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'bn';

    /**
     * Two forms of the same destination, and they are not interchangeable.
     *
     * `relative` (`/nearby`) is the ?next= contract — the login page feeds it to
     * next-intl's router, which adds the locale itself. Handing it a prefixed path
     * produced `/en/en/nearby`, a route that does not exist.
     *
     * `absolute` (`/en/nearby`) is for the redirects issued from here, which are
     * plain HTTP Location headers with no locale awareness at all.
     */
    const relative = safeNextPath(request.nextUrl.searchParams.get('next'), '/dashboard');
    const absolute = `/${locale}${relative === '/' ? '' : relative}`;
    const loginUrl = new URL(`/${locale}/login`, request.nextUrl.origin);

    const bounce = (to: string) => NextResponse.redirect(new URL(to, request.nextUrl.origin), 303);

    if (!isSameOrigin(request)) {
      // Do not rotate, do not clear: an off-site link must not be able to touch
      // the session at all. Just send them to the page they asked for.
      return bounce(absolute);
    }

    const store = await cookies();
    const token = store.get(COOKIE_NAMES.refresh)?.value;

    if (!token) {
      loginUrl.searchParams.set('next', relative);
      return bounce(`${loginUrl.pathname}${loginUrl.search}`);
    }

    try {
      const result = await refresh(token, request.headers.get('user-agent') ?? undefined, clientIp(request));
      // `renewed` is a one-shot marker. If the middleware sees it and STILL has
      // no valid access cookie, it sends the citizen to login rather than back
      // here — otherwise a cookie that cannot be set would loop forever.
      const target = new URL(absolute, request.nextUrl.origin);
      target.searchParams.set('renewed', '1');
      const response = NextResponse.redirect(target, 303);
      setAuthCookies(response, result);
      return response;
    } catch {
      // The refresh token is genuinely dead (expired, revoked, or replayed
      // outside the race window). Clear both cookies so the browser stops
      // presenting a credential that can never work, and say where they were
      // headed so signing in returns them there.
      loginUrl.searchParams.set('next', relative);
      loginUrl.searchParams.set('expired', '1');
      const response = bounce(`${loginUrl.pathname}${loginUrl.search}`);
      clearAuthCookies(response);
      return response;
    }
  }, 'auth/renew');
}

export const dynamic = 'force-dynamic';
