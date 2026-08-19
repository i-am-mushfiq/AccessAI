import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userProfiles, unionBoundaries } from '@/lib/db/schema';
import type { UserProfile } from '@/lib/db/schema';
import { verifyNid } from './nid.service';
import { findUnionForPoint, listUnions } from './geofence';

/**
 * Identity & residency verification — Phase 1.
 *
 * Nothing downstream (posting an issue, voting, receiving a disbursement)
 * means anything without this: a citizen's NID and their verified union are
 * the precondition the whole "Amar Union, Amar Sheba" module depends on.
 */

/** Mirrors the upsert-or-insert shape already used in api/v1/users/profile. */
async function upsertProfilePatch(
  userId: string,
  patch: Partial<typeof userProfiles.$inferInsert>,
): Promise<UserProfile> {
  const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);

  if (existing) {
    const [updated] = await db
      .update(userProfiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated!;
  }

  const [inserted] = await db.insert(userProfiles).values({ userId, ...patch }).returning();
  return inserted!;
}

export interface IdentityStatus {
  readonly nidVerificationStatus: UserProfile['nidVerificationStatus'] | 'unverified';
  readonly nidVerifiedAt: Date | null;
  readonly residencyUnionId: string | null;
  readonly residencyVerificationMethod: UserProfile['residencyVerificationMethod'] | null;
  readonly residencyVerifiedAt: Date | null;
  readonly union: { readonly id: string; readonly name: string; readonly nameBn: string } | null;
}

export async function getIdentityStatus(userId: string): Promise<IdentityStatus> {
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);

  if (!profile) {
    return {
      nidVerificationStatus: 'unverified',
      nidVerifiedAt: null,
      residencyUnionId: null,
      residencyVerificationMethod: null,
      residencyVerifiedAt: null,
      union: null,
    };
  }

  let union = null;
  if (profile.residencyUnionId) {
    const [row] = await db
      .select({ id: unionBoundaries.id, name: unionBoundaries.name, nameBn: unionBoundaries.nameBn })
      .from(unionBoundaries)
      .where(eq(unionBoundaries.id, profile.residencyUnionId))
      .limit(1);
    union = row ?? null;
  }

  return {
    nidVerificationStatus: profile.nidVerificationStatus,
    nidVerifiedAt: profile.nidVerifiedAt,
    residencyUnionId: profile.residencyUnionId,
    residencyVerificationMethod: profile.residencyVerificationMethod,
    residencyVerifiedAt: profile.residencyVerifiedAt,
    union,
  };
}

export interface NidSubmissionResult {
  readonly accepted: boolean;
  readonly status: UserProfile['nidVerificationStatus'];
  readonly reason: string | null;
}

export async function submitNidVerification(userId: string, nidNumber: string): Promise<NidSubmissionResult> {
  const result = await verifyNid(nidNumber);

  if (result.status === 'rejected') {
    await upsertProfilePatch(userId, { nidVerificationStatus: 'rejected', nidNumberHash: null, nidVerifiedAt: null });
    return { accepted: false, status: 'rejected', reason: result.reason };
  }

  await upsertProfilePatch(userId, {
    nidVerificationStatus: result.status,
    nidNumberHash: result.hash,
    nidVerifiedAt: new Date(),
  });
  return { accepted: true, status: result.status, reason: null };
}

export interface ResidencySubmissionInput {
  readonly userId: string;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly unionId?: string | null;
}

export interface ResidencySubmissionResult {
  readonly matched: boolean;
  readonly union: { readonly id: string; readonly name: string; readonly nameBn: string } | null;
  readonly method: 'gps_geofence' | 'manual_attestation' | null;
}

/**
 * A GPS fix that lands inside a real boundary is the strong path. Picking a
 * union from a list is accepted too — it is how a citizen with location
 * services off, or a genuinely borderline address, still gets scoped — but it
 * is recorded as `manual_attestation`, and the UI must show that difference
 * rather than presenting both as equally verified.
 */
export async function submitResidencyVerification(
  input: ResidencySubmissionInput,
): Promise<ResidencySubmissionResult> {
  if (input.lat != null && input.lng != null) {
    const match = await findUnionForPoint(input.lat, input.lng);
    if (match) {
      await upsertProfilePatch(input.userId, {
        residencyUnionId: match.id,
        residencyVerificationMethod: 'gps_geofence',
        residencyVerifiedAt: new Date(),
        residencyLat: input.lat,
        residencyLng: input.lng,
      });
      return { matched: true, union: { id: match.id, name: match.name, nameBn: match.nameBn }, method: 'gps_geofence' };
    }
  }

  if (input.unionId) {
    const [union] = await db
      .select({ id: unionBoundaries.id, name: unionBoundaries.name, nameBn: unionBoundaries.nameBn })
      .from(unionBoundaries)
      .where(eq(unionBoundaries.id, input.unionId))
      .limit(1);
    if (!union) return { matched: false, union: null, method: null };

    await upsertProfilePatch(input.userId, {
      residencyUnionId: union.id,
      residencyVerificationMethod: 'manual_attestation',
      residencyVerifiedAt: new Date(),
      residencyLat: input.lat ?? null,
      residencyLng: input.lng ?? null,
    });
    return { matched: true, union, method: 'manual_attestation' };
  }

  // A GPS fix that landed inside no known union — the corpus is a handful of
  // authored samples, not national coverage. Told plainly rather than
  // silently falling back to a guess.
  return { matched: false, union: null, method: null };
}

export { listUnions };
