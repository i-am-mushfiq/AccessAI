import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  budgetAllocations, escalations, issues, beneficiaries, entitlements, disbursements,
  unionBoundaries, users, userProfiles, donorOrganizations, donorFundingScopes,
} from '@/lib/db/schema';
import type { Anomaly } from './anomaly';
import {
  detectAllocationOutliers, detectStaleEscalations, detectDuplicateBeneficiaryEnrolment,
  detectUnverifiedBeneficiaryIdentity, detectOverpaidDisbursements,
} from './anomaly';
import { verifyLedgerChain } from '@/modules/ledger/ledger.service';

/**
 * SJ-25/29 — a chairman's scope is one union; an upazila/zila officer's is
 * every union under them. Resolving the scope to a concrete list of union
 * ids in one place means every query below is written once and works for
 * both — the rollup IS the single-union view with more rows, not a
 * different code path.
 */
export type OversightScope =
  | { readonly kind: 'union'; readonly unionId: string }
  | { readonly kind: 'upazila'; readonly upazila: string }
  | { readonly kind: 'district'; readonly district: string };

async function resolveUnionIds(scope: OversightScope): Promise<string[]> {
  if (scope.kind === 'union') return [scope.unionId];
  const column = scope.kind === 'upazila' ? unionBoundaries.upazila : unionBoundaries.district;
  const value = scope.kind === 'upazila' ? scope.upazila : scope.district;
  const rows = await db.select({ id: unionBoundaries.id }).from(unionBoundaries).where(eq(column, value));
  return rows.map((r) => r.id);
}

