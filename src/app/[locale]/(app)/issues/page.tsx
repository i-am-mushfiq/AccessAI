import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { listUnionFeed, listMyIssues } from '@/modules/issues/issue.service';
import { Link } from '@/i18n/navigation';
import { Banner } from '@/components/primitives/Banner';
import { IssueFeed } from '@/components/issues/IssueFeed';

export default async function IssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mine?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const { mine, sort } = await searchParams;
  setRequestLocale(locale);
  const bn = locale === 'bn';

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('issues');
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
          {t('verifyNow')}
        </Link>
      </div>
    );
  }

  const isMine = mine === '1' || mine === 'true';
  const items = isMine
    ? (await listMyIssues(session.userId)).map((issue) => ({ issue, reporterName: session.user.name }))
    : await listUnionFeed(unionId, { sort: sort === 'recent' ? 'recent' : 'top' });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary">{t('subtitle')}</p>
      </header>

      <IssueFeed
        items={items.map(({ issue, reporterName }) => ({
          id: issue.id,
          category: issue.category,
          title: issue.title,
          status: issue.status,
          voteCount: issue.voteCount,
          createdAt: issue.createdAt.toISOString(),
          photoUrl: issue.photoUrl,
          reporterName,
        }))}
        mine={isMine}
        sort={sort === 'recent' ? 'recent' : 'top'}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'issues' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
