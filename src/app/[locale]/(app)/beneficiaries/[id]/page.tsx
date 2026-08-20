import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect, notFound } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { getBeneficiaryDetail } from '@/modules/entitlements/entitlement.service';
import { isUnionOfficialOf } from '@/modules/civic/roles';
import { BeneficiaryDetail } from '@/components/beneficiaries/BeneficiaryDetail';

export default async function BeneficiaryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const detail = await getBeneficiaryDetail(id);
  if (!detail) notFound();
  if (!isUnionOfficialOf(session.user, detail.unionId)) redirect(`/${locale}/beneficiaries`);

  const t = await getTranslations('beneficiaries');

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
      </header>
      <BeneficiaryDetail
        beneficiary={{
          programCode: detail.beneficiary!.programCode,
          programName: detail.beneficiary!.programName,
          programNameBn: detail.beneficiary!.programNameBn,
          status: detail.beneficiary!.status,
          entitlements: detail.entitlements ?? [],
        }}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
