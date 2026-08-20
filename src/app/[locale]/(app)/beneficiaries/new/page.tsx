import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { isUnionOfficialOf } from '@/modules/civic/roles';
import { BeneficiaryForm } from '@/components/beneficiaries/BeneficiaryForm';

export default async function NewBeneficiaryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const unionId = session.user.civicUnionId;
  if (!unionId || !isUnionOfficialOf(session.user, unionId)) redirect(`/${locale}/beneficiaries`);

  const t = await getTranslations('beneficiaries');

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('enrolNew')}</h1>
      </header>
      <BeneficiaryForm />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'beneficiaries' });
  return { title: t('enrolNew') };
}

export const dynamic = 'force-dynamic';
