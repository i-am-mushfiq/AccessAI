'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { ChipPicker } from '@/components/primitives/Textarea';
import { RadioGroup } from '@/components/primitives/Choice';
import { Select } from '@/components/primitives/Select';
import { TextField } from '@/components/primitives/TextField';
import { ProgressSteps } from '@/components/primitives/States';
import { DISTRICTS } from '@/lib/domain/geography';
import { OCCUPATIONS, type Occupation } from '@/lib/domain/enums';

const OCCUPATION_LABELS: Record<Occupation, { bn: string; en: string }> = {
  student: { bn: 'শিক্ষার্থী', en: 'Student' }, farmer: { bn: 'কৃষক', en: 'Farmer' },
  day_labourer: { bn: 'দিনমজুর', en: 'Day labourer' }, homemaker: { bn: 'গৃহিণী/গৃহস্থালির কাজ', en: 'Homemaker' },
  private_employee: { bn: 'বেসরকারি চাকরি', en: 'Private employee' }, government_employee: { bn: 'সরকারি চাকরি', en: 'Government employee' },
  self_employed: { bn: 'স্বনিয়োজিত', en: 'Self-employed' }, small_business: { bn: 'ছোট ব্যবসা', en: 'Small business' },
  fisherman: { bn: 'জেলে', en: 'Fisherman' }, weaver: { bn: 'তাঁতি', en: 'Weaver' }, rickshaw_driver: { bn: 'রিকশাচালক', en: 'Rickshaw driver' },
  garment_worker: { bn: 'পোশাক শ্রমিক', en: 'Garment worker' }, teacher: { bn: 'শিক্ষক', en: 'Teacher' }, unemployed: { bn: 'বেকার', en: 'Unemployed' },
  retired: { bn: 'অবসরপ্রাপ্ত', en: 'Retired' }, other: { bn: 'অন্যান্য', en: 'Other' },
};

const SITUATIONS = [
  ['seeking_employment', 'কাজ খুঁজছি', 'Looking for work'], ['higher_education', 'উচ্চশিক্ষা', 'Higher education'],
  ['serious_medical_need', 'গুরুতর চিকিৎসা দরকার', 'Serious medical need'], ['entrepreneurship', 'ব্যবসা শুরু করতে চাই', 'Starting a business'],
  ['crop_loss', 'ফসলের ক্ষতি হয়েছে', 'Crop loss'], ['child_education', 'সন্তানের পড়াশোনা', 'Child education'],
  ['old_age', 'বয়স্ক ব্যক্তির যত্ন', 'Older person in the household'],
] as const;

type Situation = (typeof SITUATIONS)[number][0];
type Step = 1 | 2 | 3;

export interface OnboardingInitialValues {
  readonly district?: string | null;
  readonly occupation?: Occupation | null;
  readonly monthlyIncome?: number | null;
  readonly householdSize?: number | null;
  readonly hasFarmingActivity?: boolean | null;
  readonly lifeEvents?: readonly string[];
}

export function OnboardingFlow({ initial }: { readonly initial: OnboardingInitialValues }) {
  const locale = useLocale() as 'bn' | 'en';
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [district, setDistrict] = useState(initial.district ?? undefined);
  const [occupation, setOccupation] = useState<Occupation | undefined>(initial.occupation ?? undefined);
  const [farming, setFarming] = useState<boolean | undefined>(initial.hasFarmingActivity ?? undefined);
  const [situations, setSituations] = useState<Situation[]>(
    (initial.lifeEvents ?? []).filter((value): value is Situation => SITUATIONS.some(([code]) => code === value)),
  );
  const [income, setIncome] = useState(initial.monthlyIncome == null ? '' : String(initial.monthlyIncome));
  const [householdSize, setHouseholdSize] = useState(initial.householdSize == null ? '' : String(initial.householdSize));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus(), [step]);

  const districtOptions = DISTRICTS.map((item) => ({ value: item.code, label: locale === 'bn' ? item.bn : item.en }));
  const occupationOptions = OCCUPATIONS.map((value) => ({ value, label: OCCUPATION_LABELS[value][locale] }));
  const situationOptions = SITUATIONS.map(([value, bn, en]) => ({ value, label: locale === 'bn' ? bn : en }));

  const submit = async () => {
    if (!district || !occupation) {
      setError(t('requiredBasics'));
      setStep(1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch('/users/profile', {
        district,
        occupation,
        hasFarmingActivity: farming ?? null,
        lifeEvents: situations,
        monthlyIncome: income.trim() ? Number(income) : null,
        householdSize: householdSize.trim() ? Number(householdSize) : null,
      });
      await api.post('/users/onboarding/complete');
      router.replace('/onboarding?results=1');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('completed'));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 1 && (!district || !occupation)) {
      setError(t('requiredBasics'));
      return;
    }
    setError(null);
    if (step < 3) setStep((value) => (value + 1) as Step);
    else void submit();
  };

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary measure">{t('subtitle')}</p>
      </header>
      <ProgressSteps current={step} total={3} label={t('progress', { step, total: 3 })} stepLabels={[t('stepLocation'), t('stepSituation'), t('stepDetails')]} />
      <Card padding="default" className="flex flex-col gap-6">
        <h2 ref={headingRef} tabIndex={-1} className="type-heading-md text-text-primary focus-visible:outline-none">
          {step === 1 ? t('stepLocation') : step === 2 ? t('stepSituation') : t('stepDetails')}
        </h2>
        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <Select label={t('district')} options={districtOptions} value={district} onChange={setDistrict} placeholder={tc('unknown')} name="district" />
            <Select label={t('occupation')} options={occupationOptions} value={occupation} onChange={setOccupation} placeholder={tc('unknown')} name="occupation" />
          </div>
        ) : null}
        {step === 2 ? (
          <div className="flex flex-col gap-6">
            <ChipPicker label={t('situation')} options={situationOptions} selected={situations} onChange={setSituations} optionalLabel={t('optionalHelp')} max={3} />
            <RadioGroup name="farming" legend={t('farmingQuestion')} options={[{ value: 'yes', label: tc('yes') }, { value: 'no', label: tc('no') }]} value={farming === true ? 'yes' : farming === false ? 'no' : undefined} onChange={(value) => setFarming(value === 'yes')} optionalLabel={t('optionalHelp')} helper={t('farmingHelper')} columns={2} />
          </div>
        ) : null}
        {step === 3 ? (
          <div className="flex flex-col gap-5">
            <TextField label={t('income')} optionalLabel={t('optionalHelp')} type="number" min={0} inputMode="numeric" value={income} onChange={(event) => setIncome(event.target.value)} normaliseDigits prefix="৳" />
            <TextField label={t('householdSize')} optionalLabel={t('optionalHelp')} type="number" min={1} max={40} inputMode="numeric" value={householdSize} onChange={(event) => setHouseholdSize(event.target.value)} normaliseDigits />
          </div>
        ) : null}
        {error ? <p role="alert" className="type-body-md text-text-error">{error}</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 1 ? <Button variant="secondary" fullWidth={false} onClick={() => setStep((value) => (value - 1) as Step)} disabled={busy}>{tc('back')}</Button> : <span />}
          <Button loading={busy} loadingLabel={t('saving')} onClick={next}>{step === 3 ? t('finish') : tc('next')}</Button>
        </div>
      </Card>
    </div>
  );
}
