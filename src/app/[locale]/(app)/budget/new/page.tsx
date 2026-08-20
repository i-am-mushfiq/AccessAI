import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { isUnionOfficialOf } from '@/modules/civic/roles';
import { BudgetForm } from '@/components/budget/BudgetForm';

export default async function NewAllocationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const unionId = session.user.civicUnionId;
  if (!unionId || !isUnionOfficialOf(session.user, unionId)) redirect(`/${locale}/budget`);

  const t = await getTranslations('budget');

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('postAllocation')}</h1>
      </header>
      <BudgetForm />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'budget' });
  return { title: t('postAllocation') };
}

export const dynamic = 'force-dynamic';
