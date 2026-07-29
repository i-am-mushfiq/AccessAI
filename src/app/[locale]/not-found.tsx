import { getTranslations } from 'next-intl/server';
import { FileQuestion } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/** BDS §75: every error state is actionable. A 404 offers a way onward. */
export default async function NotFound() {
  const t = await getTranslations('errors');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center">
      <FileQuestion size={64} className="icon text-ramp-neutral-400" strokeWidth={1.5} aria-hidden="true" />
      <h1 className="type-heading-lg text-text-primary">{t('notFoundTitle')}</h1>
      <p className="type-body-lg text-text-secondary measure">{t('notFoundBody')}</p>
      <Link
        href="/"
        className="inline-flex min-h-14 items-center justify-center rounded-md bg-ramp-green-600 px-6 type-label-lg text-text-on-brand hover:bg-ramp-green-700 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
      >
        {t('goHome')}
      </Link>
    </div>
  );
}
