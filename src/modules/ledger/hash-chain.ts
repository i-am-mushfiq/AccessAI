import { createHash } from 'node:crypto';

/**
 * The shared hash-chain primitive behind `audit_log` (SJ-13) and
 * `ledger_entries` (SJ-14). Deliberately not a distributed ledger — one
 * writer, one SQLite database — but a genuine tamper-evidence mechanism: an
 * altered row stops matching its own hash, and an altered or reordered row
 * breaks the link to whatever comes after it. `verifyChain()` is the payoff:
 * a real, independently-runnable check, not just storage that claims to be
 * immutable. See docs/DEVIATIONS.md for what this can and cannot promise —
 * in particular, it detects tampering after the fact; it does not prevent an
 * operator with direct database access from rewriting the whole chain and
 * recomputing every hash, the way no purely software hash-chain can.
 */

export const GENESIS_HASH = 'GENESIS';

/**
 * Deterministic JSON serialisation — key order must never affect the hash,
 * or the same logical payload could hash two different ways depending on
 * which code path built the object literal.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

/**
 * No separator character is needed between `prevHash` and the serialised
 * payload: `prevHash` is always exactly 64 hex characters or the literal
 * `GENESIS`, a fixed-format prefix that cannot itself be ambiguous about
 * where it ends. A variable-width separator would only add a place to get
 * subtly wrong (this module already learned that lesson once — see
 * docs/DEVIATIONS.md on src/lib/routing/next-path.ts).
 */
export function computeEntryHash(prevHash: string, payload: unknown): string {
  return createHash('sha256').update(`${prevHash}:${stableStringify(payload)}`).digest('hex');
}

export interface ChainLink {
  readonly id: string;
  readonly prevHash: string | null;
  readonly entryHash: string | null;
}

export interface ChainVerificationResult {
  readonly intact: boolean;
  readonly checked: number;
  readonly brokenAtId: string | null;
  readonly reason: string | null;
}

/**
 * Walks a chain in creation order and confirms every entry both (a)
 * recomputes correctly from its own payload and the previous entry's hash,
 * and (b) declares the previous entry's ACTUAL hash as its `prevHash` — so
 * neither editing a row's content nor splicing/reordering rows survives
 * unnoticed. `recompute` supplies each table's own payload shape.
 *
 * Rows with a null hash (written before the chain existed) are skipped
 * rather than failing verification — they are honestly outside the chain,
 * not tampered evidence.
 */
export function verifyChain<T extends ChainLink>(
  rows: readonly T[],
  recompute: (row: T) => unknown,
): ChainVerificationResult {
  let expectedPrev = GENESIS_HASH;
  let checked = 0;

  for (const row of rows) {
    if (row.entryHash === null) continue; // pre-chain row — not covered, not broken.

    if ((row.prevHash ?? GENESIS_HASH) !== expectedPrev) {
      return {
        intact: false,
        checked,
        brokenAtId: row.id,
        reason: 'This entry does not link to the one before it — the chain has been reordered or a row is missing.',
      };
    }

    const recomputed = computeEntryHash(expectedPrev, recompute(row));
    if (recomputed !== row.entryHash) {
      return {
        intact: false,
        checked,
        brokenAtId: row.id,
        reason: 'This entry no longer matches its own hash — its stored content was altered after it was written.',
      };
    }

    expectedPrev = row.entryHash;
    checked += 1;
  }

  return { intact: true, checked, brokenAtId: null, reason: null };
}
