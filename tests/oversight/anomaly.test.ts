import { describe, it, expect } from 'vitest';
import {
  detectAllocationOutliers,
  detectDuplicateBeneficiaryEnrolment,
  detectUnverifiedBeneficiaryIdentity,
  detectOverpaidDisbursements,
  detectStaleEscalations,
} from '@/modules/oversight/anomaly';

describe('detectAllocationOutliers', () => {
  it('flags an allocation far above its union\'s median', () => {
    const rows = [
      { id: 'a1', unionId: 'u1', amount: 50_000, projectName: 'Road repair' },
      { id: 'a2', unionId: 'u1', amount: 55_000, projectName: 'Culvert' },
      { id: 'a3', unionId: 'u1', amount: 60_000, projectName: 'Drainage' },
      { id: 'a4', unionId: 'u1', amount: 1_000_000, projectName: 'Suspicious project' },
    ];
    const result = detectAllocationOutliers(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.refIds).toEqual(['a4']);
  });

  it('says nothing when there are too few comparisons to be meaningful', () => {
    const rows = [
      { id: 'a1', unionId: 'u1', amount: 50_000, projectName: 'Road repair' },
      { id: 'a2', unionId: 'u1', amount: 1_000_000, projectName: 'Big one' },
    ];
    expect(detectAllocationOutliers(rows)).toEqual([]);
  });

  it('does not flag ordinary variation', () => {
    const rows = [
      { id: 'a1', unionId: 'u1', amount: 50_000, projectName: 'A' },
      { id: 'a2', unionId: 'u1', amount: 60_000, projectName: 'B' },
      { id: 'a3', unionId: 'u1', amount: 70_000, projectName: 'C' },
    ];
    expect(detectAllocationOutliers(rows)).toEqual([]);
  });

  it('compares within a union only, not across unions', () => {
    const rows = [
      { id: 'a1', unionId: 'u1', amount: 500_000, projectName: 'Big union project' },
      { id: 'a2', unionId: 'u1', amount: 480_000, projectName: 'Also big' },
      { id: 'a3', unionId: 'u1', amount: 520_000, projectName: 'Big too' },
      { id: 'b1', unionId: 'u2', amount: 10_000, projectName: 'Small union project' },
      { id: 'b2', unionId: 'u2', amount: 12_000, projectName: 'Small too' },
      { id: 'b3', unionId: 'u2', amount: 11_000, projectName: 'Small three' },
    ];
    expect(detectAllocationOutliers(rows)).toEqual([]);
  });
});

describe('detectDuplicateBeneficiaryEnrolment', () => {
  it('flags the same NID active in the same program across two unions', () => {
    const rows = [
      { id: 'b1', nidHash: 'hash-1', unionId: 'u1', programCode: 'widow-allowance', status: 'active' },
      { id: 'b2', nidHash: 'hash-1', unionId: 'u2', programCode: 'widow-allowance', status: 'active' },
    ];
    const result = detectDuplicateBeneficiaryEnrolment(rows);
    expect(result).toHaveLength(1);
    expect([...result[0]!.refIds].sort()).toEqual(['b1', 'b2']);
  });

  it('does not flag the same NID in different programs', () => {
    const rows = [
      { id: 'b1', nidHash: 'hash-1', unionId: 'u1', programCode: 'widow-allowance', status: 'active' },
      { id: 'b2', nidHash: 'hash-1', unionId: 'u2', programCode: 'elderly-allowance', status: 'active' },
    ];
    expect(detectDuplicateBeneficiaryEnrolment(rows)).toEqual([]);
  });

  it('ignores inactive enrolments', () => {
    const rows = [
      { id: 'b1', nidHash: 'hash-1', unionId: 'u1', programCode: 'widow-allowance', status: 'inactive' },
      { id: 'b2', nidHash: 'hash-1', unionId: 'u2', programCode: 'widow-allowance', status: 'active' },
    ];
    expect(detectDuplicateBeneficiaryEnrolment(rows)).toEqual([]);
  });
});

describe('detectUnverifiedBeneficiaryIdentity', () => {
  it('flags a beneficiary whose NID nobody has verified', () => {
    const rows = [{ id: 'b1', nidHash: 'unverified-hash', programName: 'Widow Allowance', status: 'active' }];
    const result = detectUnverifiedBeneficiaryIdentity(rows, new Set(['other-hash']));
    expect(result).toHaveLength(1);
  });

  it('does not flag a beneficiary whose NID is verified', () => {
    const rows = [{ id: 'b1', nidHash: 'verified-hash', programName: 'Widow Allowance', status: 'active' }];
    expect(detectUnverifiedBeneficiaryIdentity(rows, new Set(['verified-hash']))).toEqual([]);
  });
});

describe('detectOverpaidDisbursements', () => {
  it('flags a disbursement exceeding its entitlement amount', () => {
    const rows = [{ id: 'd1', amount: 1000, entitlementAmount: 650, programName: 'Widow Allowance' }];
    expect(detectOverpaidDisbursements(rows)).toHaveLength(1);
  });

  it('does not flag an exact or under payment', () => {
    const rows = [
      { id: 'd1', amount: 650, entitlementAmount: 650, programName: 'X' },
      { id: 'd2', amount: 400, entitlementAmount: 650, programName: 'X' },
    ];
    expect(detectOverpaidDisbursements(rows)).toEqual([]);
  });
});

describe('detectStaleEscalations', () => {
  const now = new Date('2026-08-20T00:00:00.000Z');

  it('flags a pending escalation older than the threshold', () => {
    const rows = [{ id: 'e1', status: 'pending', createdAt: new Date('2026-08-01T00:00:00.000Z'), unionName: 'Kaligonj' }];
    expect(detectStaleEscalations(rows, now, 14)).toHaveLength(1);
  });

  it('does not flag a recent pending escalation', () => {
    const rows = [{ id: 'e1', status: 'pending', createdAt: new Date('2026-08-18T00:00:00.000Z'), unionName: 'Kaligonj' }];
    expect(detectStaleEscalations(rows, now, 14)).toEqual([]);
  });

  it('does not flag a resolved escalation regardless of age', () => {
    const rows = [{ id: 'e1', status: 'resolved', createdAt: new Date('2026-01-01T00:00:00.000Z'), unionName: 'Kaligonj' }];
    expect(detectStaleEscalations(rows, now, 14)).toEqual([]);
  });
});
