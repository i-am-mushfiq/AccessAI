import { extractEntities } from '@/modules/ai/nlu';
import type { EligibilityProfile } from '@/modules/eligibility/engine';

/** Fields that ProfileForm can safely receive from a reviewed transcript. */
export type ProfileExtractionField = keyof Pick<
  EligibilityProfile,
  | 'gender'
  | 'district'
  | 'occupation'
  | 'monthlyIncome'
  | 'maritalStatus'
  | 'education'
  | 'cgpa'
  | 'hasDisability'
  | 'householdSize'
  | 'dependents'
  | 'landOwnershipDecimals'
  | 'isStudent'
  | 'hasBusiness'
  | 'hasFarmingActivity'
  | 'isPregnant'
  | 'medicalConditions'
>;

export type ProfileExtractionValue = string | number | boolean | readonly string[];

export interface ProfileFieldCandidate {
  readonly field: ProfileExtractionField;
  readonly value: ProfileExtractionValue;
  readonly sensitive: boolean;
}

export interface ProfileExtractionResult {
  readonly transcript: string;
  readonly proposedUpdates: Partial<Record<ProfileExtractionField, ProfileExtractionValue>>;
  readonly candidates: readonly ProfileFieldCandidate[];
  readonly recognizedFields: readonly ProfileExtractionField[];
  readonly unresolvedParts: readonly string[];
}

const SUPPORTED_FIELDS: readonly ProfileExtractionField[] = [
  'gender', 'district', 'occupation', 'monthlyIncome', 'maritalStatus',
  'education', 'cgpa', 'hasDisability', 'householdSize', 'dependents',
  'landOwnershipDecimals', 'isStudent', 'hasBusiness', 'hasFarmingActivity',
  'isPregnant', 'medicalConditions',
];

const SENSITIVE_FIELDS = new Set<ProfileExtractionField>([
  'isPregnant', 'medicalConditions', 'hasDisability',
]);

const EXPLICIT_FEMALE = /মহিলা|নারী|মেয়ে|female|woman|বিধবা|widow/i;

/**
 * Converts the existing deterministic NLU result into a reviewable profile
 * patch. This function never writes to the database. A candidate is only
 * allowed into ProfileForm after the citizen explicitly accepts it.
 */
export function extractProfileCandidates(
  transcript: string,
  context: { readonly currentGender?: string | null } = {},
): ProfileExtractionResult {
  const cleanTranscript = transcript.trim();
  const nlu = extractEntities(cleanTranscript);
  const proposedUpdates: Partial<Record<ProfileExtractionField, ProfileExtractionValue>> = {};
  const unresolvedParts: string[] = [];

  for (const field of SUPPORTED_FIELDS) {
    const value = nlu.profile[field];
    if (value !== undefined && value !== null) {
      proposedUpdates[field] = value as ProfileExtractionValue;
    }
  }

  const effectiveGender = proposedUpdates.gender ?? context.currentGender ?? undefined;

  // Pregnancy is never compatible with an explicit/current male profile. Keep
  // the transcript visible as unresolved instead of turning a contradiction
  // into a silent profile update.
  if (proposedUpdates.isPregnant !== undefined && effectiveGender === 'male') {
    delete proposedUpdates.isPregnant;
    unresolvedParts.push('pregnancy statement conflicts with a male profile');
  }

  // The existing NLU marks pregnancy as female when no gender was stated. That
  // is useful for conversation routing, but too strong for profile editing: do
  // not propose an inferred gender unless the speaker actually said it.
  if (proposedUpdates.isPregnant !== undefined && proposedUpdates.gender === 'female' && !EXPLICIT_FEMALE.test(cleanTranscript)) {
    delete proposedUpdates.gender;
  }

  const candidates = Object.entries(proposedUpdates).map(([field, value]) => ({
    field: field as ProfileExtractionField,
    value: value as ProfileExtractionValue,
    sensitive: SENSITIVE_FIELDS.has(field as ProfileExtractionField),
  }));

  const recognizedFields = candidates.map((candidate) => candidate.field);
  if (cleanTranscript && candidates.length === 0 && unresolvedParts.length === 0) {
    unresolvedParts.push(cleanTranscript);
  }

  return {
    transcript: cleanTranscript,
    proposedUpdates,
    candidates,
    recognizedFields,
    unresolvedParts,
  };
}
