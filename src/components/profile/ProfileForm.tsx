'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Check, Mic, Pencil, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card, Section } from '@/components/primitives/Card';
import { TextField } from '@/components/primitives/TextField';
import { Select } from '@/components/primitives/Select';
import { RadioGroup, SwitchRow, CheckboxRow } from '@/components/primitives/Choice';
import { ChipPicker, Textarea } from '@/components/primitives/Textarea';
import { DateOfBirthField, type DateOfBirthValue, EMPTY_DOB, toDate } from '@/components/primitives/DateOfBirthField';
import { Button } from '@/components/primitives/Button';
import { InfoPanel, Banner } from '@/components/primitives/Banner';
import { ConfidenceMeter } from '@/components/primitives/Chip';
import { useToast } from '@/components/providers/ToastProvider';
import { useVoice } from '@/components/providers/VoiceProvider';
import { DISTRICTS } from '@/lib/domain/geography';
import {
  GENDERS, MARITAL_STATUSES, EDUCATION_LEVELS, OCCUPATIONS, DISABILITY_TYPES,
} from '@/lib/domain/enums';
import {
  extractProfileCandidates,
  type ProfileExtractionField,
  type ProfileFieldCandidate,
  type ProfileExtractionValue,
} from '@/modules/profile/extraction';

/**
 * The dynamic profile form — PRD §Feature 17, §68, and §21.
 *
 * Design decisions taken from BDS §10.2:
 *  • Date of birth is three fields, not a calendar, with a live age echo.
 *  • Health data is behind an explicit consent switch, and turning the switch off
 *    ERASES the stored conditions rather than hiding them.
 *  • Every non-obvious field explains why it is asked, BEFORE it is asked.
 *  • Sections are collapsible so the form is never a wall — a citizen who only
 *    wants to fix their income does not scroll past twenty other questions.
 *  • The submit button is enabled at all times; nothing here is required, because
 *    a partial profile is genuinely useful to the eligibility engine.
 */

interface ProfileState {
  dob: DateOfBirthValue;
  gender: string | undefined;
  occupation: string | undefined;
  monthlyIncome: string;
  maritalStatus: string | undefined;
  education: string | undefined;
  cgpa: string;
  university: string;
  department: string;
  hasDisability: boolean | undefined;
  disabilityType: string | undefined;
  householdSize: string;
  dependents: string;
  district: string | undefined;
  landOwnershipDecimals: string;
  isStudent: boolean | undefined;
  hasBusiness: boolean | undefined;
  hasFarmingActivity: boolean | undefined;
  farmSizeDecimals: string;
  crops: string[];
  livestock: string[];
  isPregnant: boolean | undefined;
  medicalConditions: string[];
  shareHealthData: boolean;
  hasNid: boolean | undefined;
  hasBankAccount: boolean | undefined;
  isFreedomFighterFamily: boolean | undefined;
}

const CROP_OPTIONS = ['rice', 'jute', 'wheat', 'maize', 'potato', 'mustard', 'pulses', 'vegetables', 'sugarcane', 'tea'] as const;
const LIVESTOCK_OPTIONS = ['cattle', 'goat', 'poultry', 'duck', 'fish', 'sheep'] as const;
const CONDITION_OPTIONS = ['cancer', 'kidney_failure', 'liver_cirrhosis', 'stroke_paralysis', 'thalassaemia', 'congenital_heart'] as const;

type ReviewCandidate = ProfileFieldCandidate & { readonly editing: boolean };

const CROP_LABELS: Record<string, { bn: string; en: string }> = {
  rice: { bn: 'ধান', en: 'Rice' }, jute: { bn: 'পাট', en: 'Jute' }, wheat: { bn: 'গম', en: 'Wheat' },
  maize: { bn: 'ভুট্টা', en: 'Maize' }, potato: { bn: 'আলু', en: 'Potato' }, mustard: { bn: 'সরিষা', en: 'Mustard' },
  pulses: { bn: 'ডাল', en: 'Pulses' }, vegetables: { bn: 'সবজি', en: 'Vegetables' },
  sugarcane: { bn: 'আখ', en: 'Sugarcane' }, tea: { bn: 'চা', en: 'Tea' },
};

const LIVESTOCK_LABELS: Record<string, { bn: string; en: string }> = {
  cattle: { bn: 'গরু', en: 'Cattle' }, goat: { bn: 'ছাগল', en: 'Goat' },
  poultry: { bn: 'হাঁস-মুরগি', en: 'Poultry' }, duck: { bn: 'হাঁস', en: 'Duck' },
  fish: { bn: 'মাছ', en: 'Fish' }, sheep: { bn: 'ভেড়া', en: 'Sheep' },
};

/** Suggests the likely answer without replacing an explicit citizen answer. */
export function suggestFarmingActivity(
  occupation: string | undefined,
  current: boolean | undefined,
): boolean | undefined {
  return occupation === 'farmer' && current === undefined ? true : current;
}

