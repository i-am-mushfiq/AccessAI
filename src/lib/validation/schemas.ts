import { z } from 'zod';
import {
  OPPORTUNITY_CATEGORIES, ELIGIBILITY_OUTCOMES, SAVED_STATUSES, TASK_STATUSES,
  GENDERS, MARITAL_STATUSES, EDUCATION_LEVELS, OCCUPATIONS, DISABILITY_TYPES,
  THEMES, NUMERAL_SYSTEMS, FEEDBACK_KINDS, LIFE_EVENTS, VERIFICATION_STATUSES,
  OPPORTUNITY_STATUSES, ORGANIZATION_TYPES, USER_ROLES, ISSUE_CATEGORIES, ISSUE_STATUSES,
  CIVIC_ROLES, ENTITLEMENT_PERIODS, DISBURSEMENT_STATUSES,
} from '@/lib/domain/enums';
import { DISTRICT_CODES, DIVISIONS } from '@/lib/domain/geography';
import { normalisePhone } from '@/lib/format/numerals';
import { ruleSetSchema } from '@/lib/domain/rules';

/**
 * Request validation — PRD §48 ("Validate all API inputs") and §51.
 *
 * Error messages are written for a citizen, not a developer: they say what to
 * do rather than what was wrong (BDS §10.2.2 error formula), because these
 * strings are rendered directly under the field that failed.
 */

/** Accepts every real-world phone shape and normalises before validating. */
export const phoneSchema = z
  .string()
  .min(1, 'Enter your mobile number.')
  .transform((value, ctx) => {
    const normalised = normalisePhone(value);
    if (!normalised) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter an 11-digit number starting with 01. For example: 01712345678',
      });
      return z.NEVER;
    }
    return normalised;
  });

export const pinSchema = z
  .string()
  .regex(/^\d{4,6}$/, 'Your PIN must be 4 to 6 digits.');

export const otpSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 6, 'Enter the 6-digit code from the SMS.');

export const localeSchema = z.enum(['bn', 'en']);

/* ------------------------------------------------------------------ auth */

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['register', 'login', 'reset_pin', 'verify_phone']),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpSchema,
  purpose: z.enum(['register', 'login', 'reset_pin', 'verify_phone']),
});

export const registerSchema = z.object({
  phone: phoneSchema,
  code: otpSchema,
  name: z
    .string()
    .trim()
    .min(2, 'Enter your name as it appears on your National ID.')
    .max(120, 'That name is too long.'),
  pin: pinSchema,
  language: localeSchema.default('bn'),
  district: z.enum(DISTRICT_CODES as [string, ...string[]]).nullish(),
  email: z.string().email('That email address does not look right.').nullish(),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
});

export const loginOtpSchema = z.object({
  phone: phoneSchema,
  code: otpSchema,
});

export const setPinSchema = z.object({
  phone: phoneSchema,
  code: otpSchema,
  pin: pinSchema,
});

/* --------------------------------------------------------------- profile */

const optionalNumber = (min: number, max: number, message: string) =>
  z.coerce.number().min(min, message).max(max, message).nullish();

