import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { listEscalationsForOfficer, listUnassignedEscalations } from '@/modules/budget/escalation.service';
import { EscalationQueue } from '@/components/officer/EscalationQueue';

export default async function OfficerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (session.user.civicRole !== 'upazila_officer') redirect(`/${locale}/dashboard`);

  const t = await getTranslations('officer');
  const [mine, unassigned] = await Promise.all([
    listEscalationsForOfficer(session.userId),
    listUnassignedEscalations(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary">{t('subtitle')}</p>
      </header>

      <EscalationQueue
        mine={mine.map(({ escalation, allocation }) => ({
          id: escalation.id,
          status: escalation.status,
          flagCount: escalation.flagCount,
          verifiedResidentCount: escalation.verifiedResidentCount,
          ratio: escalation.ratio,
          createdAt: escalation.createdAt.toISOString(),
          allocationId: allocation.id,
          projectName: allocation.projectName,
          amount: allocation.amount,
        }))}
        unassigned={unassigned.map(({ escalation, allocation }) => ({
          id: escalation.id,
          status: escalation.status,
          flagCount: escalation.flagCount,
          verifiedResidentCount: escalation.verifiedResidentCount,
          ratio: escalation.ratio,
          createdAt: escalation.createdAt.toISOString(),
          allocationId: allocation.id,
          projectName: allocation.projectName,
          amount: allocation.amount,
        }))}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'officer' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