const CONDITION_LABELS: Record<string, { bn: string; en: string }> = {
  cancer: { bn: 'ক্যান্সার', en: 'Cancer' },
  kidney_failure: { bn: 'কিডনি বিকল', en: 'Kidney failure' },
  liver_cirrhosis: { bn: 'লিভার সিরোসিস', en: 'Liver cirrhosis' },
  stroke_paralysis: { bn: 'স্ট্রোক / পক্ষাঘাত', en: 'Stroke or paralysis' },
  thalassaemia: { bn: 'থ্যালাসেমিয়া', en: 'Thalassaemia' },
  congenital_heart: { bn: 'জন্মগত হৃদরোগ', en: 'Congenital heart disease' },
};

const GENDER_LABELS: Record<string, { bn: string; en: string }> = {
  male: { bn: 'পুরুষ', en: 'Male' }, female: { bn: 'মহিলা', en: 'Female' },
  other: { bn: 'অন্য', en: 'Other' }, prefer_not_to_say: { bn: 'বলতে চাই না', en: 'Prefer not to say' },
};

const MARITAL_LABELS: Record<string, { bn: string; en: string }> = {
  single: { bn: 'অবিবাহিত', en: 'Single' }, married: { bn: 'বিবাহিত', en: 'Married' },
  widowed: { bn: 'বিধবা / বিধবা পুরুষ', en: 'Widowed' }, divorced: { bn: 'তালাকপ্রাপ্ত', en: 'Divorced' },
  separated: { bn: 'পৃথকভাবে বাস', en: 'Separated' },
};

const EDUCATION_LABELS: Record<string, { bn: string; en: string }> = {
  none: { bn: 'প্রাতিষ্ঠানিক শিক্ষা নেই', en: 'No formal schooling' },
  primary: { bn: 'প্রাথমিক (৫ম)', en: 'Primary (class 5)' },
  jsc: { bn: 'অষ্টম শ্রেণি', en: 'Class 8' },
  ssc: { bn: 'এসএসসি', en: 'SSC' }, hsc: { bn: 'এইচএসসি', en: 'HSC' },
  diploma: { bn: 'ডিপ্লোমা', en: 'Diploma' }, bachelor: { bn: 'স্নাতক', en: 'Bachelor' },
  master: { bn: 'স্নাতকোত্তর', en: 'Master' }, phd: { bn: 'পিএইচডি', en: 'PhD' },
};

const OCCUPATION_LABELS: Record<string, { bn: string; en: string }> = {
  student: { bn: 'শিক্ষার্থী', en: 'Student' }, farmer: { bn: 'কৃষক', en: 'Farmer' },
  day_labourer: { bn: 'দিনমজুর', en: 'Day labourer' }, homemaker: { bn: 'গৃহিণী', en: 'Homemaker' },
  private_employee: { bn: 'বেসরকারি চাকরি', en: 'Private employee' },
  government_employee: { bn: 'সরকারি চাকরি', en: 'Government employee' },
  self_employed: { bn: 'স্বনির্ভর', en: 'Self-employed' }, small_business: { bn: 'ছোট ব্যবসা', en: 'Small business' },
  fisherman: { bn: 'জেলে', en: 'Fisherman' }, weaver: { bn: 'তাঁতি', en: 'Weaver' },
  rickshaw_driver: { bn: 'রিকশাচালক', en: 'Rickshaw driver' },
  garment_worker: { bn: 'গার্মেন্টস কর্মী', en: 'Garment worker' },
  teacher: { bn: 'শিক্ষক', en: 'Teacher' }, unemployed: { bn: 'বেকার', en: 'Unemployed' },
  retired: { bn: 'অবসরপ্রাপ্ত', en: 'Retired' }, other: { bn: 'অন্য', en: 'Other' },
};

const DISABILITY_LABELS: Record<string, { bn: string; en: string }> = {
  none: { bn: 'নেই', en: 'None' }, visual: { bn: 'দৃষ্টি', en: 'Visual' },
  hearing: { bn: 'শ্রবণ', en: 'Hearing' }, speech: { bn: 'বাক', en: 'Speech' },
  physical: { bn: 'শারীরিক', en: 'Physical' }, intellectual: { bn: 'বুদ্ধিবৃত্তিক', en: 'Intellectual' },
  multiple: { bn: 'একাধিক', en: 'Multiple' }, other: { bn: 'অন্য', en: 'Other' },
};

