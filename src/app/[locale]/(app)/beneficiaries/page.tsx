import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { HandCoins } from 'lucide-react';
import { getFullSession } from '@/lib/http/session';
import { listBeneficiariesForUnion } from '@/modules/entitlements/entitlement.service';
import { isUnionOfficialOf } from '@/modules/civic/roles';
import { EmptyState } from '@/components/primitives/States';
import { BeneficiaryFeed } from '@/components/beneficiaries/BeneficiaryFeed';

/**
 * SJ-14 — the enrolment side of the beneficiary/entitlement/disbursement
 * model that Phase 3 built the API for but never gave a chairman/union-staff
 * screen to use. Scoped to `civicUnionId` (the official's OWN civic scope),
 * not `residencyUnionId` — a beneficiary roll is enrolment data, not the
 * public-by-design budget feed, so only that union's officials see it at
 * all, matching GET /api/v1/beneficiaries' own authorisation.
 */
export default async function BeneficiariesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('beneficiaries');
  const unionId = session.user.civicUnionId;

  if (!unionId || !isUnionOfficialOf(session.user, unionId)) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        </header>
        <EmptyState title={t('notOfficial')} icon={<HandCoins size={64} className="icon" strokeWidth={1.5} />} />
      </div>
    );
  }

  const items = await listBeneficiariesForUnion(unionId);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary">{t('subtitle')}</p>
      </header>

      <BeneficiaryFeed
        items={items.map((b) => ({
          id: b.id,
          programCode: b.programCode,
          programName: b.programName,
          programNameBn: b.programNameBn,
          status: b.status,
        }))}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'beneficiaries' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
