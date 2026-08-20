import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { listAllocationsForUnion } from '@/modules/budget/budget.service';
import { isUnionOfficialOf } from '@/modules/civic/roles';
import { Link } from '@/i18n/navigation';
import { Banner } from '@/components/primitives/Banner';
import { BudgetFeed } from '@/components/budget/BudgetFeed';

export default async function BudgetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const bn = locale === 'bn';

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('budget');
  const unionId = session.profile?.residencyUnionId ?? null;

  if (!unionId) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        </header>
        <Banner tone="warning" statusWord={bn ? 'যাচাই প্রয়োজন' : 'Verification needed'}>
          {t('needsVerification')}
        </Banner>
        <Link
          href="/identity"
          className="inline-flex min-h-14 w-fit items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-6 type-label-lg text-text-on-brand hover:bg-ramp-green-700"
        >
          {bn ? 'এখনই যাচাই করুন' : 'Verify now'}
        </Link>
      </div>
    );
  }

  const items = await listAllocationsForUnion(unionId);
  const canPost = isUnionOfficialOf(session.user, unionId);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary">{t('subtitle')}</p>
      </header>

      <BudgetFeed
        items={items.map(({ allocation, posterName }) => ({
          id: allocation.id,
          projectName: allocation.projectName,
          amount: allocation.amount,
          allocationDate: allocation.allocationDate.toISOString(),
          flagCount: allocation.flagCount,
          escalated: allocation.escalated,
          posterName,
        }))}
        canPost={canPost}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'budget' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
