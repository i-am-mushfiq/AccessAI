import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { checkMyEntitlementStatus } from '@/modules/entitlements/entitlement.service';
import { Link } from '@/i18n/navigation';
import { Banner } from '@/components/primitives/Banner';
import { EntitlementStatus } from '@/components/entitlements/EntitlementStatus';

export default async function EntitlementsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const bn = locale === 'bn';

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('entitlements');
  const result = await checkMyEntitlementStatus(session.userId);

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary">{t('subtitle')}</p>
      </header>

      {result.reason === 'nid_not_verified' ? (
        <>
          <Banner tone="warning" statusWord={bn ? 'যাচাই প্রয়োজন' : 'Verification needed'}>
            {t('needsNid')}
          </Banner>
          <Link
            href="/identity"
            className="inline-flex min-h-14 w-fit items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-6 type-label-lg text-text-on-brand hover:bg-ramp-green-700"
          >
            {t('verifyNow')}
          </Link>
        </>
      ) : (
        <EntitlementStatus result={result} />
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'entitlements' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
