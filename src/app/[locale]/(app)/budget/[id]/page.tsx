import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect, notFound } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { getAllocation } from '@/modules/budget/budget.service';
import { BudgetDetail } from '@/components/budget/BudgetDetail';

export default async function AllocationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const result = await getAllocation(id);
  if (!result) notFound();

  const t = await getTranslations('budget');
  const myUnionId = session.profile?.residencyUnionId ?? null;

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
      </header>
      <BudgetDetail
        allocation={{
          id: result.allocation.id,
          projectName: result.allocation.projectName,
          description: result.allocation.description,
          amount: result.allocation.amount,
          allocationDate: result.allocation.allocationDate.toISOString(),
          escalated: result.allocation.escalated,
        }}
        posterName={result.posterName}
        unionName={result.unionName}
        unionNameBn={result.unionNameBn}
        flagCount={result.flagCount}
        verifiedResidentCount={result.verifiedResidentCount}
        ratio={result.ratio}
        ledgerCount={result.ledger.length}
        canFlag={myUnionId === result.allocation.unionId}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