function tally<T extends string>(values: readonly T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

/** SJ-25/28/29 — the Leader Portal's data, scoped to one union or a whole upazila/district rollup. */
export async function getLeaderPortalData(scope: OversightScope) {
  const unionIds = await resolveUnionIds(scope);
  if (unionIds.length === 0) {
    return {
      unions: [],
      allocations: { total: 0, sum: 0, flagged: 0, escalated: 0 },
      issues: { total: 0, byStatus: {} as Record<string, number> },
      beneficiaries: { total: 0, disbursedPaid: 0, disbursedScheduled: 0 },
      anomalies: [] as Anomaly[],
    };
  }

  const unions = await db.select().from(unionBoundaries).where(inArray(unionBoundaries.id, unionIds));
  const allocationRows = await db.select().from(budgetAllocations).where(inArray(budgetAllocations.unionId, unionIds));
  const issueRows = await db.select({ status: issues.status }).from(issues).where(inArray(issues.unionId, unionIds));
  const beneficiaryRows = await db.select().from(beneficiaries).where(inArray(beneficiaries.unionId, unionIds));

  const beneficiaryIds = beneficiaryRows.map((b) => b.id);
  const entitlementRows = beneficiaryIds.length
    ? await db.select().from(entitlements).where(inArray(entitlements.beneficiaryId, beneficiaryIds))
    : [];
  const entitlementIds = entitlementRows.map((e) => e.id);
  const disbursementRows = entitlementIds.length
    ? await db.select().from(disbursements).where(inArray(disbursements.entitlementId, entitlementIds))
    : [];
  const allocationIds = allocationRows.map((a) => a.id);
  const escalationRows = allocationIds.length
    ? await db.select().from(escalations).where(inArray(escalations.allocationId, allocationIds))
    : [];

  const unionNameById = new Map(unions.map((u) => [u.id, u.name] as const));
  const allocationById = new Map(allocationRows.map((a) => [a.id, a] as const));
  const entitlementById = new Map(entitlementRows.map((e) => [e.id, e] as const));
  const beneficiaryById = new Map(beneficiaryRows.map((b) => [b.id, b] as const));

  const now = new Date();
  const verifiedNidHashes = await getVerifiedNidHashes();
  const anomalies: Anomaly[] = [
    ...detectAllocationOutliers(allocationRows.map((a) => ({ id: a.id, unionId: a.unionId, amount: a.amount, projectName: a.projectName }))),
    ...detectStaleEscalations(
      escalationRows.map((e) => ({
        id: e.id,
        status: e.status,
        createdAt: e.createdAt,
        unionName: unionNameById.get(allocationById.get(e.allocationId)?.unionId ?? '') ?? 'this union',
      })),
      now,
    ),
    ...detectDuplicateBeneficiaryEnrolment(beneficiaryRows.map((b) => ({ id: b.id, nidHash: b.nidHash, unionId: b.unionId, programCode: b.programCode, status: b.status }))),
    ...detectOverpaidDisbursements(
      disbursementRows
        .map((d) => {
          const entitlement = entitlementById.get(d.entitlementId);
          if (!entitlement) return null;
          const beneficiary = beneficiaryById.get(entitlement.beneficiaryId);
          return { id: d.id, amount: d.amount, entitlementAmount: entitlement.amount, programName: beneficiary?.programName ?? 'programme' };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    ),
    // SJ-19 — was previously exported as a standalone function nobody ever
    // called; folded into the same anomalies list every other check already
    // reaches, so it actually reaches the Leader Portal a chairman/officer
    // looks at instead of existing only as unit-tested, unreachable code.
    ...detectUnverifiedBeneficiaryIdentity(
      beneficiaryRows.map((b) => ({ id: b.id, nidHash: b.nidHash, programName: b.programName, status: b.status })),
      verifiedNidHashes,
    ),
  ];

  return {
    unions: unions.map((u) => ({ id: u.id, name: u.name, nameBn: u.nameBn })),
    allocations: {
      total: allocationRows.length,
      sum: allocationRows.reduce((s, a) => s + a.amount, 0),
      flagged: allocationRows.filter((a) => a.flagCount > 0).length,
      escalated: allocationRows.filter((a) => a.escalated).length,
    },
    issues: {
      total: issueRows.length,
      byStatus: tally(issueRows.map((r) => r.status)),
    },
    beneficiaries: {
      total: beneficiaryRows.length,
      disbursedPaid: disbursementRows.filter((d) => d.status === 'paid').reduce((s, d) => s + d.amount, 0),
      disbursedScheduled: disbursementRows.filter((d) => d.status === 'scheduled').reduce((s, d) => s + d.amount, 0),
    },
    anomalies,
  };
}

/**
 * SJ-27 — scoped to exactly the program codes this donor funds, never the
 * whole ledger. A donor with no funding scopes configured sees nothing,
 * not everything — the safe failure direction for "scoped access".
 */
export async function getDonorPortalData(donorOrgId: string) {
  const [org] = await db.select().from(donorOrganizations).where(eq(donorOrganizations.id, donorOrgId)).limit(1);
  const scopes = await db.select().from(donorFundingScopes).where(eq(donorFundingScopes.donorOrgId, donorOrgId));
  const programCodes = scopes.map((s) => s.programCode);

  if (!org || programCodes.length === 0) {
    return { org: org ?? null, programs: [] as Array<{ programCode: string; programName: string; beneficiaries: number; unions: number; disbursedPaid: number; disbursedScheduled: number }> };
  }

  const beneficiaryRows = await db.select().from(beneficiaries).where(inArray(beneficiaries.programCode, programCodes));
  const beneficiaryIds = beneficiaryRows.map((b) => b.id);
  const entitlementRows = beneficiaryIds.length
    ? await db.select().from(entitlements).where(inArray(entitlements.beneficiaryId, beneficiaryIds))
    : [];
  const entitlementIds = entitlementRows.map((e) => e.id);
  const disbursementRows = entitlementIds.length
    ? await db.select().from(disbursements).where(inArray(disbursements.entitlementId, entitlementIds))
    : [];

  const programs = programCodes.map((code) => {
    const codeBeneficiaries = beneficiaryRows.filter((b) => b.programCode === code);
    const codeBeneficiaryIds = new Set(codeBeneficiaries.map((b) => b.id));
    const codeEntitlementIds = new Set(entitlementRows.filter((e) => codeBeneficiaryIds.has(e.beneficiaryId)).map((e) => e.id));
    const codeDisbursements = disbursementRows.filter((d) => codeEntitlementIds.has(d.entitlementId));
    return {
      programCode: code,
      programName: codeBeneficiaries[0]?.programName ?? code,
      beneficiaries: codeBeneficiaries.length,
      unions: new Set(codeBeneficiaries.map((b) => b.unionId)).size,
      disbursedPaid: codeDisbursements.filter((d) => d.status === 'paid').reduce((s, d) => s + d.amount, 0),
      disbursedScheduled: codeDisbursements.filter((d) => d.status === 'scheduled').reduce((s, d) => s + d.amount, 0),
    };
  });

  return { org, programs };
}

/**
 * SJ-37 — the public transparency surface. Every field here is deliberately
 * PII-safe: aggregate counts and amounts, elected officials' names (public by
 * the nature of the office — the whole point of transparency), never a
 * citizen's name, NID, phone, or the free-text body of a flag or complaint.
 */
export async function getPublicTransparencyData() {
  const unions = await db.select().from(unionBoundaries);
  const allocationRows = await db.select().from(budgetAllocations);
  const chairmen = await db
    .select({ name: users.name, unionId: users.civicUnionId })
    .from(users)
    .where(eq(users.civicRole, 'union_chairman'));
  const beneficiaryRows = await db.select({ id: beneficiaries.id, programCode: beneficiaries.programCode, programName: beneficiaries.programName, unionId: beneficiaries.unionId, status: beneficiaries.status }).from(beneficiaries);
  const beneficiaryIds = beneficiaryRows.map((b) => b.id);
  const entitlementRows = beneficiaryIds.length
    ? await db.select().from(entitlements).where(inArray(entitlements.beneficiaryId, beneficiaryIds))
    : [];
  const entitlementIds = entitlementRows.map((e) => e.id);
  const disbursementRows = entitlementIds.length
    ? await db.select({ id: disbursements.id, entitlementId: disbursements.entitlementId, amount: disbursements.amount, status: disbursements.status }).from(disbursements).where(inArray(disbursements.entitlementId, entitlementIds))
    : [];
  const issueRows = await db.select({ status: issues.status }).from(issues);
  const ledger = await verifyLedgerChain();

  const chairmanByUnion = new Map(chairmen.filter((c) => c.unionId).map((c) => [c.unionId as string, c.name] as const));

  const unionSummaries = unions.map((u) => {
    const allocationsForUnion = allocationRows.filter((a) => a.unionId === u.id);
    return {
      name: u.name,
      nameBn: u.nameBn,
      district: u.district,
      upazila: u.upazila,
      chairman: chairmanByUnion.get(u.id) ?? null,
      allocationCount: allocationsForUnion.length,
      allocationTotal: allocationsForUnion.reduce((s, a) => s + a.amount, 0),
      flaggedCount: allocationsForUnion.filter((a) => a.flagCount > 0).length,
      escalatedCount: allocationsForUnion.filter((a) => a.escalated).length,
    };
  });

  const programCodes = [...new Set(beneficiaryRows.map((b) => b.programCode))];
  const entitlementById = new Map(entitlementRows.map((e) => [e.id, e] as const));
  const programSummaries = programCodes.map((code) => {
    const codeBeneficiaries = beneficiaryRows.filter((b) => b.programCode === code && b.status === 'active');
    const codeBeneficiaryIds = new Set(codeBeneficiaries.map((b) => b.id));
    const codeDisbursements = disbursementRows.filter((d) => {
      const entitlement = entitlementById.get(d.entitlementId);
      return entitlement ? codeBeneficiaryIds.has(entitlement.beneficiaryId) : false;
    });
    return {
      programCode: code,
      programName: codeBeneficiaries[0]?.programName ?? code,
      activeBeneficiaries: codeBeneficiaries.length,
      disbursedPaid: codeDisbursements.filter((d) => d.status === 'paid').reduce((s, d) => s + d.amount, 0),
    };
  });

  return {
    unions: unionSummaries,
    programs: programSummaries,
    issues: { total: issueRows.length, byStatus: tally(issueRows.map((r) => r.status)) },
    ledgerIntegrity: { intact: ledger.intact, checked: ledger.checked },
    generatedAt: new Date().toISOString(),
  };
}

/** Referenced by identity-adjacent flows that need "has anyone verified this NID" without exposing whose. */
export async function getVerifiedNidHashes(): Promise<Set<string>> {
  const rows = await db
    .select({ hash: userProfiles.nidNumberHash })
    .from(userProfiles)
    .where(inArray(userProfiles.nidVerificationStatus, ['verified', 'simulated_verified']));
  return new Set(rows.map((r) => r.hash).filter((h): h is string => Boolean(h)));
}

