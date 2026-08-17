import type { UserProfile, User } from '@/lib/db/schema';
import type { EligibilityProfile } from './engine';
import type { RuleField } from '@/lib/domain/rules';
import { getDistrict } from '@/lib/domain/geography';
import type { EducationLevel } from '@/lib/domain/enums';

/**
 * Translates the stored profile into the engine's flat view.
 *
 * The single most important behaviour here is that `undefined` is preserved.
 * A `?? 0` or `?? false` anywhere in this file would convert "we never asked"
 * into "the answer is no" and cause wrong denials — the exact failure PRD §22
 * exists to prevent.
 */

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

export function computeAge(dateOfBirth: Date | null, statedAge: number | null, now: Date): number | undefined {
  if (dateOfBirth) {
    const age = Math.floor((now.getTime() - dateOfBirth.getTime()) / MS_PER_YEAR);
    return age >= 0 && age < 130 ? age : undefined;
  }
  if (statedAge !== null && statedAge >= 0 && statedAge < 130) return statedAge;
  return undefined;
}

export interface MapProfileInput {
  readonly user?: Pick<User, 'district'> | null;
  readonly profile?: UserProfile | null;
  readonly now?: Date;
  /**
   * Values supplied for a single what-if evaluation (the "check eligibility
   * without saving" path) layered on top of the stored profile.
   */
  readonly overrides?: Partial<EligibilityProfile>;
}

export function toEligibilityProfile(input: MapProfileInput): EligibilityProfile {
  const { profile, user, overrides } = input;
  const now = input.now ?? new Date();

  const base: EligibilityProfile = {};
  if (!profile) {
    // Even with no profile row, a district on the user record is usable.
    if (user?.district) {
      base.district = user.district;
      base.division = getDistrict(user.district)?.division;
    }
    return { ...base, ...stripUndefined(overrides) };
  }

  const age = computeAge(profile.dateOfBirth, profile.statedAge, now);
  if (age !== undefined) base.age = age;

  assign(base, 'gender', profile.gender);
  assign(base, 'occupation', profile.occupation);
  assign(base, 'maritalStatus', profile.maritalStatus);
  assign(base, 'education', profile.education as EducationLevel | null);
  assign(base, 'cgpa', profile.cgpa);
  assign(base, 'university', profile.university);
  assign(base, 'department', profile.department);
  assign(base, 'hasDisability', profile.hasDisability);
  assign(base, 'disabilityType', profile.disabilityType);
  assign(base, 'householdSize', profile.householdSize);
  assign(base, 'dependents', profile.dependents);
  assign(base, 'landOwnershipDecimals', profile.landOwnershipDecimals);
  assign(base, 'isStudent', profile.isStudent);
  assign(base, 'hasBusiness', profile.hasBusiness);
  assign(base, 'hasFarmingActivity', profile.hasFarmingActivity);
  assign(base, 'businessType', profile.businessType);
  assign(base, 'employees', profile.employees);
  assign(base, 'farmSizeDecimals', profile.farmSizeDecimals);
  assign(base, 'crops', profile.crops);
  assign(base, 'livestock', profile.livestock);
  assign(base, 'isPregnant', profile.isPregnant);
  assign(base, 'citizenship', profile.citizenship);
  assign(base, 'preferredCountry', profile.preferredCountry);
  assign(base, 'ieltsScore', profile.ieltsScore);
  assign(base, 'hasNid', profile.hasNid);
  assign(base, 'hasBankAccount', profile.hasBankAccount);
  assign(base, 'isFreedomFighterFamily', profile.isFreedomFighterFamily);

  // Health data is only visible to the engine when the citizen has opted in
  // (PRD §68 "Health (optional and user-controlled)"). Without consent the
  // field stays unknown, so a health-gated programme reports "we need to know"
  // rather than silently excluding them.
  if (profile.shareHealthData) {
    assign(base, 'medicalConditions', profile.medicalConditions);
  }

  const district = profile.district ?? user?.district ?? null;
  if (district) {
    base.district = district;
    base.division = profile.division ?? getDistrict(district)?.division;
  } else if (profile.division) {
    base.division = profile.division;
  }

  if (profile.monthlyIncome !== null && profile.monthlyIncome !== undefined) {
    base.monthlyIncome = profile.monthlyIncome;
    // Derived so rules can be authored against whichever period the source
    // circular uses, without the citizen being asked twice.
    base.annualIncome = profile.monthlyIncome * 12;
  }

  if (profile.lifeEvents && profile.lifeEvents.length > 0) {
    base.lifeEvents = profile.lifeEvents.map((e) => e.event);
  }

  return { ...base, ...stripUndefined(overrides) };
}

function assign<K extends keyof EligibilityProfile>(
  target: EligibilityProfile,
  key: K,
  value: EligibilityProfile[K] | null | undefined,
): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' && value.trim() === '') return;
  target[key] = value;
}

function stripUndefined(source: Partial<EligibilityProfile> | undefined): Partial<EligibilityProfile> {
  if (!source) return {};
  const out: Partial<EligibilityProfile> = {};
  for (const [k, v] of Object.entries(source)) {
    if (v !== undefined && v !== null) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/**
 * Profile completeness for the dashboard meter. Weighted so that the fields
 * used by the most rules count for most — a citizen who fills only the "easy"
 * optional fields should not see 90%.
 */
const COMPLETENESS_WEIGHTS: Partial<Record<RuleField, number>> = {
  age: 10,
  gender: 8,
  district: 10,
  monthlyIncome: 10,
  occupation: 8,
  education: 6,
  maritalStatus: 6,
  hasDisability: 5,
  householdSize: 4,
  dependents: 3,
  landOwnershipDecimals: 3,
  isStudent: 4,
  hasNid: 5,
  citizenship: 3,
  cgpa: 3,
  university: 2,
  hasBusiness: 3,
  hasFarmingActivity: 3,
  farmSizeDecimals: 2,
  hasBankAccount: 2,
  lifeEvents: 3,
};

export function profileCompleteness(profile: EligibilityProfile): number {
  let total = 0;
  let earned = 0;
  for (const [field, weight] of Object.entries(COMPLETENESS_WEIGHTS) as [RuleField, number][]) {
    total += weight;
    const value = (profile as Record<string, unknown>)[field];
    const present =
      value !== undefined &&
      value !== null &&
      !(typeof value === 'string' && value.trim() === '') &&
      !(Array.isArray(value) && value.length === 0);
    if (present) earned += weight;
  }
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}

/** Fields worth asking about next, most valuable first. */
export function suggestNextFields(profile: EligibilityProfile, limit = 3): RuleField[] {
  return (Object.entries(COMPLETENESS_WEIGHTS) as [RuleField, number][])
    .filter(([field]) => {
      const v = (profile as Record<string, unknown>)[field];
      return v === undefined || v === null || (Array.isArray(v) && v.length === 0);
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([field]) => field);
}