/** Converts the server's canonical profile representation into form state. */
function profileToFormState(
  profile: Record<string, unknown> | null,
  userDistrict: string | null,
): ProfileState {
  const get = <T,>(key: string, fallback: T): T => ((profile?.[key] as T) ?? fallback);
  const str = (key: string) => {
    const value = profile?.[key];
    return value === null || value === undefined ? '' : String(value);
  };

  const rawDob = profile?.dateOfBirth as string | Date | null | undefined;
  const initialDob: DateOfBirthValue = (() => {
    if (!rawDob) return EMPTY_DOB;
    const date = new Date(rawDob);
    return Number.isNaN(date.getTime())
      ? EMPTY_DOB
      : { day: date.getDate(), month: date.getMonth(), year: date.getFullYear() };
  })();
  const initialGender = get<string | undefined>('gender', undefined);

  return {
    dob: initialDob,
    gender: initialGender,
    occupation: get<string | undefined>('occupation', undefined),
    monthlyIncome: str('monthlyIncome'),
    maritalStatus: get<string | undefined>('maritalStatus', undefined),
    education: get<string | undefined>('education', undefined),
    cgpa: str('cgpa'),
    university: str('university'),
    department: str('department'),
    hasDisability: get<boolean | undefined>('hasDisability', undefined),
    disabilityType: get<string | undefined>('disabilityType', undefined),
    householdSize: str('householdSize'),
    dependents: str('dependents'),
    district: get<string | undefined>('district', userDistrict ?? undefined),
    landOwnershipDecimals: str('landOwnershipDecimals'),
    isStudent: get<boolean | undefined>('isStudent', undefined),
    hasBusiness: get<boolean | undefined>('hasBusiness', undefined),
    // A farmer occupation suggests farming, but does not answer the separate
    // activity question on the citizen's behalf.
    hasFarmingActivity: get<boolean | undefined>('hasFarmingActivity', undefined),
    farmSizeDecimals: str('farmSizeDecimals'),
    crops: get<string[]>('crops', []) ?? [],
    livestock: get<string[]>('livestock', []) ?? [],
    // A male profile cannot retain a pregnancy value in local form state.
    isPregnant: initialGender === 'male' ? undefined : get<boolean | undefined>('isPregnant', undefined),
    medicalConditions: get<string[]>('medicalConditions', []) ?? [],
    shareHealthData: get<boolean>('shareHealthData', false),
    hasNid: get<boolean | undefined>('hasNid', undefined),
    hasBankAccount: get<boolean | undefined>('hasBankAccount', undefined),
    isFreedomFighterFamily: get<boolean | undefined>('isFreedomFighterFamily', undefined),
  };
}