export const updateProfileSchema = z.object({
  dateOfBirth: z.coerce.date().nullish(),
  statedAge: optionalNumber(1, 120, 'Enter an age between 1 and 120.'),
  gender: z.enum(GENDERS).nullish(),
  occupation: z.enum(OCCUPATIONS).nullish(),
  monthlyIncome: optionalNumber(0, 10_000_000, 'Enter a monthly income in taka.'),
  maritalStatus: z.enum(MARITAL_STATUSES).nullish(),
  education: z.enum(EDUCATION_LEVELS).nullish(),
  cgpa: optionalNumber(0, 5, 'Enter a CGPA between 0 and 5.'),
  university: z.string().trim().max(160).nullish(),
  department: z.string().trim().max(160).nullish(),
  hasDisability: z.boolean().nullish(),
  disabilityType: z.enum(DISABILITY_TYPES).nullish(),
  householdSize: optionalNumber(1, 40, 'Enter how many people live in your household.'),
  dependents: optionalNumber(0, 40, 'Enter how many people depend on you.'),
  division: z.enum(DIVISIONS).nullish(),
  district: z.enum(DISTRICT_CODES as [string, ...string[]]).nullish(),
  upazila: z.string().trim().max(120).nullish(),
  landOwnershipDecimals: optionalNumber(0, 100_000, 'Enter your land in decimals.'),
  isStudent: z.boolean().nullish(),
  hasBusiness: z.boolean().nullish(),
  businessType: z.string().trim().max(120).nullish(),
  employees: optionalNumber(0, 100_000, 'Enter the number of employees.'),
  farmSizeDecimals: optionalNumber(0, 100_000, 'Enter your farm size in decimals.'),
  crops: z.array(z.string().trim().max(60)).max(30).nullish(),
  livestock: z.array(z.string().trim().max(60)).max(30).nullish(),
  isPregnant: z.boolean().nullish(),
  medicalConditions: z.array(z.string().trim().max(80)).max(20).nullish(),
  shareHealthData: z.boolean().optional(),
  preferredCountry: z.string().trim().max(80).nullish(),
  ieltsScore: optionalNumber(0, 9, 'Enter an IELTS score between 0 and 9.'),
  hasNid: z.boolean().nullish(),
  hasBankAccount: z.boolean().nullish(),
  isFreedomFighterFamily: z.boolean().nullish(),
  interests: z.array(z.string().trim().max(60)).max(30).nullish(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(120).optional(),
  email: z.string().email('That email address does not look right.').nullish(),
  language: localeSchema.optional(),
  district: z.enum(DISTRICT_CODES as [string, ...string[]]).nullish(),
});

export const updateSettingsSchema = z.object({
  theme: z.enum(THEMES).optional(),
  textScale: z.coerce.number().refine((v) => [1, 1.15, 1.3, 1.5].includes(v), 'Unsupported text size.').optional(),
  numeralSystem: z.enum(NUMERAL_SYSTEMS).optional(),
  reduceMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyDeadlines: z.boolean().optional(),
  notifyNewOpportunities: z.boolean().optional(),
  notifyProgramUpdates: z.boolean().optional(),
  profileVisibility: z.enum(['private', 'anonymised_analytics']).optional(),
});

/* ------------------------------------------------------------------ chat */

export const chatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Type your question, or press the microphone to speak.')
    .max(2000, 'That message is too long. Try saying it more briefly.'),
  conversationId: z.string().uuid().nullish(),
  locale: localeSchema.optional(),
});

/* --------------------------------------------------------- opportunities */

export const listOpportunitiesSchema = z.object({
  category: z.union([z.enum(OPPORTUNITY_CATEGORIES), z.array(z.enum(OPPORTUNITY_CATEGORIES))]).optional(),
  outcome: z.union([z.enum(ELIGIBILITY_OUTCOMES), z.array(z.enum(ELIGIBILITY_OUTCOMES))]).optional(),
  lifeEvent: z.union([z.enum(LIFE_EVENTS), z.array(z.enum(LIFE_EVENTS))]).optional(),
  district: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['relevance', 'deadline', 'newest', 'amount']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  includeClosed: z.coerce.boolean().optional(),
});

