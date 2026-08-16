/**
 * Single source of truth for every closed vocabulary in the system.
 * The Drizzle schema, Zod validators, and UI all import from here, so a new
 * value cannot be added in one layer and forgotten in another.
 */

/* ------------------------------------------------------------------ roles */
// PRD §43
export const USER_ROLES = ['guest', 'citizen', 'moderator', 'administrator', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Ascending privilege. Used by the RBAC guard for `atLeast` comparisons. */
export const ROLE_RANK: Record<UserRole, number> = {
  guest: 0,
  citizen: 1,
  moderator: 2,
  administrator: 3,
  super_admin: 4,
};

export const STAFF_ROLES: readonly UserRole[] = ['moderator', 'administrator', 'super_admin'];

export const USER_STATUSES = ['active', 'suspended', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/* ------------------------------------------------- opportunity taxonomy */
// PRD §58 OpportunityCategories
export const OPPORTUNITY_CATEGORIES = [
  'scholarship',
  'healthcare',
  'agriculture',
  'business',
  'legal_aid',
  'employment',
  'financial',
  'social_welfare',
  'training',
  'disaster',
  'research',
] as const;
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

// PRD §56 Organization types
export const ORGANIZATION_TYPES = [
  'government',
  'ngo',
  'hospital',
  'university',
  'bank',
  'training_center',
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const OPPORTUNITY_STATUSES = ['draft', 'open', 'closed', 'rolling', 'archived'] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

/**
 * Knowledge-base trust state. PRD Part 7 (which would have defined the
 * ingestion and verification pipeline) is absent from the source document, so
 * this vocabulary is authored here — see docs/DEVIATIONS.md §2.
 *
 * `unverified_sample` is load-bearing: the UI must visibly mark any record in
 * that state, and the confidence scorer penalises it. It is how the system
 * avoids presenting an authored placeholder as a verified government rule.
 */
export const VERIFICATION_STATUSES = [
  'unverified_sample',
  'pending_review',
  'verified',
  'outdated',
  'disputed',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/* ------------------------------------------------------- citizen profile */
export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

export const MARITAL_STATUSES = ['single', 'married', 'widowed', 'divorced', 'separated'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const EDUCATION_LEVELS = [
  'none',
  'primary',
  'jsc',
  'ssc',
  'hsc',
  'diploma',
  'bachelor',
  'master',
  'phd',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

/** Ordinal comparison for rules such as `education >= hsc`. */
export const EDUCATION_RANK: Record<EducationLevel, number> = {
  none: 0,
  primary: 1,
  jsc: 2,
  ssc: 3,
  hsc: 4,
  diploma: 5,
  bachelor: 6,
  master: 7,
  phd: 8,
};

export const OCCUPATIONS = [
  'student',
  'farmer',
  'day_labourer',
  'homemaker',
  'private_employee',
  'government_employee',
  'self_employed',
  'small_business',
  'fisherman',
  'weaver',
  'rickshaw_driver',
  'garment_worker',
  'teacher',
  'unemployed',
  'retired',
  'other',
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

export const DISABILITY_TYPES = [
  'none',
  'visual',
  'hearing',
  'speech',
  'physical',
  'intellectual',
  'multiple',
  'other',
] as const;
export type DisabilityType = (typeof DISABILITY_TYPES)[number];

/* --------------------------------------------------------- eligibility */
// PRD §17 Outputs
export const ELIGIBILITY_OUTCOMES = ['eligible', 'partially_eligible', 'not_eligible', 'unknown'] as const;
export type EligibilityOutcome = (typeof ELIGIBILITY_OUTCOMES)[number];

export const RULE_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'not_in',
  'between',
  'exists',
  'not_exists',
  'contains_any',
  'contains_all',
] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

/* -------------------------------------------------------- conversation */
export const MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

// PRD §61 message types
export const MESSAGE_KINDS = [
  'text',
  'clarification',
  'recommendation',
  'action_plan',
  'eligibility',
  'system',
  'error',
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

// PRD §20 Module 2
export const INTENTS = [
  'find_opportunities',
  'check_eligibility',
  'scholarship_search',
  'healthcare_search',
  'ngo_assistance',
  'agriculture_support',
  'sme_support',
  'ask_question',
  'document_requirements',
  'nearby_services',
  'timeline_request',
  'follow_up',
  'general_information',
] as const;
export type Intent = (typeof INTENTS)[number];

// PRD §23 Life Event Detection Engine
export const LIFE_EVENTS = [
  'job_loss',
  'widowhood',
  'higher_education',
  'serious_medical_need',
  'entrepreneurship',
  'disaster_recovery',
  'disability_onset',
  'pregnancy',
  'old_age',
  'crop_loss',
  'child_education',
  'legal_dispute',
  'seeking_employment',
  'divorce',
  'migration',
] as const;
export type LifeEvent = (typeof LIFE_EVENTS)[number];

/* ------------------------------------------------------------- tracking */
// PRD §18 / §60
export const SAVED_STATUSES = [
  'interested',
  'preparing',
  'documents_ready',
  'applied',
  'under_review',
  'approved',
  'rejected',
  'completed',
] as const;
export type SavedStatus = (typeof SAVED_STATUSES)[number];

export const TASK_STATUSES = ['pending', 'in_progress', 'done', 'skipped'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/* -------------------------------------------------------- notifications */
// PRD §67
export const NOTIFICATION_TYPES = [
  'application_reminder',
  'deadline_reminder',
  'timeline_reminder',
  'new_opportunity',
  'program_updated',
  'document_expiring',
  'recommendation_improved',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'push', 'email', 'sms'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/* -------------------------------------------------------------- timeline */
export const TIMELINE_EVENT_TYPES = [
  'deadline',
  'document_expiry',
  'scholarship_window',
  'renewal',
  'training',
  'announcement',
  'application_progress',
  'reminder',
  'task',
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

/* ------------------------------------------------------------ knowledge */
export const DOCUMENT_SOURCE_TYPES = [
  'circular',
  'gazette',
  'web_page',
  'pdf',
  'form',
  'faq',
  'manual_entry',
] as const;
export type DocumentSourceType = (typeof DOCUMENT_SOURCE_TYPES)[number];

export const EMBEDDING_STATUSES = ['pending', 'processing', 'ready', 'failed', 'skipped'] as const;
export type EmbeddingStatus = (typeof EMBEDDING_STATUSES)[number];

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/* ------------------------------------------------------------ feedback */
export const FEEDBACK_KINDS = [
  'helpful',
  'not_helpful',
  'incorrect_information',
  'missing_opportunity',
  'rating',
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ['new', 'reviewed', 'actioned', 'dismissed'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/* --------------------------------------------------------------- AI ops */
export const AI_ENGINES = ['anthropic', 'openai', 'deepseek', 'simulated'] as const;
export type AiEngine = (typeof AI_ENGINES)[number];

export const AI_REQUEST_TYPES = [
  'conversation',
  'intent_classification',
  'entity_extraction',
  'life_event_detection',
  'explanation',
  'summarization',
  'action_plan',
  'embedding',
] as const;
export type AiRequestType = (typeof AI_REQUEST_TYPES)[number];

/* ------------------------------------------------------------- theming */
export const THEMES = ['light', 'dark', 'sunlight'] as const;
export type Theme = (typeof THEMES)[number];

/** BDS §4.6 — four steps, previewed live on real content. */
export const TEXT_SCALES = [1, 1.15, 1.3, 1.5] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const NUMERAL_SYSTEMS = ['latin', 'bengali'] as const;
export type NumeralSystem = (typeof NUMERAL_SYSTEMS)[number];
