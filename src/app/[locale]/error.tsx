'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, Flag } from 'lucide-react';

/**
 * Route error boundary — BDS §75.
 *
 * The technical message is deliberately NOT shown to the citizen; it is logged
 * for the operator instead. A stack trace shown to someone looking for a widow's
 * allowance is noise that erodes trust. The `digest` is surfaced as a short
 * reference so a support call can be matched to the log entry.
 */
export default function RouteError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const t = useTranslations('errors');
  const tc = useTranslations('common');

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[route-error]', error.digest ?? '', error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <Flag size={64} className="icon text-ramp-error-500" strokeWidth={1.5} aria-hidden="true" />
      <h1 className="type-heading-lg text-text-primary">{t('genericTitle')}</h1>
      <p className="type-body-lg text-text-secondary measure">{t('genericBody')}</p>

      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-6 type-label-lg text-text-on-brand hover:bg-ramp-green-700 active:bg-ramp-green-800 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
      >
        <RefreshCw size={20} className="icon" aria-hidden="true" />
        {tc('retry')}
      </button>

      {error.digest ? (
        <p className="type-caption tabular text-text-tertiary">{error.digest}</p>
      ) : null}
    </div>
  );
}