export const searchSchema = z.object({
  query: z.string().trim().min(1, 'Type what you are looking for.').max(300),
  categories: z.array(z.enum(OPPORTUNITY_CATEGORIES)).optional(),
  district: z.string().nullish(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const eligibilityCheckSchema = z.object({
  opportunityId: z.string().uuid().optional(),
  slug: z.string().trim().max(160).optional(),
  /** What-if values layered over the stored profile without saving them. */
  overrides: updateProfileSchema.partial().optional(),
}).refine((v) => v.opportunityId || v.slug, {
  message: 'Specify which programme to check.',
});

/* ----------------------------------------------------------------- saved */

export const saveSchema = z.object({
  opportunityId: z.string().uuid(),
  status: z.enum(SAVED_STATUSES).default('interested'),
  note: z.string().trim().max(1000).nullish(),
});

export const updateSavedSchema = z.object({
  status: z.enum(SAVED_STATUSES).optional(),
  note: z.string().trim().max(1000).nullish(),
});

/* ---------------------------------------------------------- action plans */

export const createActionPlanSchema = z.object({
  opportunityId: z.string().uuid(),
});

export const updateTaskSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  notes: z.string().trim().max(1000).nullish(),
  dueDate: z.coerce.date().nullish(),
});

/* ------------------------------------------------------------- locations */

export const nearbySchema = z.object({
  district: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  type: z.string().optional(),
  opportunitySlug: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/* -------------------------------------------------------------- feedback */

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  messageId: z.string().uuid().nullish(),
  opportunityId: z.string().uuid().nullish(),
  rating: z.coerce.number().int().min(1).max(5).nullish(),
  comment: z.string().trim().max(2000).nullish(),
});

/* ------------------------------------------------------------ admin: KB */

/**
 * Bilingual fields are declared explicitly rather than generated by a helper.
 * A helper returning `Record<string, ZodString>` collapses Zod's inference to an
 * index signature, which silently makes every field optional to the caller and
 * breaks the insert types downstream.
 */
export const upsertOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Enter the English name.'),
  nameBn: z.string().trim().min(1, 'Enter the Bangla name.'),
  description: z.string().trim().min(1, 'Enter the English description.'),
  descriptionBn: z.string().trim().min(1, 'Enter the Bangla description.'),
  type: z.enum(ORGANIZATION_TYPES),
  website: z.string().url('Enter a full web address starting with https://').nullish(),
  contactPhone: z.string().trim().max(40).nullish(),
  contactEmail: z.string().email().nullish(),
  address: z.string().trim().max(300).nullish(),
  addressBn: z.string().trim().max(300).nullish(),
  division: z.enum(DIVISIONS).nullish(),
  district: z.enum(DISTRICT_CODES as [string, ...string[]]).nullish(),
  officeHours: z.string().trim().max(200).nullish(),
  officeHoursBn: z.string().trim().max(200).nullish(),
  verified: z.boolean().optional(),
  verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
});

export const upsertOpportunitySchema = z.object({
  organizationId: z.string().uuid('Choose the organisation that runs this programme.'),
  title: z.string().trim().min(1, 'Enter the English title.'),
  titleBn: z.string().trim().min(1, 'Enter the Bangla title.'),
  summary: z.string().trim().min(1, 'Enter the English summary.'),
  summaryBn: z.string().trim().min(1, 'Enter the Bangla summary.'),
  description: z.string().trim().min(1, 'Enter the English description.'),
  descriptionBn: z.string().trim().min(1, 'Enter the Bangla description.'),
  benefits: z.string().trim().min(1, 'Enter the English benefits.'),
  benefitsBn: z.string().trim().min(1, 'Enter the Bangla benefits.'),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.')
    .max(160),
  category: z.enum(OPPORTUNITY_CATEGORIES),
  benefitAmount: z.coerce.number().min(0).nullish(),
  benefitPeriod: z
    .enum(['one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'per_course', 'variable'])
    .nullish(),
  applicationProcess: z
    .array(z.object({ step: z.coerce.number().int().min(1), en: z.string().trim().min(1), bn: z.string().trim().min(1) }))
    .min(1, 'Add at least one application step — an action plan cannot be generated without one.'),
  deadline: z.coerce.date().nullish(),
  recurrence: z.enum(['none', 'annual', 'biannual', 'quarterly', 'continuous']).default('none'),
  status: z.enum(OPPORTUNITY_STATUSES).default('draft'),
  coverageDistricts: z.array(z.enum(DISTRICT_CODES as [string, ...string[]])).default([]),
  officialUrl: z.string().url('Enter a full web address.').nullish(),
  applyUrl: z.string().url('Enter a full web address.').nullish(),
  sourceUrl: z.string().url('Enter the web address of the official source.').nullish(),
  sourceNote: z.string().trim().max(500).nullish(),
  processingTimeDays: z.string().trim().max(120).nullish(),
  renewalMonths: z.coerce.number().int().min(0).max(600).nullish(),
  lifeEvents: z.array(z.enum(LIFE_EVENTS)).default([]),
  tags: z.array(z.string().trim().max(40)).max(30).default([]),
  reviewIntervalDays: z.coerce.number().int().min(7).max(1095).default(180),
  verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
});

export const upsertRuleSchema = z.object({
  opportunityId: z.string().uuid(),
  ruleJson: ruleSetSchema,
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

export const reviewDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(1000).nullish(),
});

export const updateFeedbackSchema = z.object({
  status: z.enum(['new', 'reviewed', 'actioned', 'dismissed']),
  reviewerNote: z.string().trim().max(1000).nullish(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export const verifyRecordSchema = z.object({
  entityType: z.enum(['opportunity', 'organization', 'document', 'location']),
  entityId: z.string().uuid(),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  note: z.string().trim().max(1000).nullish(),
});

/* -------------------------------------------------------------- identity */
// Phase 1 — verified identity & place.

export const verifyNidSchema = z.object({
  nidNumber: z
    .string()
    .trim()
    .min(9, 'Enter your National ID number.')
    .max(20, 'That does not look like a National ID number.'),
});

export const verifyResidencySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).nullish(),
    lng: z.coerce.number().min(-180).max(180).nullish(),
    unionId: z.string().uuid().nullish(),
  })
  .refine((v) => (v.lat != null && v.lng != null) || Boolean(v.unionId), {
    message: 'Share your location, or choose your union from the list.',
  });

/* ---------------------------------------------------------------- issues */
// Phase 2 — citizen voice ("Amar Union, Amar Sheba").

export const submitIssueSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  title: z.string().trim().min(4, 'Describe the problem in a few words.').max(160),
  description: z
    .string()
    .trim()
    .min(8, 'Add a little more detail so officials know what to check.')
    .max(2000),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  photoDataUrl: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/, 'Photos must be JPEG, PNG, or WebP.')
    .max(7_000_000, 'That photo is too large — try a smaller one.')
    .nullish(),
});

