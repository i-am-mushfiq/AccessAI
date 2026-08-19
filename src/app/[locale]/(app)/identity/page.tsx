import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { getIdentityStatus, listUnions } from '@/modules/identity/identity.service';
import { IdentityVerification } from '@/components/identity/IdentityVerification';

/**
 * Verified identity & place — Phase 1.
 *
 * Nothing in Phase 2 (reporting an issue, voting) means anything without
 * this: a citizen's verified union is what scopes both.
 */
export default async function IdentityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const [status, unions] = await Promise.all([getIdentityStatus(session.userId), listUnions()]);

  const t = await getTranslations('identity');

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary">{t('subtitle')}</p>
      </header>

      <IdentityVerification
        initialStatus={{
          nidVerificationStatus: status.nidVerificationStatus,
          residencyUnionId: status.residencyUnionId,
          residencyVerificationMethod: status.residencyVerificationMethod,
          union: status.union,
        }}
        unions={unions.map((u) => ({ id: u.id, name: u.name, nameBn: u.nameBn }))}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'identity' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
