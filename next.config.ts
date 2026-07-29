import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // BDS §4.7 / §12: the first screen must stay small on 2G. Keep the client bundle honest.
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['@libsql/client'],
  // Pin the trace root to this project. A lockfile in the parent directory makes
  // Next infer the wrong workspace root, which silently drags unrelated files
  // into the server trace.
  outputFileTracingRoot: __dirname,
  /**
   * Typed routes are OFF deliberately, not by omission.
   *
   * next-intl owns navigation through `createNavigation`, and its typed-pathname
   * form (`href={{ pathname, params }}`) requires a `pathnames` config that this
   * app does not use — every link is a plain locale-prefixed string. Enabling
   * typed routes on top of that produces type errors on correct links, which
   * trains people to cast rather than to fix.
   */
  typedRoutes: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // PRD §48 — Helmet-equivalent hardening at the edge.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(self), camera=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // next/font self-hosts; no external font or CDN origins are permitted.
              "font-src 'self' data:",
              "img-src 'self' data: blob:",
              "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
