import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { HeartHandshake, Users, MapPin, Wallet } from 'lucide-react';
import { getFullSession } from '@/lib/http/session';
import { getDonorPortalData } from '@/modules/oversight/oversight.service';
import { Card, Section } from '@/components/primitives/Card';
import { EmptyState } from '@/components/primitives/States';
import { Money, Num } from '@/components/primitives/Money';

/**
 * SJ-27 — the Donor Portal. Exit criterion: "a donor sees real disbursement
 * data tied to actual records, not sample data." Scoped to exactly the
 * programme codes `donorFundingScopes` lists for this org — a donor funding
 * "Widow Allowance" sees Widow Allowance's real numbers, never every
 * programme in the ledger.
 */
export default async function DonorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('donor');
  if (!session.user.donorOrgId) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        </header>
        <EmptyState title={t('notDonor')} icon={<HeartHandshake size={64} className="icon" strokeWidth={1.5} />} />
      </div>
    );
  }

  const data = await getDonorPortalData(session.user.donorOrgId);
  const bn = locale === 'bn';

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{bn ? data.org?.nameBn : data.org?.name}</h1>
        <p className="type-body-lg mt-2 text-text-secondary">{t('subtitle')}</p>
      </header>

      {data.programs.length === 0 ? (
        <EmptyState title={t('noScopes')} icon={<HeartHandshake size={64} className="icon" strokeWidth={1.5} />} />
      ) : (
        data.programs.map((program) => (
          <Section key={program.programCode} title={program.programName}>
            <Card padding="default">
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-stroke-subtle bg-surface p-4 shadow-elev-1">
                  <dt className="type-caption flex items-center gap-1.5 text-text-secondary">
                    <Users size={16} className="icon shrink-0" aria-hidden="true" />
                    {t('beneficiaries')}
                  </dt>
                  <dd className="type-heading-md mt-1 tabular text-text-primary">
                    <Num value={program.beneficiaries} />
                  </dd>
                </div>
                <div className="rounded-lg border border-stroke-subtle bg-surface p-4 shadow-elev-1">
                  <dt className="type-caption flex items-center gap-1.5 text-text-secondary">
                    <MapPin size={16} className="icon shrink-0" aria-hidden="true" />
                    {t('unionsReached')}
                  </dt>
                  <dd className="type-heading-md mt-1 tabular text-text-primary">
                    <Num value={program.unions} />
                  </dd>
                </div>
                <div className="rounded-lg border border-stroke-subtle bg-surface p-4 shadow-elev-1">
                  <dt className="type-caption flex items-center gap-1.5 text-text-secondary">
                    <Wallet size={16} className="icon shrink-0" aria-hidden="true" />
                    {t('disbursedPaid')}
                  </dt>
                  <dd className="type-heading-md mt-1 tabular text-text-success">
                    <Money amount={program.disbursedPaid} decimals={0} size="label" />
                  </dd>
                </div>
                <div className="rounded-lg border border-stroke-subtle bg-surface p-4 shadow-elev-1">
                  <dt className="type-caption flex items-center gap-1.5 text-text-secondary">
                    <Wallet size={16} className="icon shrink-0" aria-hidden="true" />
                    {t('disbursedScheduled')}
                  </dt>
                  <dd className="type-heading-md mt-1 tabular text-text-primary">
                    <Money amount={program.disbursedScheduled} decimals={0} size="label" />
                  </dd>
                </div>
              </dl>
            </Card>
          </Section>
        ))
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'donor' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
