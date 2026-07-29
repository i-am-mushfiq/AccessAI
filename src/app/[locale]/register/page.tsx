import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthFlow } from '@/components/auth/AuthFlow';
import { AuthPageShell } from '@/components/auth/AuthPageShell';

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AuthPageShell>
      <AuthFlow mode="register" />
    </AuthPageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signUpTitle') };
}
