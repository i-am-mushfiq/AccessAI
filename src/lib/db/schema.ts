import { sql, relations } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
import {
  USER_ROLES, USER_STATUSES, OPPORTUNITY_CATEGORIES, ORGANIZATION_TYPES, OPPORTUNITY_STATUSES,
  VERIFICATION_STATUSES, GENDERS, MARITAL_STATUSES, EDUCATION_LEVELS, OCCUPATIONS, DISABILITY_TYPES,
  ELIGIBILITY_OUTCOMES, MESSAGE_ROLES, MESSAGE_KINDS, SAVED_STATUSES, TASK_STATUSES, TASK_PRIORITIES,
  NOTIFICATION_TYPES, NOTIFICATION_CHANNELS, TIMELINE_EVENT_TYPES, DOCUMENT_SOURCE_TYPES,
  EMBEDDING_STATUSES, REVIEW_STATUSES, FEEDBACK_KINDS, FEEDBACK_STATUSES, AI_ENGINES,
  AI_REQUEST_TYPES, THEMES, NUMERAL_SYSTEMS, LIFE_EVENTS, INTENTS,
} from '../domain/enums';
import type { RuleSet } from '../domain/rules';

/**
 * PRD §40 — "The database should use UUIDs for all primary keys."
 * Dialect is SQLite/libSQL rather than PostgreSQL; see docs/DEVIATIONS.md §1.
 * Column names are snake_case per PRD §85.
 */

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date());
const updatedAt = () => integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date());

/* ======================================================================
   IDENTITY
   ====================================================================== */

