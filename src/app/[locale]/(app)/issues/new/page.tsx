import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { IssueForm } from '@/components/issues/IssueForm';

export default async function NewIssuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!session.profile?.residencyUnionId) redirect(`/${locale}/identity`);

  const t = await getTranslations('issues');

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('reportIssue')}</h1>
      </header>
      <IssueForm />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'issues' });
  return { title: t('reportIssue') };
}

export const dynamic = 'force-dynamic';