export const listIssuesQuerySchema = z.object({
  sort: z.enum(['top', 'recent']).default('top'),
  mine: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateIssueStatusSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
  note: z.string().trim().max(1000).nullish(),
  resolutionPhotoUrl: z.string().trim().max(300).nullish(),
});

/* ----------------------------------------------------------------- civic */
// Phase 3 — ledger & accountability.

export const assignCivicRoleSchema = z
  .object({
    civicRole: z.enum(CIVIC_ROLES),
    civicUnionId: z.string().uuid().nullish(),
    civicUpazila: z.string().trim().min(1).max(120).nullish(),
    civicDistrict: z.string().trim().min(1).max(120).nullish(),
  })
  .refine(
    (v) => {
      if (v.civicRole === 'union_chairman' || v.civicRole === 'union_staff') return Boolean(v.civicUnionId);
      if (v.civicRole === 'upazila_officer') return Boolean(v.civicUpazila);
      if (v.civicRole === 'zila_officer') return Boolean(v.civicDistrict);
      return true; // 'none' needs no scope
    },
    { message: 'Choose the union, upazila, or district this role applies to.' },
  );

export const createAllocationSchema = z.object({
  projectName: z.string().trim().min(3, 'Name the project.').max(200),
  description: z.string().trim().min(8, 'Add a short description.').max(2000),
  amount: z.coerce.number().positive('Enter an amount greater than zero.'),
  allocationDate: z.coerce.date(),
});

export const flagAllocationSchema = z.object({
  reason: z.string().trim().max(500).nullish(),
});

export const enrollBeneficiarySchema = z.object({
  nidNumber: z.string().trim().min(9, "Enter the beneficiary's National ID number.").max(20),
  programCode: z.string().trim().min(1).max(60),
  programName: z.string().trim().min(1).max(160),
  programNameBn: z.string().trim().min(1).max(160),
  amount: z.coerce.number().positive('Enter an amount greater than zero.'),
  period: z.enum(ENTITLEMENT_PERIODS),
});

export const recordDisbursementSchema = z.object({
  amount: z.coerce.number().positive('Enter an amount greater than zero.'),
  scheduledFor: z.coerce.date(),
  status: z.enum(DISBURSEMENT_STATUSES),
});

export const resolveEscalationSchema = z.object({
  status: z.enum(['acknowledged', 'resolved', 'dismissed']),
  note: z.string().trim().max(1000).nullish(),
});

/** Query-string parser that tolerates repeated keys becoming arrays. */
export function parseQuery<T extends z.ZodTypeAny>(schema: T, url: URL): z.infer<T> {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    raw[key] = values.length > 1 ? values : values[0]!;
  }
  return schema.parse(raw);
}
