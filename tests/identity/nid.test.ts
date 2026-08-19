import { describe, it, expect } from 'vitest';
import { verifyNid, normaliseNidNumber } from '@/modules/identity/nid.service';

describe('normaliseNidNumber', () => {
  it('strips everything but digits', () => {
    expect(normaliseNidNumber('1234 5678 90')).toBe('1234567890');
    expect(normaliseNidNumber('12-345-6789-0')).toBe('1234567890');
  });
});

describe('verifyNid', () => {
  it('accepts a 10-digit number as simulated-verified, with a hash', async () => {
    const result = await verifyNid('1234567890');
    expect(result.status).toBe('simulated_verified');
    expect(result.hash).toBeTruthy();
    expect(result.hash).not.toContain('1234567890');
  });

  it('accepts 13- and 17-digit numbers', async () => {
    expect((await verifyNid('1'.repeat(13))).status).toBe('simulated_verified');
    expect((await verifyNid('1'.repeat(17))).status).toBe('simulated_verified');
  });

  it('rejects a number of the wrong length', async () => {
    const result = await verifyNid('12345');
    expect(result.status).toBe('rejected');
    expect(result.hash).toBeNull();
    expect(result.reason).toBeTruthy();
  });

  it('produces the same hash for the same number, deterministically', async () => {
    const a = await verifyNid('9876543210');
    const b = await verifyNid('9876543210');
    expect(a.hash).toBe(b.hash);
  });

  it('produces a different hash for a different number', async () => {
    const a = await verifyNid('1111111111');
    const b = await verifyNid('2222222222');
    expect(a.hash).not.toBe(b.hash);
  });
});
