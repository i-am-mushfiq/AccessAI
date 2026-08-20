import { CIVIC_ROLE_RANK, type CivicRole } from '@/lib/domain/enums';

/**
 * Phase 3 civic authorisation — SJ-31–34.
 *
 * Deliberately NOT a rank comparison like `ROLE_RANK` in lib/http/session.ts.
 * A Zila officer is not "senior enough" to post a budget allocation for a
 * union they do not chair — civic authority is about WHICH title someone
 * holds AND for WHICH place, not a single ladder. Every check below takes
 * both.
 */

export interface CivicSubject {
  readonly civicRole: CivicRole;
  readonly civicUnionId: string | null;
  readonly civicUpazila: string | null;
  readonly civicDistrict: string | null;
}

/** Chairman or union staff may act on behalf of their own union (BRD: "Union
 *  Office Staff supports chairman with... data entry"). */
export function isUnionOfficialOf(user: CivicSubject, unionId: string): boolean {
  return (user.civicRole === 'union_chairman' || user.civicRole === 'union_staff') && user.civicUnionId === unionId;
}

export function isChairmanOf(user: CivicSubject, unionId: string): boolean {
  return user.civicRole === 'union_chairman' && user.civicUnionId === unionId;
}

export function isUpazilaOfficerFor(user: CivicSubject, upazila: string): boolean {
  return user.civicRole === 'upazila_officer' && user.civicUpazila === upazila;
}

export function isZilaOfficerFor(user: CivicSubject, district: string): boolean {
  return user.civicRole === 'zila_officer' && user.civicDistrict === district;
}

/** Nominal seniority, for display and sorting only — never an authorisation check. */
export function civicRoleAtLeast(role: CivicRole, minimum: CivicRole): boolean {
  return CIVIC_ROLE_RANK[role] >= CIVIC_ROLE_RANK[minimum];
}
