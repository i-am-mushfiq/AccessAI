import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { verifyAccessToken, COOKIE_NAMES } from './lib/security/tokens';
import { ROLE_RANK, STAFF_ROLES } from './lib/domain/enums';

/**
 * Middleware: locale resolution + route protection.
 *
 * Two responsibilities, in this order:
 *  1. next-intl resolves the locale and rewrites the path.
 *  2. Protected routes are checked against the access token BEFORE the page
 *     renders, so a signed-out visitor is redirected rather than briefly seeing
 *     an empty dashboard skeleton and then a flash of a login screen.
 *
 * Verification happens here because `jose` runs in the Edge runtime. The token
 * is only checked for signature and expiry — the authoritative role check for
 * mutations still happens in each route handler, because a token can outlive a
 * demotion by up to its remaining lifetime.
 */

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Paths (after the locale prefix) that require a signed-in citizen.
 *
 * This list must stay in step with what the `(app)` route-group layout enforces.
 * Anything that layout guards but this list omits gets the worst of both: the
 * layout's `redirect()` to the login screen with no chance to renew an expired
 * access token, because only middleware knows how to hand a navigation to
 * /api/v1/auth/renew. That is why `/opportunities` and `/nearby` appear here even
 * though the pages themselves are written to render for an anonymous visitor —
 * today the layout blocks them, so they are protected in practice. When that is
 * fixed by moving them out of the group, remove them from this list too.
 */
const PROTECTED = [
  '/dashboard',
  '/chat',
  '/saved',
  '/timeline',
  '/profile',
  '/settings',
  '/notifications',
  '/plan',
  '/admin',
  '/opportunities',
  '/nearby',
];

/** Paths a signed-in citizen should be redirected away from. */
const AUTH_ONLY = ['/login', '/register', '/forgot-pin'];

function stripLocale(pathname: string): { locale: string | null; rest: string } {
  const match = pathname.match(/^\/(bn|en)(\/.*)?$/);
  if (!match) return { locale: null, rest: pathname };
  return { locale: match[1]!, rest: match[2] ?? '/' };
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes handle their own auth and must not be locale-rewritten.
  if (pathname.startsWith('/api')) return NextResponse.next();

  const response = intlMiddleware(request);

  const { locale, rest } = stripLocale(pathname);
  const activeLocale = locale ?? routing.defaultLocale;

  const needsAuth = PROTECTED.some((p) => rest === p || rest.startsWith(`${p}/`));
  const isAuthPage = AUTH_ONLY.some((p) => rest === p || rest.startsWith(`${p}/`));

  if (!needsAuth && !isAuthPage) return response;

  const token = request.cookies.get(COOKIE_NAMES.access)?.value;
  const claims = token ? await verifyAccessToken(token) : null;

  if (needsAuth && !claims) {
    /**
     * No usable access token. Before sending anyone to the login screen, check
     * whether the session is actually recoverable.
     *
     * The access token lives 15 minutes; the refresh token lives 30 days. So the
     * common case here is not "signed out" — it is "reading pages for a quarter
     * of an hour". Redirecting to login at that point discards a valid
     * credential and reads, correctly, as the app randomly losing the account.
     *
     * This runs on the Edge runtime and cannot reach the database, so it cannot
     * rotate the token itself. It hands the navigation to /api/v1/auth/renew,
     * which can, and which bounces straight back to `rest`.
     *
     * `renewed` guards the one failure mode this could otherwise cause: if the
     * fresh cookie somehow is not visible on the way back, we must go to login
     * rather than ping-pong between here and the renew route.
     */
    const hasRefresh = Boolean(request.cookies.get(COOKIE_NAMES.refresh)?.value);
    const alreadyTried = request.nextUrl.searchParams.get('renewed') === '1';

    if (hasRefresh && !alreadyTried) {
      const renew = request.nextUrl.clone();
      renew.pathname = '/api/v1/auth/renew';
      // Carry the ORIGINAL query string through, so a filtered list or a deep
      // link survives the round trip instead of dumping them on a bare page.
      const nextTarget = `/${activeLocale}${rest === '/' ? '' : rest}${request.nextUrl.search}`;
      renew.search = '';
      renew.searchParams.set('next', nextTarget);
      renew.searchParams.set('locale', activeLocale);
      return NextResponse.redirect(renew);
    }

    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}/login`;
    // Preserve the destination so the citizen lands where they intended after
    // signing in, rather than on a generic dashboard.
    url.search = '';
    url.searchParams.set('next', rest);
    return NextResponse.redirect(url);
  }

  // Staff-only area. Checked here so a citizen never sees the admin chrome.
  if (claims && rest.startsWith('/admin')) {
    const isStaff = STAFF_ROLES.includes(claims.role) && ROLE_RANK[claims.role] >= ROLE_RANK.moderator;
    if (!isStaff) {
      const url = request.nextUrl.clone();
      url.pathname = `/${activeLocale}/dashboard`;
      url.searchParams.set('denied', 'admin');
      return NextResponse.redirect(url);
    }
  }

  if (isAuthPage && claims) {
    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}/dashboard`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except static assets and Next internals.
  matcher: ['/((?!_next|_vercel|favicon.ico|.*\\..*).*)'],
};
