import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { beneficiaries, entitlements, disbursements, userProfiles } from '@/lib/db/schema';
import type { EntitlementPeriod } from '@/lib/domain/enums';
import { normaliseNidNumber } from '@/modules/identity/nid.service';
import { fastHash } from '@/lib/security/hash';
import { appendLedgerEntry } from '@/modules/ledger/ledger.service';

/**
 * SJ-15/BR-2 — "the real entitlement-status check." Deliberately a separate
 * module from modules/eligibility/engine.ts: that engine answers "what could
 * I newly qualify for," evaluated against sample programme rules against a
 * self-described profile. This answers a different question — "what am I
 * already enrolled in, and what has actually been paid" — against a
 * beneficiary record someone with authority actually created. Neither module
 * can stand in for the other; see docs/DEVIATIONS.md.
 */

export interface EntitlementStatusResult {
  readonly enrolled: boolean;
  readonly reason?: 'nid_not_verified' | 'not_enrolled';
  readonly beneficiary?: {
    readonly programCode: string;
    readonly programName: string;
    readonly programNameBn: string;
    readonly status: string;
  };
  readonly entitlements?: readonly {
    readonly id: string;
    readonly amount: number;
    readonly period: string;
    readonly status: string;
    readonly disbursements: readonly {
      readonly id: string;
      readonly amount: number;
      readonly scheduledFor: string;
      readonly paidAt: string | null;
      readonly status: string;
    }[];
  }[];
}

/** Matched by the SAME hash Phase 1's NID verification produces — never the raw number. */
export async function checkMyEntitlementStatus(userId: string): Promise<EntitlementStatusResult> {
  const [profile] = await db
    .select({ nidHash: userProfiles.nidNumberHash, nidStatus: userProfiles.nidVerificationStatus })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!profile?.nidHash || (profile.nidStatus !== 'simulated_verified' && profile.nidStatus !== 'verified')) {
    return { enrolled: false, reason: 'nid_not_verified' };
  }

  const [beneficiary] = await db.select().from(beneficiaries).where(eq(beneficiaries.nidHash, profile.nidHash)).limit(1);
  if (!beneficiary) return { enrolled: false, reason: 'not_enrolled' };

  const entitlementRows = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.beneficiaryId, beneficiary.id))
    .orderBy(asc(entitlements.createdAt));

  const withDisbursements = await Promise.all(
    entitlementRows.map(async (e) => {
      const disb = await db
        .select()
        .from(disbursements)
        .where(eq(disbursements.entitlementId, e.id))
        .orderBy(asc(disbursements.scheduledFor));
      return {
        id: e.id,
        amount: e.amount,
        period: e.period,
        status: e.status,
        disbursements: disb.map((d) => ({
          id: d.id,
          amount: d.amount,
          scheduledFor: d.scheduledFor.toISOString(),
          paidAt: d.paidAt ? d.paidAt.toISOString() : null,
          status: d.status,
        })),
      };
    }),
  );

  return {
    enrolled: true,
    beneficiary: {
      programCode: beneficiary.programCode,
      programName: beneficiary.programName,
      programNameBn: beneficiary.programNameBn,
      status: beneficiary.status,
    },
    entitlements: withDisbursements,
  };
}

export interface EnrollBeneficiaryInput {
  readonly nidNumber: string;
  readonly unionId: string;
  readonly programCode: string;
  readonly programName: string;
  readonly programNameBn: string;
  readonly enrolledBy: string;
  readonly amount: number;
  readonly period: EntitlementPeriod;
}

/** Union chairman/staff enrolling a beneficiary — creates the entitlement in the same step. */
export async function enrollBeneficiary(input: EnrollBeneficiaryInput) {
  const nidHash = fastHash(`nid:${normaliseNidNumber(input.nidNumber)}`);

  const existingUser = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.nidNumberHash, nidHash))
    .limit(1);

  const [beneficiary] = await db
    .insert(beneficiaries)
    .values({
      userId: existingUser[0]?.userId ?? null,
      nidHash,
      unionId: input.unionId,
      programCode: input.programCode,
      programName: input.programName,
      programNameBn: input.programNameBn,
      status: 'active',
      enrolledBy: input.enrolledBy,
    })
    .returning();

  const [entitlement] = await db
    .insert(entitlements)
    .values({ beneficiaryId: beneficiary!.id, amount: input.amount, period: input.period, status: 'active' })
    .returning();

  return { beneficiary: beneficiary!, entitlement: entitlement! };
}

export interface RecordDisbursementInput {
  readonly entitlementId: string;
  readonly amount: number;
  readonly scheduledFor: Date;
  readonly status: 'scheduled' | 'paid' | 'failed' | 'on_hold';
  readonly recordedBy: string;
}

/** Anchored into the same financial ledger as budget allocations (SJ-14). */
export async function recordDisbursement(input: RecordDisbursementInput) {
  const [row] = await db
    .insert(disbursements)
    .values({
      entitlementId: input.entitlementId,
      amount: input.amount,
      scheduledFor: input.scheduledFor,
      paidAt: input.status === 'paid' ? new Date() : null,
      status: input.status,
      recordedBy: input.recordedBy,
    })
    .returning();

  await appendLedgerEntry('disbursement', row!.id, {
    entitlementId: row!.entitlementId,
    amount: row!.amount,
    status: row!.status,
    scheduledFor: row!.scheduledFor.toISOString(),
    recordedBy: row!.recordedBy,
  });

  return row!;
}

export async function listBeneficiariesForUnion(unionId: string) {
  return db
    .select()
    .from(beneficiaries)
    .where(and(eq(beneficiaries.unionId, unionId)))
    .orderBy(asc(beneficiaries.createdAt));
}
