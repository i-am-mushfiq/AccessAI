import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { toEligibilityProfile, profileCompleteness } from '@/modules/eligibility/profile-mapper';
import { ProfileForm } from '@/components/profile/ProfileForm';

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('profile');
  const profile = session.profile;
  const completeness = profileCompleteness(toEligibilityProfile({ user: session.user, profile }));

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary">{t('subtitle')}</p>
      </header>

      <ProfileForm
        initialCompleteness={completeness}
        user={{
          name: session.user.name,
          email: session.user.email,
          district: session.user.district,
        }}
        profile={
          profile
            ? {
                dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString() : null,
                statedAge: profile.statedAge,
                gender: profile.gender,
                occupation: profile.occupation,
                monthlyIncome: profile.monthlyIncome,
                maritalStatus: profile.maritalStatus,
                education: profile.education,
                cgpa: profile.cgpa,
                university: profile.university,
                department: profile.department,
                hasDisability: profile.hasDisability,
                disabilityType: profile.disabilityType,
                householdSize: profile.householdSize,
                dependents: profile.dependents,
                district: profile.district,
                landOwnershipDecimals: profile.landOwnershipDecimals,
                isStudent: profile.isStudent,
                hasBusiness: profile.hasBusiness,
                hasFarmingActivity: profile.hasFarmingActivity,
                farmSizeDecimals: profile.farmSizeDecimals,
                crops: profile.crops,
                livestock: profile.livestock,
                isPregnant: profile.isPregnant,
                medicalConditions: profile.medicalConditions,
                shareHealthData: profile.shareHealthData,
                hasNid: profile.hasNid,
                hasBankAccount: profile.hasBankAccount,
                isFreedomFighterFamily: profile.isFreedomFighterFamily,
              }
            : null
        }
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'profile' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