export const users = sqliteTable(
  'users',
  {
    id: id(),
    /** Phone is the identity (BDS §10.2.11). Stored normalised: 01XXXXXXXXX. */
    phone: text('phone').notNull(),
    name: text('name').notNull(),
    /** Optional by design — many target users have no email they remember. */
    email: text('email'),
    /** 4–6 digit PIN, hashed. Never a "strong password" (BDS §10.2.11). */
    pinHash: text('pin_hash'),
    role: text('role', { enum: USER_ROLES }).notNull().default('citizen'),
    status: text('status', { enum: USER_STATUSES }).notNull().default('active'),
    language: text('language', { enum: ['bn', 'en'] }).notNull().default('bn'),
    district: text('district'),
    phoneVerifiedAt: integer('phone_verified_at', { mode: 'timestamp_ms' }),
    /** Consecutive failed PIN attempts; drives progressive delay, not lockout. */
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    lockedUntil: integer('locked_until', { mode: 'timestamp_ms' }),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_phone_uq').on(t.phone), index('users_role_idx').on(t.role)],
);

/**
 * PRD §21 — the dynamic profile. Every column is nullable: the profile grows
 * over the conversation and the engine must distinguish "false" from "not yet
 * asked". Nullable columns are what make three-valued eligibility possible.
 */
export const userProfiles = sqliteTable(
  'user_profiles',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    dateOfBirth: integer('date_of_birth', { mode: 'timestamp_ms' }),
    /** Kept when the citizen states an age but not a birth date. */
    statedAge: integer('stated_age'),
    gender: text('gender', { enum: GENDERS }),
    occupation: text('occupation', { enum: OCCUPATIONS }),
    monthlyIncome: integer('monthly_income'),
    maritalStatus: text('marital_status', { enum: MARITAL_STATUSES }),
    education: text('education', { enum: EDUCATION_LEVELS }),
    cgpa: real('cgpa'),
    university: text('university'),
    department: text('department'),
    hasDisability: integer('has_disability', { mode: 'boolean' }),
    disabilityType: text('disability_type', { enum: DISABILITY_TYPES }),
    householdSize: integer('household_size'),
    dependents: integer('dependents'),
    division: text('division'),
    district: text('district'),
    upazila: text('upazila'),
    landOwnershipDecimals: real('land_ownership_decimals'),
    isStudent: integer('is_student', { mode: 'boolean' }),
    hasBusiness: integer('has_business', { mode: 'boolean' }),
    businessType: text('business_type'),
    employees: integer('employees'),
    farmSizeDecimals: real('farm_size_decimals'),
    crops: text('crops', { mode: 'json' }).$type<string[]>(),
    livestock: text('livestock', { mode: 'json' }).$type<string[]>(),
    isPregnant: integer('is_pregnant', { mode: 'boolean' }),
    /** Health data is opt-in and user-controlled (PRD §68). */
    medicalConditions: text('medical_conditions', { mode: 'json' }).$type<string[]>(),
    shareHealthData: integer('share_health_data', { mode: 'boolean' }).notNull().default(false),
    citizenship: text('citizenship').default('bangladeshi'),
    preferredCountry: text('preferred_country'),
    ieltsScore: real('ielts_score'),
    hasNid: integer('has_nid', { mode: 'boolean' }),
    hasBankAccount: integer('has_bank_account', { mode: 'boolean' }),
    isFreedomFighterFamily: integer('is_freedom_fighter_family', { mode: 'boolean' }),
    interests: text('interests', { mode: 'json' }).$type<string[]>(),
    /** Life events detected from conversation, with detection provenance. */
    lifeEvents: text('life_events', { mode: 'json' }).$type<
      { event: string; detectedAt: number; source: 'conversation' | 'profile' | 'manual' }[]
    >(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('user_profiles_user_uq').on(t.userId)],
);

export const userSettings = sqliteTable(
  'user_settings',
  {
    userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    theme: text('theme', { enum: THEMES }).notNull().default('light'),
    /** BDS §4.6 in-app text size: 1 / 1.15 / 1.3 / 1.5. */
    textScale: real('text_scale').notNull().default(1),
    numeralSystem: text('numeral_system', { enum: NUMERAL_SYSTEMS }).notNull().default('latin'),
    reduceMotion: integer('reduce_motion', { mode: 'boolean' }).notNull().default(false),
    highContrast: integer('high_contrast', { mode: 'boolean' }).notNull().default(false),
    voiceEnabled: integer('voice_enabled', { mode: 'boolean' }).notNull().default(true),
    notifyPush: integer('notify_push', { mode: 'boolean' }).notNull().default(true),
    notifyEmail: integer('notify_email', { mode: 'boolean' }).notNull().default(false),
    notifySms: integer('notify_sms', { mode: 'boolean' }).notNull().default(false),
    notifyDeadlines: integer('notify_deadlines', { mode: 'boolean' }).notNull().default(true),
    notifyNewOpportunities: integer('notify_new_opportunities', { mode: 'boolean' }).notNull().default(true),
    notifyProgramUpdates: integer('notify_program_updates', { mode: 'boolean' }).notNull().default(true),
    profileVisibility: text('profile_visibility', { enum: ['private', 'anonymised_analytics'] })
      .notNull().default('anonymised_analytics'),
    updatedAt: updatedAt(),
  },
);

/** Refresh-token family. Rotation + reuse detection (PRD §43). */
export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    /** Set when this token was rotated, so replay of the old one is detectable. */
    replacedById: text('replaced_by_id'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_hash_idx').on(t.refreshTokenHash)],
);

export const otpChallenges = sqliteTable(
  'otp_challenges',
  {
    id: id(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    purpose: text('purpose', { enum: ['register', 'login', 'reset_pin', 'verify_phone'] }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    /** BDS §10.2.5 — at least 5 minutes; short expiry plus slow SMS is a
        systematic failure on congested networks. */
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
    /** Dev-only echo so the flow is completable without an SMS provider. */
    devCode: text('dev_code'),
    createdAt: createdAt(),
  },
  (t) => [index('otp_phone_idx').on(t.phone, t.purpose)],
);

/* ======================================================================
   KNOWLEDGE BASE
   ====================================================================== */

export const organizations = sqliteTable(
  'organizations',
  {
    id: id(),
    name: text('name').notNull(),
    nameBn: text('name_bn').notNull(),
    type: text('type', { enum: ORGANIZATION_TYPES }).notNull(),
    description: text('description').notNull(),
    descriptionBn: text('description_bn').notNull(),
    website: text('website'),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    address: text('address'),
    addressBn: text('address_bn'),
    division: text('division'),
    district: text('district'),
    upazila: text('upazila'),
    lat: real('lat'),
    lng: real('lng'),
    officeHours: text('office_hours'),
    officeHoursBn: text('office_hours_bn'),
    /** Distinct from verificationStatus: does AccessAI vouch for the entity. */
    verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
    verificationStatus: text('verification_status', { enum: VERIFICATION_STATUSES })
      .notNull().default('unverified_sample'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('orgs_type_idx').on(t.type), index('orgs_district_idx').on(t.district)],
);

export const opportunities = sqliteTable(
  'opportunities',
  {
    id: id(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    titleBn: text('title_bn').notNull(),
    slug: text('slug').notNull(),
    category: text('category', { enum: OPPORTUNITY_CATEGORIES }).notNull(),
    summary: text('summary').notNull(),
    summaryBn: text('summary_bn').notNull(),
    description: text('description').notNull(),
    descriptionBn: text('description_bn').notNull(),
    benefits: text('benefits').notNull(),
    benefitsBn: text('benefits_bn').notNull(),
    /** In BDT. Rendered with two decimals and lakh/crore grouping (BDS §4.3). */
    benefitAmount: real('benefit_amount'),
    benefitPeriod: text('benefit_period', {
      enum: ['one_time', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'per_course', 'variable'],
    }),
    applicationProcess: text('application_process', { mode: 'json' })
      .$type<{ step: number; en: string; bn: string }[]>().notNull(),
    /** Null means rolling/always open — distinct from an unknown deadline. */
    deadline: integer('deadline', { mode: 'timestamp_ms' }),
    /** Annual programmes reopen; drives proactive timeline entries. */
    recurrence: text('recurrence', { enum: ['none', 'annual', 'biannual', 'quarterly', 'continuous'] })
      .notNull().default('none'),
    status: text('status', { enum: OPPORTUNITY_STATUSES }).notNull().default('open'),
    /** Empty array = nationwide. Otherwise district codes. */
    coverageDistricts: text('coverage_districts', { mode: 'json' }).$type<string[]>().notNull(),
    officialUrl: text('official_url'),
    applyUrl: text('apply_url'),
    processingTimeDays: text('processing_time_days'),
    renewalMonths: integer('renewal_months'),
    /** Which life events surface this programme (PRD §23). */
    lifeEvents: text('life_events', { mode: 'json' }).$type<string[]>().notNull(),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
    /** Used by the 10% "popularity" ranking factor (PRD §31). */
    viewCount: integer('view_count').notNull().default(0),
    saveCount: integer('save_count').notNull().default(0),
    applicationCount: integer('application_count').notNull().default(0),

    /* ---- provenance (authored: PRD Part 7 is missing) ---- */
    verificationStatus: text('verification_status', { enum: VERIFICATION_STATUSES })
      .notNull().default('unverified_sample'),
    sourceUrl: text('source_url'),
    sourceNote: text('source_note'),
    lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp_ms' }),
    verifiedBy: text('verified_by'),
    /** Re-verification cadence; feeds the staleness detector job. */
    reviewIntervalDays: integer('review_interval_days').notNull().default(180),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('opportunities_slug_uq').on(t.slug),
    index('opportunities_category_idx').on(t.category),
    index('opportunities_status_idx').on(t.status),
    index('opportunities_org_idx').on(t.organizationId),
    index('opportunities_deadline_idx').on(t.deadline),
  ],
);

export const eligibilityRules = sqliteTable(
  'eligibility_rules',
  {
    id: id(),
    opportunityId: text('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
    ruleJson: text('rule_json', { mode: 'json' }).$type<RuleSet>().notNull(),
    priority: integer('priority').notNull().default(0),
    version: integer('version').notNull().default(1),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** Who wrote and who signed off — required before status can be verified. */
    authoredBy: text('authored_by'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('rules_opportunity_idx').on(t.opportunityId, t.active)],
);

export const requiredDocuments = sqliteTable(
  'required_documents',
  {
    id: id(),
    opportunityId: text('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameBn: text('name_bn').notNull(),
    required: integer('required', { mode: 'boolean' }).notNull().default(true),
    issuingAuthority: text('issuing_authority'),
    issuingAuthorityBn: text('issuing_authority_bn'),
    /** PRD §Feature 8 — "Common Mistakes" and "Preparation Tips". */
    commonMistake: text('common_mistake'),
    commonMistakeBn: text('common_mistake_bn'),
    tip: text('tip'),
    tipBn: text('tip_bn'),
    validityMonths: integer('validity_months'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('reqdocs_opportunity_idx').on(t.opportunityId)],
);

export const serviceLocations = sqliteTable(
  'service_locations',
  {
    id: id(),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameBn: text('name_bn').notNull(),
    type: text('type', {
      enum: ['union_office', 'upazila_office', 'district_office', 'hospital', 'clinic', 'ngo_office',
             'bank', 'training_center', 'legal_aid', 'agriculture_office', 'pharmacy', 'digital_center'],
    }).notNull(),
    address: text('address').notNull(),
    addressBn: text('address_bn').notNull(),
    division: text('division').notNull(),
    district: text('district').notNull(),
    upazila: text('upazila'),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    phone: text('phone'),
    officeHours: text('office_hours'),
    officeHoursBn: text('office_hours_bn'),
    services: text('services', { mode: 'json' }).$type<string[]>().notNull(),
    verificationStatus: text('verification_status', { enum: VERIFICATION_STATUSES })
      .notNull().default('unverified_sample'),
    createdAt: createdAt(),
  },
  (t) => [index('locations_district_idx').on(t.district), index('locations_type_idx').on(t.type)],
);

/** Source documents behind the knowledge base — PRD §Feature 19 evidence. */
export const documents = sqliteTable(
  'documents',
  {
    id: id(),
    opportunityId: text('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    titleBn: text('title_bn'),
    sourceType: text('source_type', { enum: DOCUMENT_SOURCE_TYPES }).notNull(),
    /** Where the citizen can read the original. */
    sourceUrl: text('source_url'),
    /** Local/object-storage copy, when we are permitted to hold one. */
    fileUrl: text('file_url'),
    publisher: text('publisher'),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    retrievedAt: integer('retrieved_at', { mode: 'timestamp_ms' }),
    /** Change detection for the daily sync job. */
    checksum: text('checksum'),
    version: integer('version').notNull().default(1),
    /** Redistribution position — a real constraint for government circulars. */
    licenseNote: text('license_note'),
    textContent: text('text_content'),
    embeddingStatus: text('embedding_status', { enum: EMBEDDING_STATUSES }).notNull().default('pending'),
    verificationStatus: text('verification_status', { enum: VERIFICATION_STATUSES })
      .notNull().default('unverified_sample'),
    /** Set by the staleness job when retrievedAt exceeds the review interval. */
    stale: integer('stale', { mode: 'boolean' }).notNull().default(false),
    deadLink: integer('dead_link', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('documents_opportunity_idx').on(t.opportunityId),
    index('documents_embedding_idx').on(t.embeddingStatus),
  ],
);

/**
 * Retrieval index. PRD §37 specifies pgvector; here the vector is a JSON
 * float array scored in-process, and lexical retrieval uses the token stats
 * below. Interface-compatible with a pgvector swap (docs/DEVIATIONS.md §3).
 */
export const documentChunks = sqliteTable(
  'document_chunks',
  {
    id: id(),
    documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    contentBn: text('content_bn'),
    tokenCount: integer('token_count').notNull().default(0),
    /** Null when no embedding provider is configured. */
    embedding: text('embedding', { mode: 'json' }).$type<number[]>(),
    embeddingModel: text('embedding_model'),
    /** Pre-computed lexical term frequencies for BM25 without a scan. */
    termFrequencies: text('term_frequencies', { mode: 'json' }).$type<Record<string, number>>(),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index('chunks_document_idx').on(t.documentId),
    uniqueIndex('chunks_doc_index_uq').on(t.documentId, t.chunkIndex),
  ],
);

/** PRD §27 — explicit relationships enabling indirect discovery. */
export const knowledgeGraphEdges = sqliteTable(
  'knowledge_graph_edges',
  {
    id: id(),
    fromType: text('from_type', { enum: ['life_event', 'opportunity', 'organization', 'category', 'persona'] }).notNull(),
    fromId: text('from_id').notNull(),
    relation: text('relation', {
      enum: ['triggers', 'requires', 'complements', 'succeeds', 'offered_by', 'belongs_to', 'alternative_to'],
    }).notNull(),
    toType: text('to_type', { enum: ['life_event', 'opportunity', 'organization', 'category', 'persona'] }).notNull(),
    toId: text('to_id').notNull(),
    weight: real('weight').notNull().default(1),
    note: text('note'),
  },
  (t) => [
    index('kg_from_idx').on(t.fromType, t.fromId),
    index('kg_to_idx').on(t.toType, t.toId),
  ],
);

export const lifeEventCatalog = sqliteTable('life_event_catalog', {
  code: text('code', { enum: LIFE_EVENTS }).primaryKey(),
  label: text('label').notNull(),
  labelBn: text('label_bn').notNull(),
  description: text('description').notNull(),
  descriptionBn: text('description_bn').notNull(),
  /** Bangla + English + Banglish surface forms for the detector. */
  keywords: text('keywords', { mode: 'json' }).$type<string[]>().notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

/* ======================================================================
   CONVERSATION
   ====================================================================== */

export const conversations = sqliteTable(
  'conversations',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    summary: text('summary'),
    language: text('language', { enum: ['bn', 'en'] }).notNull().default('bn'),
    messageCount: integer('message_count').notNull().default(0),
    startedAt: createdAt(),
    lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' }),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('conversations_user_idx').on(t.userId, t.lastMessageAt)],
);

export const messages = sqliteTable(
  'messages',
  {
    id: id(),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: MESSAGE_ROLES }).notNull(),
    kind: text('kind', { enum: MESSAGE_KINDS }).notNull().default('text'),
    content: text('content').notNull(),
    /** Structured payload for recommendation / action-plan / eligibility cards. */
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
    tokens: integer('tokens').notNull().default(0),
    latencyMs: integer('latency_ms'),
    aiEngine: text('ai_engine', { enum: AI_ENGINES }),
    confidence: integer('confidence'),
    createdAt: createdAt(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)],
);

/* ======================================================================
   CITIZEN ACTIVITY
   ====================================================================== */

export const savedOpportunities = sqliteTable(
  'saved_opportunities',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
    status: text('status', { enum: SAVED_STATUSES }).notNull().default('interested'),
    note: text('note'),
    savedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('saved_user_opp_uq').on(t.userId, t.opportunityId)],
);

/** Status transitions are auditable — PRD §18 tracker + §121 admin logging. */
export const savedStatusHistory = sqliteTable(
  'saved_status_history',
  {
    id: id(),
    savedId: text('saved_id').notNull().references(() => savedOpportunities.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status', { enum: SAVED_STATUSES }),
    toStatus: text('to_status', { enum: SAVED_STATUSES }).notNull(),
    changedAt: createdAt(),
  },
  (t) => [index('saved_history_idx').on(t.savedId)],
);

export const actionPlans = sqliteTable(
  'action_plans',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    titleBn: text('title_bn').notNull(),
    status: text('status', { enum: ['active', 'completed', 'abandoned'] }).notNull().default('active'),
    generatedBy: text('generated_by', { enum: AI_ENGINES }).notNull().default('simulated'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('plans_user_idx').on(t.userId),
    uniqueIndex('plans_user_opp_uq').on(t.userId, t.opportunityId),
  ],
);

export const actionPlanTasks = sqliteTable(
  'action_plan_tasks',
  {
    id: id(),
    planId: text('plan_id').notNull().references(() => actionPlans.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    titleBn: text('title_bn').notNull(),
    description: text('description'),
    descriptionBn: text('description_bn'),
    dueDate: integer('due_date', { mode: 'timestamp_ms' }),
    priority: text('priority', { enum: TASK_PRIORITIES }).notNull().default('medium'),
    estimatedMinutes: integer('estimated_minutes'),
    status: text('status', { enum: TASK_STATUSES }).notNull().default('pending'),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('tasks_plan_idx').on(t.planId, t.sortOrder)],
);

export const timelineEvents = sqliteTable(
  'timeline_events',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
    taskId: text('task_id').references(() => actionPlanTasks.id, { onDelete: 'cascade' }),
    type: text('type', { enum: TIMELINE_EVENT_TYPES }).notNull(),
    title: text('title').notNull(),
    titleBn: text('title_bn').notNull(),
    description: text('description'),
    descriptionBn: text('description_bn'),
    eventDate: integer('event_date', { mode: 'timestamp_ms' }).notNull(),
    /** System-generated entries are regenerated; manual ones are preserved. */
    source: text('source', { enum: ['system', 'manual'] }).notNull().default('system'),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('timeline_user_date_idx').on(t.userId, t.eventDate)],
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    titleBn: text('title_bn').notNull(),
    body: text('body').notNull(),
    bodyBn: text('body_bn').notNull(),
    type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
    channel: text('channel', { enum: NOTIFICATION_CHANNELS }).notNull().default('in_app'),
    actionUrl: text('action_url'),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.read, t.createdAt)],
);

/* ======================================================================
   AI OPERATIONS & GOVERNANCE
   ====================================================================== */

/**
 * Every eligibility decision is stored with the profile snapshot and rule
 * version that produced it. Without this, "why did it say I qualified last
 * week?" is unanswerable and the Trust Dashboard is decorative.
 */
export const eligibilityEvaluations = sqliteTable(
  'eligibility_evaluations',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
    outcome: text('outcome', { enum: ELIGIBILITY_OUTCOMES }).notNull(),
    matchedCount: integer('matched_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    unknownCount: integer('unknown_count').notNull().default(0),
    confidence: integer('confidence').notNull().default(0),
    /** Full per-condition trace, rendered verbatim by the explanation UI. */
    detail: text('detail', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    profileSnapshot: text('profile_snapshot', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    ruleVersion: integer('rule_version').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('evals_user_idx').on(t.userId, t.createdAt), index('evals_opp_idx').on(t.opportunityId)],
);

export const aiLogs = sqliteTable(
  'ai_logs',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: text('message_id'),
    requestType: text('request_type', { enum: AI_REQUEST_TYPES }).notNull(),
    engine: text('engine', { enum: AI_ENGINES }).notNull(),
    model: text('model'),
    promptTemplate: text('prompt_template'),
    promptVersion: text('prompt_version'),
    inputSummary: text('input_summary'),
    outputSummary: text('output_summary'),
    intents: text('intents', { mode: 'json' }).$type<string[]>(),
    entities: text('entities', { mode: 'json' }).$type<Record<string, unknown>>(),
    retrievedChunkIds: text('retrieved_chunk_ids', { mode: 'json' }).$type<string[]>(),
    citedOpportunityIds: text('cited_opportunity_ids', { mode: 'json' }).$type<string[]>(),
    confidence: integer('confidence'),
    latencyMs: integer('latency_ms'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    /** Set when a claim could not be traced to retrieved evidence (PRD §35). */
    groundingFailure: integer('grounding_failure', { mode: 'boolean' }).notNull().default(false),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [index('ai_logs_created_idx').on(t.createdAt), index('ai_logs_type_idx').on(t.requestType)],
);

export const feedback = sqliteTable(
  'feedback',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    messageId: text('message_id').references(() => messages.id, { onDelete: 'cascade' }),
    opportunityId: text('opportunity_id').references(() => opportunities.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: FEEDBACK_KINDS }).notNull(),
    rating: integer('rating'),
    comment: text('comment'),
    /** PRD §34 — feedback NEVER auto-changes rules; a human decides. */
    status: text('status', { enum: FEEDBACK_STATUSES }).notNull().default('new'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    reviewerNote: text('reviewer_note'),
    createdAt: createdAt(),
  },
  (t) => [index('feedback_status_idx').on(t.status, t.createdAt)],
);

/** Part 7 verification workflow — nothing becomes `verified` without a review. */
export const knowledgeReviews = sqliteTable(
  'knowledge_reviews',
  {
    id: id(),
    entityType: text('entity_type', { enum: ['opportunity', 'eligibility_rule', 'organization', 'document', 'location'] }).notNull(),
    entityId: text('entity_id').notNull(),
    submittedBy: text('submitted_by').notNull(),
    reviewerId: text('reviewer_id'),
    status: text('status', { enum: REVIEW_STATUSES }).notNull().default('pending'),
    note: text('note'),
    /** Proposed change, applied only on approval. */
    proposedPatch: text('proposed_patch', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    decidedAt: integer('decided_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('reviews_status_idx').on(t.status), index('reviews_entity_idx').on(t.entityType, t.entityId)],
);

/** PRD §121 — "Log administrative actions." Append-only. */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    actorId: text('actor_id'),
    actorRole: text('actor_role', { enum: USER_ROLES }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    before: text('before', { mode: 'json' }).$type<Record<string, unknown>>(),
    after: text('after', { mode: 'json' }).$type<Record<string, unknown>>(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt), index('audit_entity_idx').on(t.entityType, t.entityId)],
);

export const searchQueries = sqliteTable(
  'search_queries',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    query: text('query').notNull(),
    locale: text('locale', { enum: ['bn', 'en'] }).notNull(),
    intents: text('intents', { mode: 'json' }).$type<string[]>(),
    resultCount: integer('result_count').notNull().default(0),
    clickedOpportunityId: text('clicked_opportunity_id'),
    createdAt: createdAt(),
  },
  (t) => [index('search_created_idx').on(t.createdAt)],
);

/** PRD §45 — background job bookkeeping, surfaced in Admin → System Health. */
export const jobRuns = sqliteTable(
  'job_runs',
  {
    id: id(),
    job: text('job').notNull(),
    status: text('status', { enum: ['running', 'succeeded', 'failed'] }).notNull(),
    startedAt: createdAt(),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    processed: integer('processed').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    detail: text('detail', { mode: 'json' }).$type<Record<string, unknown>>(),
  },
  (t) => [index('jobs_job_idx').on(t.job, t.startedAt)],
);

/** Daily rollup for the analytics dashboard (PRD §78). */
export const analyticsDaily = sqliteTable(
  'analytics_daily',
  {
    day: text('day').primaryKey(),
    activeUsers: integer('active_users').notNull().default(0),
    newUsers: integer('new_users').notNull().default(0),
    conversations: integer('conversations').notNull().default(0),
    recommendations: integer('recommendations').notNull().default(0),
    saves: integer('saves').notNull().default(0),
    applicationsStarted: integer('applications_started').notNull().default(0),
    completedActionPlans: integer('completed_action_plans').notNull().default(0),
    searches: integer('searches').notNull().default(0),
    avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
    citationCoverage: real('citation_coverage').notNull().default(0),
    groundingFailureRate: real('grounding_failure_rate').notNull().default(0),
    satisfactionScore: real('satisfaction_score').notNull().default(0),
  },
);

/** Anonymous rate limiting + abuse control without Redis (PRD §48). */
export const rateLimitBuckets = sqliteTable(
  'rate_limit_buckets',
  {
    key: text('key').primaryKey(),
    tokens: real('tokens').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
);

/* ======================================================================
   RELATIONS
   ====================================================================== */

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
  conversations: many(conversations),
  saved: many(savedOpportunities),
  notifications: many(notifications),
  plans: many(actionPlans),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  opportunities: many(opportunities),
  locations: many(serviceLocations),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [opportunities.organizationId],
    references: [organizations.id],
  }),
  rules: many(eligibilityRules),
  requiredDocuments: many(requiredDocuments),
  documents: many(documents),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const actionPlansRelations = relations(actionPlans, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [actionPlans.opportunityId],
    references: [opportunities.id],
  }),
  tasks: many(actionPlanTasks),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [documents.opportunityId],
    references: [opportunities.id],
  }),
  chunks: many(documentChunks),
}));

/* ======================================================================
   INFERRED TYPES — services and UI use these, never raw row shapes.
   ====================================================================== */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type OtpChallenge = typeof otpChallenges.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type EligibilityRuleRow = typeof eligibilityRules.$inferSelect;
export type RequiredDocument = typeof requiredDocuments.$inferSelect;
export type ServiceLocation = typeof serviceLocations.$inferSelect;
export type KnowledgeDocument = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type KnowledgeGraphEdge = typeof knowledgeGraphEdges.$inferSelect;
export type LifeEventCatalogRow = typeof lifeEventCatalog.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type SavedOpportunity = typeof savedOpportunities.$inferSelect;
export type ActionPlan = typeof actionPlans.$inferSelect;
export type ActionPlanTask = typeof actionPlanTasks.$inferSelect;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type EligibilityEvaluation = typeof eligibilityEvaluations.$inferSelect;
export type AiLog = typeof aiLogs.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type KnowledgeReview = typeof knowledgeReviews.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
export type JobRun = typeof jobRuns.$inferSelect;
export type AnalyticsDaily = typeof analyticsDaily.$inferSelect;

export { sql };
