/* eslint-disable no-console */
import './load-env';
import { db, initialisePragmas, sqlClient } from '../src/lib/db/client';
import * as s from '../src/lib/db/schema';
import {
  SEED_ORGANIZATIONS, SEED_OPPORTUNITIES, SEED_LIFE_EVENTS, SEED_LOCATIONS,
  validateSeedCorpus, SEED_STATS,
} from '../src/lib/db/seed';
import { hashSecret } from '../src/lib/security/hash';
import { chunkText, termFrequencies, estimateTokens } from '../src/modules/knowledge/tokenizer';
import { addDays } from '../src/lib/format/dates';

/**
 * Seeds the knowledge base, the retrieval index, and demo accounts.
 *
 * Idempotent by construction: it clears the content tables it owns before
 * writing, so `npm run db:seed` can be run repeatedly. It does NOT clear user
 * data unless --reset-users is passed, so a developer's test conversations
 * survive a corpus refresh.
 */

const RESET_USERS = process.argv.includes('--reset-users');

const now = new Date();

async function main() {
  console.log('AccessAI — seeding knowledge base\n');

  const validation = validateSeedCorpus();
  for (const warning of validation.warnings) console.warn(`  warning: ${warning}`);
  if (!validation.ok) {
    console.error('\nSeed corpus failed validation:');
    for (const error of validation.errors) console.error(`  • ${error}`);
    process.exit(1);
  }
  console.log(`  corpus valid: ${SEED_STATS.opportunities} programmes, ${SEED_STATS.organizations} organisations, ${SEED_STATS.categories} categories\n`);

  await initialisePragmas();

  // ---------------------------------------------------------------- clear
  // Order matters: children before parents, because foreign keys are ON.
  console.log('  clearing existing corpus…');
  await db.delete(s.documentChunks);
  await db.delete(s.documents);
  await db.delete(s.requiredDocuments);
  await db.delete(s.eligibilityRules);
  await db.delete(s.knowledgeGraphEdges);
  await db.delete(s.serviceLocations);
  if (RESET_USERS) {
    await db.delete(s.eligibilityEvaluations);
    await db.delete(s.timelineEvents);
    await db.delete(s.actionPlanTasks);
    await db.delete(s.actionPlans);
    await db.delete(s.savedStatusHistory);
    await db.delete(s.savedOpportunities);
    await db.delete(s.notifications);
    await db.delete(s.messages);
    await db.delete(s.conversations);
    await db.delete(s.aiLogs);
    await db.delete(s.feedback);
    await db.delete(s.sessions);
    await db.delete(s.otpChallenges);
    await db.delete(s.userSettings);
    await db.delete(s.userProfiles);
    await db.delete(s.users);
  }
  await db.delete(s.opportunities);
  await db.delete(s.organizations);
  await db.delete(s.lifeEventCatalog);

  // -------------------------------------------------------- life events
  console.log('  life events…');
  await db.insert(s.lifeEventCatalog).values(
    SEED_LIFE_EVENTS.map((e) => ({
      code: e.code,
      label: e.label[0],
      labelBn: e.label[1],
      description: e.description[0],
      descriptionBn: e.description[1],
      keywords: [...e.keywords],
      icon: e.icon,
      sortOrder: e.sortOrder,
    })),
  );

  // ------------------------------------------------------ organisations
  console.log('  organisations…');
  const orgIds = new Map<string, string>();
  for (const org of SEED_ORGANIZATIONS) {
    const id = crypto.randomUUID();
    orgIds.set(org.key, id);
    await db.insert(s.organizations).values({
      id,
      name: org.name[0],
      nameBn: org.name[1],
      type: org.type,
      description: org.description[0],
      descriptionBn: org.description[1],
      website: org.website ?? null,
      contactPhone: org.contactPhone ?? null,
      address: org.address?.[0] ?? null,
      addressBn: org.address?.[1] ?? null,
      division: org.division ?? null,
      district: org.district ?? null,
      officeHours: org.officeHours?.[0] ?? null,
      officeHoursBn: org.officeHours?.[1] ?? null,
      verified: org.verified ?? false,
      // The ENTITY is real and verified; its contact details are not.
      verificationStatus: org.verificationStatus ?? 'unverified_sample',
    });
  }

  // ------------------------------------------------------- opportunities
  console.log('  programmes, rules, documents and retrieval index…');
  const opportunityIds = new Map<string, string>();
  let chunkCount = 0;

  for (const o of SEED_OPPORTUNITIES) {
    const organizationId = orgIds.get(o.org);
    if (!organizationId) throw new Error(`Unknown organisation key "${o.org}"`);

    const id = crypto.randomUUID();
    opportunityIds.set(o.slug, id);

    await db.insert(s.opportunities).values({
      id,
      organizationId,
      title: o.title[0],
      titleBn: o.title[1],
      slug: o.slug,
      category: o.category,
      summary: o.summary[0],
      summaryBn: o.summary[1],
      description: o.description[0],
      descriptionBn: o.description[1],
      benefits: o.benefits[0],
      benefitsBn: o.benefits[1],
      benefitAmount: o.benefitAmount ?? null,
      benefitPeriod: o.benefitPeriod ?? null,
      applicationProcess: o.steps.map((step, index) => ({ step: index + 1, en: step[0], bn: step[1] })),
      deadline: o.deadlineInDays === undefined ? null : addDays(now, o.deadlineInDays),
      recurrence: o.recurrence ?? 'none',
      status: 'open',
      coverageDistricts: [...(o.coverage ?? [])],
      officialUrl: o.sourceUrl ?? null,
      applyUrl: o.applyUrl ?? null,
      processingTimeDays: o.processingTime?.[0] ?? null,
      renewalMonths: o.renewalMonths ?? null,
      lifeEvents: [...o.lifeEvents],
      tags: [...o.tags],
      viewCount: 0,
      saveCount: 0,
      applicationCount: 0,
      verificationStatus: 'unverified_sample',
      sourceUrl: o.sourceUrl ?? null,
      sourceNote: o.sourceNote?.[0] ?? null,
      lastVerifiedAt: null,
      verifiedBy: null,
      reviewIntervalDays: 180,
      version: 1,
    });

    await db.insert(s.eligibilityRules).values({
      opportunityId: id,
      ruleJson: o.rules,
      priority: 0,
      version: 1,
      active: true,
      authoredBy: 'seed',
      reviewedBy: null,
      reviewedAt: null,
    });

    if (o.docs.length > 0) {
      await db.insert(s.requiredDocuments).values(
        o.docs.map((doc, index) => ({
          opportunityId: id,
          name: doc.name[0],
          nameBn: doc.name[1],
          required: doc.required ?? true,
          issuingAuthority: doc.authority?.[0] ?? null,
          issuingAuthorityBn: doc.authority?.[1] ?? null,
          commonMistake: doc.mistake?.[0] ?? null,
          commonMistakeBn: doc.mistake?.[1] ?? null,
          tip: doc.tip?.[0] ?? null,
          tipBn: doc.tip?.[1] ?? null,
          validityMonths: doc.validityMonths ?? null,
          sortOrder: index,
        })),
      );
    }

    /* ---- retrieval document + chunks ----
       One synthetic document per programme, holding the full bilingual text.
       This is what the RAG layer cites, so it must contain everything the LLM
       is permitted to state: benefits, steps, and document requirements. */
    const documentId = crypto.randomUUID();
    const bodyEn = [
      `# ${o.title[0]}`,
      o.summary[0],
      o.description[0],
      `## Benefits\n${o.benefits[0]}`,
      `## How to apply\n${o.steps.map((st, i) => `${i + 1}. ${st[0]}`).join('\n')}`,
      `## Documents needed\n${o.docs.map((d) => `- ${d.name[0]}${d.required === false ? ' (optional)' : ''}`).join('\n')}`,
    ].join('\n\n');
    const bodyBn = [
      `# ${o.title[1]}`,
      o.summary[1],
      o.description[1],
      `## সুবিধা\n${o.benefits[1]}`,
      `## আবেদনের ধাপ\n${o.steps.map((st, i) => `${i + 1}. ${st[1]}`).join('\n')}`,
      `## প্রয়োজনীয় কাগজপত্র\n${o.docs.map((d) => `- ${d.name[1]}${d.required === false ? ' (ঐচ্ছিক)' : ''}`).join('\n')}`,
    ].join('\n\n');

    await db.insert(s.documents).values({
      id: documentId,
      opportunityId: id,
      organizationId,
      title: o.title[0],
      titleBn: o.title[1],
      sourceType: 'manual_entry',
      sourceUrl: o.sourceUrl ?? null,
      publisher: SEED_ORGANIZATIONS.find((x) => x.key === o.org)?.name[0] ?? null,
      publishedAt: null,
      retrievedAt: now,
      checksum: null,
      version: 1,
      licenseNote:
        'Authored summary of a publicly described government or NGO programme. Not a reproduction of an official circular.',
      textContent: `${bodyEn}\n\n---\n\n${bodyBn}`,
      embeddingStatus: 'skipped',
      verificationStatus: 'unverified_sample',
      stale: false,
      deadLink: false,
    });

    // Bangla and English chunks are stored separately so a Bangla query
    // retrieves Bangla text to cite, and vice versa.
    const chunks = [...chunkText(bodyEn), ...chunkText(bodyBn)];
    if (chunks.length > 0) {
      await db.insert(s.documentChunks).values(
        chunks.map((content, index) => ({
          documentId,
          opportunityId: id,
          chunkIndex: index,
          content,
          tokenCount: estimateTokens(content),
          embedding: null,
          embeddingModel: null,
          termFrequencies: termFrequencies(content),
          metadata: {
            slug: o.slug,
            category: o.category,
            title: o.title[0],
            titleBn: o.title[1],
          },
        })),
      );
      chunkCount += chunks.length;
    }
  }

  // ------------------------------------------------- knowledge graph
  console.log('  knowledge graph edges…');
  const edges: (typeof s.knowledgeGraphEdges.$inferInsert)[] = [];
  for (const o of SEED_OPPORTUNITIES) {
    const opportunityId = opportunityIds.get(o.slug)!;
    for (const event of o.lifeEvents) {
      edges.push({
        fromType: 'life_event', fromId: event, relation: 'triggers',
        toType: 'opportunity', toId: opportunityId, weight: 1,
      });
    }
    edges.push({
      fromType: 'opportunity', fromId: opportunityId, relation: 'offered_by',
      toType: 'organization', toId: orgIds.get(o.org)!, weight: 1,
    });
    edges.push({
      fromType: 'opportunity', fromId: opportunityId, relation: 'belongs_to',
      toType: 'category', toId: o.category, weight: 1,
    });
  }
  // Complementary programmes: same life event and same category pair up, which
  // is what lets the Opportunity Graph show an ecosystem rather than a list.
  for (const a of SEED_OPPORTUNITIES) {
    for (const b of SEED_OPPORTUNITIES) {
      if (a.slug >= b.slug) continue;
      const sharedEvents = a.lifeEvents.filter((e) => b.lifeEvents.includes(e));
      if (sharedEvents.length > 0 && a.category !== b.category) {
        edges.push({
          fromType: 'opportunity', fromId: opportunityIds.get(a.slug)!, relation: 'complements',
          toType: 'opportunity', toId: opportunityIds.get(b.slug)!,
          weight: sharedEvents.length,
          note: `Shared life events: ${sharedEvents.join(', ')}`,
        });
      }
    }
  }
  for (let i = 0; i < edges.length; i += 200) {
    await db.insert(s.knowledgeGraphEdges).values(edges.slice(i, i + 200));
  }

  // ------------------------------------------------------- locations
  console.log('  service locations…');
  const locationRows = SEED_LOCATIONS.map((l) => ({
    organizationId: l.orgKey ? (orgIds.get(l.orgKey) ?? null) : null,
    name: l.name[0],
    nameBn: l.name[1],
    type: l.type,
    address: l.address[0],
    addressBn: l.address[1],
    division: l.division,
    district: l.district,
    upazila: null,
    lat: l.lat,
    lng: l.lng,
    phone: l.phone ?? null,
    officeHours: l.officeHours[0],
    officeHoursBn: l.officeHours[1],
    services: [...l.services],
    verificationStatus: 'unverified_sample' as const,
  }));
  for (let i = 0; i < locationRows.length; i += 200) {
    await db.insert(s.serviceLocations).values(locationRows.slice(i, i + 200));
  }

  // ---------------------------------------------------- demo accounts
  const existingUsers = await db.select({ id: s.users.id }).from(s.users).limit(1);
  if (existingUsers.length === 0 || RESET_USERS) {
    console.log('  demo accounts…');
    const pinHash = await hashSecret('1234');
    const adminPinHash = await hashSecret('4321');

    const demo = [
      {
        phone: '01712345678', name: 'রহিমা বেগম', role: 'citizen' as const, district: 'rangpur',
        pinHash, language: 'bn' as const,
        profile: {
          statedAge: 58, gender: 'female' as const, maritalStatus: 'widowed' as const,
          occupation: 'homemaker' as const, monthlyIncome: 900, education: 'primary' as const,
          district: 'rangpur', division: 'rangpur', householdSize: 4, dependents: 3,
          landOwnershipDecimals: 8, hasNid: true, hasBankAccount: false, citizenship: 'bangladeshi',
          isStudent: false, hasDisability: false,
          lifeEvents: [{ event: 'widowhood', detectedAt: now.getTime(), source: 'profile' as const }],
        },
      },
      {
        phone: '01812345678', name: 'Tanvir Ahmed', role: 'citizen' as const, district: 'rajshahi',
        pinHash, language: 'en' as const,
        profile: {
          statedAge: 23, gender: 'male' as const, maritalStatus: 'single' as const,
          occupation: 'student' as const, monthlyIncome: 0, education: 'bachelor' as const,
          cgpa: 3.78, university: 'University of Rajshahi', department: 'Computer Science',
          district: 'rajshahi', division: 'rajshahi', householdSize: 5, dependents: 0,
          isStudent: true, hasNid: true, hasBankAccount: true, citizenship: 'bangladeshi',
          hasDisability: false, preferredCountry: 'Germany',
          lifeEvents: [{ event: 'higher_education', detectedAt: now.getTime(), source: 'profile' as const }],
        },
      },
      {
        phone: '01912345678', name: 'করিম মিয়া', role: 'citizen' as const, district: 'kurigram',
        pinHash, language: 'bn' as const,
        profile: {
          statedAge: 47, gender: 'male' as const, maritalStatus: 'married' as const,
          occupation: 'farmer' as const, monthlyIncome: 6500, education: 'jsc' as const,
          district: 'kurigram', division: 'rangpur', householdSize: 6, dependents: 4,
          landOwnershipDecimals: 65, farmSizeDecimals: 65, crops: ['rice', 'jute'],
          livestock: ['cattle'], hasNid: true, hasBankAccount: true, citizenship: 'bangladeshi',
          isStudent: false, hasDisability: false,
          lifeEvents: [{ event: 'crop_loss', detectedAt: now.getTime(), source: 'profile' as const }],
        },
      },
      {
        phone: '01612345678', name: 'AccessAI Moderator', role: 'moderator' as const,
        district: 'dhaka', pinHash: adminPinHash, language: 'en' as const, profile: null,
      },
      {
        phone: '01512345678', name: 'AccessAI Administrator', role: 'administrator' as const,
        district: 'dhaka', pinHash: adminPinHash, language: 'en' as const, profile: null,
      },
    ];

    for (const d of demo) {
      const userId = crypto.randomUUID();
      await db.insert(s.users).values({
        id: userId,
        phone: d.phone,
        name: d.name,
        role: d.role,
        status: 'active',
        language: d.language,
        district: d.district,
        pinHash: d.pinHash,
        phoneVerifiedAt: now,
      });
      await db.insert(s.userSettings).values({ userId, theme: 'light', textScale: 1, numeralSystem: 'latin' });
      if (d.profile) {
        await db.insert(s.userProfiles).values({ userId, ...d.profile, shareHealthData: false });
      }
    }
  } else {
    console.log('  demo accounts already present (pass --reset-users to recreate)');
  }

  // --------------------------------------------------------- summary
  const [orgCount] = await db.select({ n: s.sql<number>`count(*)` }).from(s.organizations);
  const [oppCount] = await db.select({ n: s.sql<number>`count(*)` }).from(s.opportunities);
  const [locCount] = await db.select({ n: s.sql<number>`count(*)` }).from(s.serviceLocations);
  const [edgeCount] = await db.select({ n: s.sql<number>`count(*)` }).from(s.knowledgeGraphEdges);

  console.log('\nSeed complete:');
  console.log(`  organisations       ${orgCount?.n ?? 0}`);
  console.log(`  programmes          ${oppCount?.n ?? 0}`);
  console.log(`  retrieval chunks    ${chunkCount}`);
  console.log(`  service locations   ${locCount?.n ?? 0}`);
  console.log(`  graph edges         ${edgeCount?.n ?? 0}`);
  console.log('\nDemo sign-in (phone + PIN):');
  console.log('  01712345678 / 1234  — Rahima Begum, widow, Rangpur (bn)');
  console.log('  01812345678 / 1234  — Tanvir Ahmed, student, Rajshahi (en)');
  console.log('  01912345678 / 1234  — Karim Mia, farmer, Kurigram (bn)');
  console.log('  01612345678 / 4321  — Moderator');
  console.log('  01512345678 / 4321  — Administrator');
  console.log('\nEvery programme is flagged "unverified_sample". See docs/DEVIATIONS.md §2.\n');
}

main()
  .then(() => sqlClient.close())
  .catch((error) => {
    console.error('\nSeed failed:', error);
    sqlClient.close();
    process.exit(1);
  });
