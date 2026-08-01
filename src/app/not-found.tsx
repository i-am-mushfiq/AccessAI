import Link from 'next/link';
import { routing, LOCALE_TAGS } from '@/i18n/routing';
import { catalog, project, LOCALE_INDEX } from '@/messages/catalog';
import './globals.css';

/**
 * The 404 for URLs that never reach a locale.
 *
 * This file emits its own `<html>` and `<body>`, which no other page here does —
 * and that is the entire reason it exists.
 *
 * `app/layout.tsx` deliberately returns bare children, because `<html lang>` must
 * carry the active locale: every Bangla typography rule in globals.css hangs off
 * `:lang(bn)`, so the tag cannot be emitted before the locale is known. That works
 * for every route under `[locale]`. It does NOT work for a URL that matches no
 * route at all — Next then renders this file inside the ROOT layout, and with no
 * `<html>` anywhere the response is not a 404 but a framework crash:
 * "Missing <html> and <body> tags in the root layout".
 *
 * So a mistyped address produced a runtime error rather than a page. That is bad
 * on its own and worse as a diagnostic: it hid a real routing bug. A doubled
 * locale prefix (`/en/en/nearby`, from an inconsistent `?next=`) surfaced only as
 * this crash, which points at layouts and says nothing about the URL.
 *
 * Bilingual because at this point the citizen's locale is genuinely unknown —
 * there is no prefix to read it from and no `NextIntlClientProvider` above this,
 * so both languages are shown rather than guessing wrong for half of them.
 */

const bn = project(catalog, LOCALE_INDEX.bn) as { errors: Record<string, string> };
const en = project(catalog, LOCALE_INDEX.en) as { errors: Record<string, string> };

export default function GlobalNotFound() {
  return (
    <html lang={LOCALE_TAGS[routing.defaultLocale]} dir="ltr" data-theme="light">
      <body className="font-body antialiased">
        <main
          id="main"
          className="mx-auto flex min-h-screen max-w-form flex-col justify-center gap-8 px-4 py-16"
        >
          <div className="flex flex-col gap-3">
            <p className="type-caption tabular text-text-tertiary">404</p>
            <h1 className="type-heading-lg text-text-primary">{bn.errors.notFoundTitle}</h1>
            <p className="type-body-lg text-text-secondary measure">{bn.errors.notFoundBody}</p>
          </div>

          <hr className="border-stroke-subtle" />

          <div className="flex flex-col gap-3">
            <h2 className="type-heading-sm text-text-primary">{en.errors.notFoundTitle}</h2>
            <p className="type-body-lg text-text-secondary measure">{en.errors.notFoundBody}</p>
          </div>

          {/**
           * `next/link`, not the locale-aware one. There is no locale context here,
           * and the locale-aware Link would prefix a path that is already prefixed —
           * which is the exact bug that most often lands someone on this page.
           */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/${routing.defaultLocale}`}
              className="inline-flex min-h-14 flex-1 items-center justify-center rounded-md bg-ramp-green-600 px-6 type-label-lg text-text-on-brand hover:bg-ramp-green-700 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
            >
              বাংলা — প্রথম পাতা
            </Link>
            <Link
              href="/en"
              className="inline-flex min-h-14 flex-1 items-center justify-center rounded-md border-1.5 border-stroke px-6 type-label-lg text-text-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
            >
              English — Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
