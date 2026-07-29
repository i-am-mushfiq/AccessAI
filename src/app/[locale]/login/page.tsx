import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthFlow } from '@/components/auth/AuthFlow';
import { AuthPageShell } from '@/components/auth/AuthPageShell';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  return (
    <AuthPageShell>
      <AuthFlow mode="login" {...(next ? { nextPath: next } : {})} />
    </AuthPageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signInTitle') };
}
