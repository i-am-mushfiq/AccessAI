import { describe, it, expect } from 'vitest';
import { stableStringify, computeEntryHash, verifyChain, GENESIS_HASH } from '@/modules/ledger/hash-chain';

describe('stableStringify', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = { b: 2, a: 1, c: { z: 1, y: 2 } };
    const b = { a: 1, c: { y: 2, z: 1 }, b: 2 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('distinguishes genuinely different payloads', () => {
    expect(stableStringify({ amount: 100 })).not.toBe(stableStringify({ amount: 101 }));
  });

  it('serialises dates and arrays deterministically', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(stableStringify({ d: date })).toBe('{"d":"2026-01-01T00:00:00.000Z"}');
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]'); // array order is preserved, not sorted
  });
});

describe('computeEntryHash', () => {
  it('is deterministic for the same prevHash and payload', () => {
    const a = computeEntryHash(GENESIS_HASH, { x: 1 });
    const b = computeEntryHash(GENESIS_HASH, { x: 1 });
    expect(a).toBe(b);
  });

  it('changes if the payload changes', () => {
    const a = computeEntryHash(GENESIS_HASH, { x: 1 });
    const b = computeEntryHash(GENESIS_HASH, { x: 2 });
    expect(a).not.toBe(b);
  });

  it('changes if prevHash changes', () => {
    const a = computeEntryHash(GENESIS_HASH, { x: 1 });
    const b = computeEntryHash('somethingelse', { x: 1 });
    expect(a).not.toBe(b);
  });
});

describe('verifyChain', () => {
  function buildChain(payloads: readonly Record<string, unknown>[]) {
    const rows: { id: string; prevHash: string | null; entryHash: string | null; payload: Record<string, unknown> }[] = [];
    let prev = GENESIS_HASH;
    for (const [i, payload] of payloads.entries()) {
      const entryHash = computeEntryHash(prev, payload);
      rows.push({ id: `row-${i}`, prevHash: prev, entryHash, payload });
      prev = entryHash;
    }
    return rows;
  }

  it('reports an honestly-built chain as intact', () => {
    const rows = buildChain([{ a: 1 }, { a: 2 }, { a: 3 }]);
    const result = verifyChain(rows, (r) => r.payload);
    expect(result.intact).toBe(true);
    expect(result.checked).toBe(3);
    expect(result.brokenAtId).toBeNull();
  });

  it('detects a payload altered after the fact', () => {
    const rows = buildChain([{ amount: 100 }, { amount: 200 }]);
    // Tamper: change the second row's stored payload without recomputing its hash.
    const tampered = rows.map((r, i) => (i === 1 ? { ...r, payload: { amount: 999 } } : r));
    const result = verifyChain(tampered, (r) => r.payload);
    expect(result.intact).toBe(false);
    expect(result.brokenAtId).toBe('row-1');
    expect(result.reason).toMatch(/altered/i);
  });

  it('detects a row spliced out of the middle', () => {
    const rows = buildChain([{ a: 1 }, { a: 2 }, { a: 3 }]);
    const spliced = [rows[0]!, rows[2]!]; // remove the middle row
    const result = verifyChain(spliced, (r) => r.payload);
    expect(result.intact).toBe(false);
    expect(result.brokenAtId).toBe('row-2');
    expect(result.reason).toMatch(/reordered|missing/i);
  });

  it('detects rows reordered', () => {
    const rows = buildChain([{ a: 1 }, { a: 2 }]);
    const reordered = [rows[1]!, rows[0]!];
    const result = verifyChain(reordered, (r) => r.payload);
    expect(result.intact).toBe(false);
  });

  it('treats an empty chain as intact', () => {
    const result = verifyChain([], () => ({}));
    expect(result.intact).toBe(true);
    expect(result.checked).toBe(0);
  });

  it('skips pre-chain rows (null entryHash) without failing verification', () => {
    const preChainRow = { id: 'legacy-1', prevHash: null, entryHash: null, payload: { a: 'unhashed' } };
    const rows = buildChain([{ a: 1 }, { a: 2 }]);
    const result = verifyChain([preChainRow, ...rows], (r) => r.payload);
    expect(result.intact).toBe(true);
    expect(result.checked).toBe(2); // the pre-chain row is not counted
  });
});
