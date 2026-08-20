import { describe, it, expect } from 'vitest';
import { isUnionOfficialOf, isChairmanOf, isUpazilaOfficerFor, isZilaOfficerFor, civicRoleAtLeast } from '@/modules/civic/roles';

const chairmanOfA = { civicRole: 'union_chairman' as const, civicUnionId: 'union-a', civicUpazila: null, civicDistrict: null };
const staffOfA = { civicRole: 'union_staff' as const, civicUnionId: 'union-a', civicUpazila: null, civicDistrict: null };
const chairmanOfB = { civicRole: 'union_chairman' as const, civicUnionId: 'union-b', civicUpazila: null, civicDistrict: null };
const upazilaOfficer = { civicRole: 'upazila_officer' as const, civicUnionId: null, civicUpazila: 'Rangpur Sadar', civicDistrict: null };
const zilaOfficer = { civicRole: 'zila_officer' as const, civicUnionId: null, civicUpazila: null, civicDistrict: 'rangpur' };
const plainCitizen = { civicRole: 'none' as const, civicUnionId: null, civicUpazila: null, civicDistrict: null };

describe('isChairmanOf / isUnionOfficialOf', () => {
  it('recognises the chairman of their own union', () => {
    expect(isChairmanOf(chairmanOfA, 'union-a')).toBe(true);
    expect(isUnionOfficialOf(chairmanOfA, 'union-a')).toBe(true);
  });

  it('recognises union staff as an official but not a chairman', () => {
    expect(isUnionOfficialOf(staffOfA, 'union-a')).toBe(true);
    expect(isChairmanOf(staffOfA, 'union-a')).toBe(false);
  });

  it('refuses a chairman acting for a union that is not theirs', () => {
    expect(isChairmanOf(chairmanOfB, 'union-a')).toBe(false);
    expect(isUnionOfficialOf(chairmanOfB, 'union-a')).toBe(false);
  });

  it('a Zila officer is not a union official merely by outranking one', () => {
    // The whole point of scope-based checks: seniority does not substitute for the right title+place.
    expect(isUnionOfficialOf(zilaOfficer, 'union-a')).toBe(false);
  });
});

describe('isUpazilaOfficerFor / isZilaOfficerFor', () => {
  it('matches the officer to their assigned upazila/district only', () => {
    expect(isUpazilaOfficerFor(upazilaOfficer, 'Rangpur Sadar')).toBe(true);
    expect(isUpazilaOfficerFor(upazilaOfficer, 'Paba')).toBe(false);
    expect(isZilaOfficerFor(zilaOfficer, 'rangpur')).toBe(true);
    expect(isZilaOfficerFor(zilaOfficer, 'rajshahi')).toBe(false);
  });

  it('a plain citizen holds no civic authority anywhere', () => {
    expect(isUnionOfficialOf(plainCitizen, 'union-a')).toBe(false);
    expect(isUpazilaOfficerFor(plainCitizen, 'Rangpur Sadar')).toBe(false);
    expect(isZilaOfficerFor(plainCitizen, 'rangpur')).toBe(false);
  });
});

describe('civicRoleAtLeast', () => {
  it('orders titles by nominal seniority only', () => {
    expect(civicRoleAtLeast('zila_officer', 'union_chairman')).toBe(true);
    expect(civicRoleAtLeast('union_staff', 'union_chairman')).toBe(false);
    expect(civicRoleAtLeast('none', 'union_staff')).toBe(false);
  });
});