export function ProfileForm({
  initialCompleteness,
  user,
  profile,
}: {
  readonly initialCompleteness: number;
  readonly user: { readonly name: string; readonly email: string | null; readonly district: string | null };
  readonly profile: Record<string, unknown> | null;
}) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();
  const router = useRouter();
  const { dictate, state: voiceState, canListen } = useVoice();
  const [state, setState] = useState<ProfileState>(() => profileToFormState(profile, user.district));

  const [dirty, setDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [completeness, setCompleteness] = useState(initialCompleteness);
  const [extractionText, setExtractionText] = useState('');
  const [reviewCandidates, setReviewCandidates] = useState<ReviewCandidate[]>([]);
  const [unresolvedParts, setUnresolvedParts] = useState<string[]>([]);

  const update = <K extends keyof ProfileState>(key: K, value: ProfileState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const extractionLabels: Record<ProfileExtractionField, string> = {
    gender: t('extractionGender'),
    district: t('extractionDistrict'),
    occupation: t('extractionOccupation'),
    monthlyIncome: t('extractionIncome'),
    maritalStatus: t('extractionMaritalStatus'),
    education: t('extractionEducation'),
    cgpa: t('extractionCgpa'),
    hasDisability: t('extractionDisability'),
    householdSize: t('extractionHousehold'),
    dependents: t('extractionDependents'),
    landOwnershipDecimals: t('extractionLand'),
    isStudent: t('extractionStudent'),
    hasBusiness: t('extractionBusiness'),
    hasFarmingActivity: t('extractionFarming'),
    isPregnant: t('extractionPregnancy'),
    medicalConditions: t('extractionHealth'),
  };

  const displayExtractionValue = (candidate: ProfileFieldCandidate): string => {
    if (candidate.field === 'district') {
      const district = DISTRICTS.find((item) => item.code === candidate.value);
      return district ? (locale === 'bn' ? district.bn : district.en) : String(candidate.value);
    }
    if (typeof candidate.value === 'boolean') return candidate.value ? tc('yes') : tc('no');
    if (Array.isArray(candidate.value)) return candidate.value.join(', ');
    return String(candidate.value);
  };

  const analyzeProfileText = (text: string) => {
    const result = extractProfileCandidates(text, { currentGender: state.gender });
    setExtractionText(result.transcript);
    setReviewCandidates(result.candidates.map((candidate) => ({ ...candidate, editing: false })));
    setUnresolvedParts([...result.unresolvedParts]);
  };

  const updateReviewValue = (field: ProfileExtractionField, value: ProfileExtractionValue) => {
    setReviewCandidates((current) => current.map((candidate) => (
      candidate.field === field ? { ...candidate, value } : candidate
    )));
  };

  const applyReviewedCandidate = (candidate: ReviewCandidate) => {
    setState((current) => {
      const next = { ...current };
      switch (candidate.field) {
        case 'gender':
          next.gender = String(candidate.value);
          if (next.gender === 'male') next.isPregnant = undefined;
          break;
        case 'district': next.district = String(candidate.value); break;
        case 'occupation': next.occupation = String(candidate.value); break;
        case 'monthlyIncome': next.monthlyIncome = String(candidate.value); break;
        case 'maritalStatus': next.maritalStatus = String(candidate.value); break;
        case 'education': next.education = String(candidate.value); break;
        case 'cgpa': next.cgpa = String(candidate.value); break;
        case 'hasDisability': next.hasDisability = Boolean(candidate.value); break;
        case 'householdSize': next.householdSize = String(candidate.value); break;
        case 'dependents': next.dependents = String(candidate.value); break;
        case 'landOwnershipDecimals': next.landOwnershipDecimals = String(candidate.value); break;
        case 'isStudent': next.isStudent = Boolean(candidate.value); break;
        case 'hasBusiness': next.hasBusiness = Boolean(candidate.value); break;
        case 'hasFarmingActivity':
          next.hasFarmingActivity = Boolean(candidate.value);
          if (!next.hasFarmingActivity) {
            next.farmSizeDecimals = '';
            next.crops = [];
            next.livestock = [];
          }
          break;
        case 'isPregnant':
          if (next.gender !== 'male') next.isPregnant = Boolean(candidate.value);
          break;
        case 'medicalConditions':
          next.medicalConditions = Array.from(candidate.value as readonly string[]);
          break;
      }
      return next;
    });
    setDirty(true);
    setReviewCandidates((current) => current.filter((item) => item.field !== candidate.field));
  };

  const removeReviewedCandidate = (field: ProfileExtractionField) => {
    setReviewCandidates((current) => current.filter((candidate) => candidate.field !== field));
  };

  const toggleReviewEditing = (field: ProfileExtractionField) => {
    setReviewCandidates((current) => current.map((candidate) => (
      candidate.field === field ? { ...candidate, editing: !candidate.editing } : candidate
    )));
  };

  const numberOrNull = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const save = useMutation({
    mutationFn: () => {
      const dobDate = toDate(state.dob);
      return api.patch<{
        completeness: number;
        /** The API returns the complete database-normalized profile. */
        profile: Record<string, unknown>;
      }>('/users/profile', {
        dateOfBirth: dobDate ? dobDate.toISOString() : null,
        gender: state.gender ?? null,
        occupation: state.occupation ?? null,
        monthlyIncome: numberOrNull(state.monthlyIncome),
        maritalStatus: state.maritalStatus ?? null,
        education: state.education ?? null,
        cgpa: numberOrNull(state.cgpa),
        university: state.university.trim() || null,
        department: state.department.trim() || null,
        hasDisability: state.hasDisability ?? null,
        disabilityType: state.disabilityType ?? null,
        householdSize: numberOrNull(state.householdSize),
        dependents: numberOrNull(state.dependents),
        district: state.district ?? null,
        landOwnershipDecimals: numberOrNull(state.landOwnershipDecimals),
        isStudent: state.isStudent ?? null,
        hasBusiness: state.hasBusiness ?? null,
        hasFarmingActivity: state.hasFarmingActivity ?? null,
        // An unanswered farming question is a real partial-profile state. Do
        // not erase legacy dependent data until the citizen explicitly says
        // No; the server clears it for the false branch.
        ...(state.hasFarmingActivity !== undefined
          ? {
              farmSizeDecimals: state.hasFarmingActivity ? numberOrNull(state.farmSizeDecimals) : null,
              crops: state.hasFarmingActivity ? state.crops : null,
              livestock: state.hasFarmingActivity ? state.livestock : null,
            }
          : {}),
        isPregnant: state.isPregnant ?? null,
        // Only sent when consent is on; the server also refuses it otherwise.
        medicalConditions: state.shareHealthData ? state.medicalConditions : null,
        shareHealthData: state.shareHealthData,
        hasNid: state.hasNid ?? null,
        hasBankAccount: state.hasBankAccount ?? null,
        isFreedomFighterFamily: state.isFreedomFighterFamily ?? null,
      });
    },
    onSuccess: (data) => {
      setDirty(false);
      setFieldErrors({});
      setCompleteness(data.completeness);
      // The PATCH response is authoritative. Rebuild every field from it so
      // server coercion, defaults, and conditional normalization cannot leave
      // stale local state behind while router.refresh preserves this client
      // component instance.
      setState(profileToFormState(data.profile, user.district));
      toast.show({ tone: 'success', message: t('profileUpdated') });
      // Profile and dashboard data are server-rendered in this app; there are
      // no React Query read caches for them to invalidate. Refresh the current
      // RSC tree so server consumers re-read the database before navigation.
      router.refresh();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fields) setFieldErrors(error.fields);
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
    },
  });

  const options = (values: readonly string[], labels: Record<string, { bn: string; en: string }>) =>
    values.map((value) => ({ value, label: labels[value] ? labels[value]![locale] : value }));

  const yesNo = [
    { value: 'yes', label: tc('yes') },
    { value: 'no', label: tc('no') },
  ];
  const boolToChoice = (value: boolean | undefined) => (value === undefined ? undefined : value ? 'yes' : 'no');

  const renderReviewEditor = (candidate: ReviewCandidate) => {
    if (!candidate.editing) {
      return <p className="type-body-lg text-text-primary">{displayExtractionValue(candidate)}</p>;
    }

    if (candidate.field === 'district') {
      return (
        <Select
          label={extractionLabels[candidate.field]}
          placeholder={tc('none')}
          value={String(candidate.value)}
          onChange={(value) => updateReviewValue(candidate.field, value)}
          options={DISTRICTS.map((district) => ({
            value: district.code,
            label: locale === 'bn' ? district.bn : district.en,
            keywords: [district.en, district.bn, district.code],
          }))}
          searchPlaceholder={tc('search')}
        />
      );
    }

    if (candidate.field === 'occupation') {
      return (
        <Select
          label={extractionLabels[candidate.field]}
          placeholder={tc('none')}
          value={String(candidate.value)}
          onChange={(value) => updateReviewValue(candidate.field, value)}
          options={options(OCCUPATIONS, OCCUPATION_LABELS)}
        />
      );
    }

    if (candidate.field === 'gender') {
      return (
        <Select
          label={extractionLabels[candidate.field]}
          placeholder={tc('none')}
          value={String(candidate.value)}
          onChange={(value) => updateReviewValue(candidate.field, value)}
          options={options(GENDERS, GENDER_LABELS)}
        />
      );
    }

    if (candidate.field === 'hasFarmingActivity' || candidate.field === 'isPregnant' || candidate.field === 'hasDisability' || candidate.field === 'isStudent' || candidate.field === 'hasBusiness') {
      return (
        <RadioGroup
          name={`review-${candidate.field}`}
          legend={extractionLabels[candidate.field]}
          value={boolToChoice(Boolean(candidate.value))}
          onChange={(value) => updateReviewValue(candidate.field, value === 'yes')}
          options={yesNo}
          columns={2}
        />
      );
    }

    const rawValue = Array.isArray(candidate.value) ? candidate.value.join(', ') : String(candidate.value);
    return (
      <TextField
        label={extractionLabels[candidate.field]}
        value={rawValue}
        inputMode={typeof candidate.value === 'number' ? 'decimal' : undefined}
        onChange={(event) => updateReviewValue(
          candidate.field,
          Array.isArray(candidate.value)
            ? event.target.value.split(',').map((item) => item.trim()).filter(Boolean)
            : typeof candidate.value === 'number'
              ? Number(event.target.value.replace(/[^d.]/g, ''))
              : event.target.value,
        )}
      />
    );
  };

  const listening = voiceState === 'listening' || voiceState === 'transcribing';

  return (
    <div className="flex flex-col gap-6">
      <Card padding="default">
        <ConfidenceMeter
          value={completeness}
          label={t('title')}
          bandLabel={completeness >= 80 ? tc('yes') : completeness >= 50 ? tc('all') : tc('none')}
        />
      </Card>

      {dirty ? (
        <Banner tone="warning" statusWord={tc('save')} live>
          {t('unsavedWarning')}
        </Banner>
      ) : null}

      {/* ---------------------------------------------- voice/text extraction */}
      <Card padding="default" className="flex flex-col gap-4">
        <div>
          <p className="type-heading-sm text-text-primary">{t('voiceProfileTitle')}</p>
          <p className="type-body-md mt-1 text-text-secondary">{t('voiceProfileBody')}</p>
        </div>
        <Button
          variant="secondary"
          fullWidth={false}
          leadingIcon={<Mic size={20} className="icon" aria-hidden="true" />}
          disabled={!canListen || listening}
          onClick={() => dictate((text) => analyzeProfileText(text))}
        >
          {listening ? t('voiceProfileListening') : t('voiceProfileButton')}
        </Button>
        {!canListen ? <p className="type-caption text-text-secondary">{t('voiceProfileUnavailable')}</p> : null}
        <Textarea
          label={t('profileTextLabel')}
          helper={t('profileTextHelper')}
          value={extractionText}
          onChange={(event) => setExtractionText(event.target.value)}
          rows={2}
        />
        <Button
          variant="tertiary"
          fullWidth={false}
          disabled={extractionText.trim().length === 0}
          onClick={() => analyzeProfileText(extractionText)}
        >
          {t('analyzeProfileText')}
        </Button>

        {reviewCandidates.length > 0 || unresolvedParts.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-stroke-subtle pt-4" aria-live="polite">
            <div>
              <p className="type-label-lg text-text-primary">{t('reviewTitle')}</p>
              <p className="type-body-md mt-1 text-text-secondary">{t('reviewBody')}</p>
            </div>
            {reviewCandidates.map((candidate) => (
              <div
                key={candidate.field}
                className="flex flex-col gap-3 rounded-md border border-stroke-subtle bg-surface-sunken p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="type-label-md text-text-secondary">{extractionLabels[candidate.field]}</p>
                    {candidate.sensitive ? <p className="type-caption mt-1 text-text-warning">{t('sensitiveReviewHint')}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 type-label-md text-text-brand focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                    onClick={() => toggleReviewEditing(candidate.field)}
                  >
                    <Pencil size={16} className="icon" aria-hidden="true" />
                    {t('editExtracted')}
                  </button>
                </div>
                {renderReviewEditor(candidate)}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="md"
                    leadingIcon={<Check size={18} className="icon" aria-hidden="true" />}
                    onClick={() => applyReviewedCandidate(candidate)}
                  >
                    {candidate.sensitive ? t('confirmSensitive') : t('acceptExtracted')}
                  </Button>
                  <Button
                    size="md"
                    variant="tertiary"
                    leadingIcon={<X size={18} className="icon" aria-hidden="true" />}
                    onClick={() => removeReviewedCandidate(candidate.field)}
                  >
                    {t('removeExtracted')}
                  </Button>
                </div>
              </div>
            ))}
            {unresolvedParts.length > 0 ? (
              <Banner tone="warning" statusWord={t('unresolvedLabel')}>
                <span>{unresolvedParts.join(' · ')}</span>
              </Banner>
            ) : null}
            <Button
              variant="tertiary"
              fullWidth={false}
              onClick={() => {
                setReviewCandidates([]);
                setUnresolvedParts([]);
              }}
            >
              {t('cancelReview')}
            </Button>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------------------------------ personal */}
      <Section title={t('sectionPersonal')}>
        <Card padding="default" className="flex flex-col gap-5">
          <DateOfBirthField
            label={t('dobLabel')}
            optionalLabel={tc('optional')}
            value={state.dob}
            onChange={(dob) => update('dob', dob)}
            dayLabel={t('dobDay')}
            monthLabel={t('dobMonth')}
            yearLabel={t('dobYear')}
            ageConfirmationLabel={(age) => t('ageConfirm', { age })}
            {...(fieldErrors.dateOfBirth ? { error: fieldErrors.dateOfBirth } : {})}
          />

          <RadioGroup
            name="gender"
            legend={t('genderLabel')}
            optionalLabel={tc('optional')}
            value={state.gender}
            onChange={(value) => {
              update('gender', value);
              if (value === 'male') update('isPregnant', undefined);
            }}
            options={options(GENDERS, GENDER_LABELS)}
          />

          <Select
            label={t('maritalLabel')}
            optionalLabel={tc('optional')}
            placeholder={tc('none')}
            value={state.maritalStatus}
            onChange={(value) => update('maritalStatus', value)}
            options={options(MARITAL_STATUSES, MARITAL_LABELS)}
          />
        </Card>
      </Section>

      {/* ------------------------------------------------------ location */}
      <Section title={t('sectionLocation')}>
        <Card padding="default">
          <Select
            label={locale === 'bn' ? 'আপনার জেলা' : 'Your district'}
            optionalLabel={tc('optional')}
            placeholder={tc('search')}
            value={state.district}
            onChange={(value) => update('district', value)}
            searchPlaceholder={tc('search')}
            popularHeading={locale === 'bn' ? 'বড় শহর' : 'Major cities'}
            allHeading={locale === 'bn' ? 'সব জেলা' : 'All districts'}
            options={DISTRICTS.map((d) => ({
              value: d.code,
              label: locale === 'bn' ? d.bn : d.en,
              keywords: [d.en, d.bn, d.code],
              popular: ['dhaka', 'chattogram', 'khulna', 'rajshahi', 'sylhet', 'rangpur', 'barishal', 'mymensingh'].includes(d.code),
            }))}
          />
        </Card>
      </Section>

      {/* --------------------------------------------------- work & income */}
      <Section title={t('sectionWork')}>
        <Card padding="default" className="flex flex-col gap-5">
          <Select
            label={t('occupationLabel')}
            optionalLabel={tc('optional')}
            placeholder={tc('none')}
            value={state.occupation}
            onChange={(value) => {
              update('occupation', value);
              if (suggestFarmingActivity(value, state.hasFarmingActivity) !== state.hasFarmingActivity) {
                // Suggest, but do not force, the answer. The citizen can still
                // select “No” immediately afterwards.
                update('hasFarmingActivity', suggestFarmingActivity(value, state.hasFarmingActivity));
              }
            }}
            options={options(OCCUPATIONS, OCCUPATION_LABELS)}
          />

          <TextField
            label={t('incomeLabel')}
            optionalLabel={tc('optional')}
            inputMode="numeric"
            normaliseDigits
            prefix="৳"
            value={state.monthlyIncome}
            onChange={(e) => update('monthlyIncome', e.target.value.replace(/[^\d.]/g, ''))}
            helper={t('incomeHelp')}
            reason={
              locale === 'bn'
                ? 'অনেক ভাতা আয়সীমার উপর নির্ভর করে, তাই এটি জানা থাকলে সঠিক সিদ্ধান্ত দিতে পারি।'
                : 'Many allowances depend on an income ceiling, so knowing this lets us decide accurately.'
            }
            {...(fieldErrors.monthlyIncome ? { error: fieldErrors.monthlyIncome } : {})}
          />

          <RadioGroup
            name="isStudent"
            legend={t('studentLabel')}
            optionalLabel={tc('optional')}
            columns={2}
            value={boolToChoice(state.isStudent)}
            onChange={(value) => update('isStudent', value === 'yes')}
            options={yesNo}
          />

          <RadioGroup
            name="hasBusiness"
            legend={t('businessLabel')}
            optionalLabel={tc('optional')}
            columns={2}
            value={boolToChoice(state.hasBusiness)}
            onChange={(value) => update('hasBusiness', value === 'yes')}
            options={yesNo}
          />
        </Card>
      </Section>

      {/* ----------------------------------------------------- education */}
      <Section title={t('sectionEducation')}>
        <Card padding="default" className="flex flex-col gap-5">
          <Select
            label={t('educationLabel')}
            optionalLabel={tc('optional')}
            placeholder={tc('none')}
            value={state.education}
            onChange={(value) => update('education', value)}
            options={options(EDUCATION_LEVELS, EDUCATION_LABELS)}
          />

          <TextField
            label={t('cgpaLabel')}
            optionalLabel={tc('optional')}
            inputMode="decimal"
            normaliseDigits
            value={state.cgpa}
            onChange={(e) => update('cgpa', e.target.value.replace(/[^\d.]/g, ''))}
            reason={
              locale === 'bn'
                ? 'বৃত্তির যোগ্যতা সিজিপিএ দেখে ঠিক হয়।'
                : 'Scholarship eligibility is decided on CGPA.'
            }
            {...(fieldErrors.cgpa ? { error: fieldErrors.cgpa } : {})}
          />

          <TextField
            label={t('universityLabel')}
            optionalLabel={tc('optional')}
            value={state.university}
            onChange={(e) => update('university', e.target.value)}
            maxLength={160}
          />

          <TextField
            label={t('departmentLabel')}
            optionalLabel={tc('optional')}
            value={state.department}
            onChange={(e) => update('department', e.target.value)}
            maxLength={160}
          />
        </Card>
      </Section>

      {/* -------------------------------------------------------- family */}
      <Section title={t('sectionFamily')}>
        <Card padding="default" className="flex flex-col gap-5">
          <TextField
            label={t('householdLabel')}
            optionalLabel={tc('optional')}
            inputMode="numeric"
            normaliseDigits
            value={state.householdSize}
            onChange={(e) => update('householdSize', e.target.value.replace(/\D/g, ''))}
            {...(fieldErrors.householdSize ? { error: fieldErrors.householdSize } : {})}
          />
          <TextField
            label={t('dependentsLabel')}
            optionalLabel={tc('optional')}
            inputMode="numeric"
            normaliseDigits
            value={state.dependents}
            onChange={(e) => update('dependents', e.target.value.replace(/\D/g, ''))}
          />
          {state.gender !== 'male' ? (
            <RadioGroup
              name="isPregnant"
              legend={t('pregnantLabel')}
              optionalLabel={tc('optional')}
              columns={2}
              value={boolToChoice(state.isPregnant)}
              onChange={(value) => update('isPregnant', value === 'yes')}
              options={yesNo}
            />
          ) : null}
        </Card>
      </Section>

      {/* ------------------------------------------------- land & farming */}
      <Section title={t('sectionLand')}>
        <Card padding="default" className="flex flex-col gap-5">
          <TextField
            label={t('landLabel')}
            optionalLabel={tc('optional')}
            inputMode="decimal"
            normaliseDigits
            value={state.landOwnershipDecimals}
            onChange={(e) => update('landOwnershipDecimals', e.target.value.replace(/[^\d.]/g, ''))}
            reason={
              locale === 'bn'
                ? 'অনেক কর্মসূচিতে ভূমিহীন বা অল্প জমির মালিকরা অগ্রাধিকার পান।'
                : 'Many programmes prioritise landless households or those with little land.'
            }
          />
          <RadioGroup
            name="hasFarmingActivity"
            legend={t('farmingLabel')}
            optionalLabel={tc('optional')}
            helper={state.occupation === 'farmer' && state.hasFarmingActivity === undefined
              ? t('farmingFarmerHint')
              : undefined}
            columns={2}
            value={boolToChoice(state.hasFarmingActivity)}
            onChange={(value) => {
              const connected = value === 'yes';
              update('hasFarmingActivity', connected);
              if (!connected) {
                update('farmSizeDecimals', '');
                update('crops', []);
                update('livestock', []);
              }
            }}
            options={yesNo}
          />
          {state.hasFarmingActivity ? (
            <>
              <TextField
                label={locale === 'bn' ? 'খামারের আয়তন (শতাংশ)' : 'Farm size (decimals)'}
                optionalLabel={tc('optional')}
                inputMode="decimal"
                normaliseDigits
                value={state.farmSizeDecimals}
                onChange={(e) => update('farmSizeDecimals', e.target.value.replace(/[^\d.]/g, ''))}
              />
              <ChipPicker
                label={t('cropsLabel')}
                optionalLabel={tc('optional')}
                options={CROP_OPTIONS.map((crop) => ({ value: crop, label: CROP_LABELS[crop]![locale] }))}
                selected={state.crops}
                onChange={(crops) => update('crops', crops)}
              />
              <ChipPicker
                label={t('livestockLabel')}
                optionalLabel={tc('optional')}
                options={LIVESTOCK_OPTIONS.map((animal) => ({ value: animal, label: LIVESTOCK_LABELS[animal]![locale] }))}
                selected={state.livestock}
                onChange={(livestock) => update('livestock', livestock)}
              />
            </>
          ) : null}
        </Card>
      </Section>

      {/* ------------------------------------------------------- health */}
      <Section title={t('sectionHealth')}>
        <Card padding="default" className="flex flex-col gap-5">
          {/* Consent is explained BEFORE the switch (BDS §80). */}
          <InfoPanel title={t('healthConsentTitle')}>{t('healthConsentBody')}</InfoPanel>

          <SwitchRow
            checked={state.shareHealthData}
            onChange={(value) => {
              update('shareHealthData', value);
              // Withdrawing consent clears the data locally too, so the UI never
              // shows data the server is about to delete.
              if (!value) update('medicalConditions', []);
            }}
            label={t('healthConsentTitle')}
            onText={tc('on')}
            offText={tc('off')}
          />

          <RadioGroup
            name="hasDisability"
            legend={t('disabilityLabel')}
            optionalLabel={tc('optional')}
            columns={2}
            value={boolToChoice(state.hasDisability)}
            onChange={(value) => update('hasDisability', value === 'yes')}
            options={yesNo}
          />

          {state.hasDisability ? (
            <Select
              label={t('disabilityTypeLabel')}
              optionalLabel={tc('optional')}
              placeholder={tc('none')}
              value={state.disabilityType}
              onChange={(value) => update('disabilityType', value)}
              options={options(DISABILITY_TYPES, DISABILITY_LABELS)}
            />
          ) : null}

          {state.shareHealthData ? (
            <ChipPicker
              label={t('conditionsLabel')}
              optionalLabel={tc('optional')}
              options={CONDITION_OPTIONS.map((c) => ({ value: c, label: CONDITION_LABELS[c]![locale] }))}
              selected={state.medicalConditions}
              onChange={(conditions) => update('medicalConditions', conditions)}
              helper={
                locale === 'bn'
                  ? 'এই তথ্য দিলে ক্যান্সার, কিডনি ও অন্যান্য রোগের চিকিৎসা সহায়তা খুঁজে দিতে পারব।'
                  : 'Sharing this lets us find treatment support for cancer, kidney disease, and others.'
              }
            />
          ) : null}
        </Card>
      </Section>

      {/* ----------------------------------------------------- documents */}
      <Section title={t('sectionDocuments')}>
        <Card padding="default" className="flex flex-col gap-3">
          <CheckboxRow
            checked={state.hasNid === true}
            onChange={(checked) => update('hasNid', checked)}
            label={t('nidLabel')}
            description={
              locale === 'bn'
                ? 'প্রায় সব সরকারি কর্মসূচিতে এটি লাগে।'
                : 'Almost every government programme needs this.'
            }
          />
          <CheckboxRow
            checked={state.hasBankAccount === true}
            onChange={(checked) => update('hasBankAccount', checked)}
            label={t('bankLabel')}
            description={
              locale === 'bn'
                ? 'ভাতা সরাসরি নিজের হিসাবেই পাঠানো হয়।'
                : 'Allowances are paid into the beneficiary\'s own account.'
            }
          />
          <CheckboxRow
            checked={state.isFreedomFighterFamily === true}
            onChange={(checked) => update('isFreedomFighterFamily', checked)}
            label={t('freedomFighterLabel')}
          />
        </Card>
      </Section>

      {/* --------------------------------------------------------- submit */}
      <div className="sticky bottom-0 -mx-4 border-t border-stroke-subtle bg-surface px-4 py-4 pb-safe md:-mx-5 md:px-5">
        <Button
          size="xl"
          loading={save.isPending}
          loadingLabel={tc('loading')}
          onClick={() => save.mutate()}
        >
          {tc('save')}
        </Button>
        <p className="type-caption mt-2 text-center text-text-tertiary">{t('subtitle')}</p>
      </div>
    </div>
  );
}
