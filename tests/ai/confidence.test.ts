import { describe, it, expect } from 'vitest';
import { scoreConfidence, type ConfidenceInput } from '@/modules/ai/confidence';
import type { RetrievedChunk } from '@/modules/knowledge/retrieval';
import type { EvaluationResult } from '@/modules/eligibility/engine';

/**
 * Confidence scoring — PRD §32, and §33's prohibition on unsupported claims.
 *
 * The property under test is not "the number is right" — there is no ground
 * truth for a confidence percentage. It is that the number can never OVERSTATE
 * what the system actually knows. Every test below pins a ceiling, an ordering,
 * or a statement the citizen is shown, because those are the parts that can be
 * wrong in a way that matters.
 */

const NOW = new Date('2026-07-29T00:00:00.000Z');

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: 'c1',
    opportunityId: 'o1',
    documentId: 'd1',
    content: 'Widow allowance eligibility',
    title: 'Widow Allowance',
    slug: 'widow-allowance',
    sourceUrl: 'https://dss.gov.bd/widow-allowance',
    lexicalScore: 0.04,
    semanticScore: 0.8,
    score: 0.03,
    ...overrides,
  };
}

function evaluation(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    outcome: 'eligible',
    matched: [], failed: [], unknown: [], softFailed: [],
    missingFields: [],
    ruleCoverage: 100,
    score: 90,
    trace: { kind: 'all', id: 'root', state: 'met', children: [] },
    ruleVersion: 1,
    ...overrides,
  } as EvaluationResult;
}

/** A best case in every respect EXCEPT the trust state, which each test sets. */
function bestCase(overrides: Partial<ConfidenceInput> = {}): ConfidenceInput {
  return {
    retrieved: [chunk(), chunk({ chunkId: 'c2', documentId: 'd2' })],
    evaluation: evaluation(),
    verificationStatus: 'verified',
    lastVerifiedAt: new Date('2026-07-20T00:00:00.000Z'),
    hasSourceUrl: true,
    hasRequiredDocuments: true,
    hasApplicationSteps: true,
    now: NOW,
    ...overrides,
  };
}

describe('the verification ceiling cannot be lifted by any other factor', () => {
  it('caps unverified sample data at 65 even when everything else is perfect', () => {
    const result = scoreConfidence(bestCase({ verificationStatus: 'unverified_sample' }));
    expect(result.score).toBeLessThanOrEqual(65);
    expect(result.ceilingApplied).toBe(true);
  });

  it('explains the cap FIRST, before any other reason', () => {
    // Buried at the end, the explanation is read after the number has already
    // been believed.
    const result = scoreConfidence(bestCase({ verificationStatus: 'unverified_sample' }));
    expect(result.reasons[0]?.en).toContain('unverified sample data');
    expect(result.reasons[0]?.bn.length).toBeGreaterThan(0);
  });

  it('caps outdated at 45 and disputed at 25', () => {
    expect(scoreConfidence(bestCase({ verificationStatus: 'outdated' })).score).toBeLessThanOrEqual(45);
    expect(scoreConfidence(bestCase({ verificationStatus: 'disputed' })).score).toBeLessThanOrEqual(25);
  });

  it('lets a verified record score high — the ceiling is the only thing holding it down', () => {
    const unverified = scoreConfidence(bestCase({ verificationStatus: 'unverified_sample' }));
    const verified = scoreConfidence(bestCase({ verificationStatus: 'verified' }));

    // This difference is the whole point of the admin verification action: the
    // same facts, the same rule, a higher score once a human has confirmed it.
    expect(verified.score).toBeGreaterThan(unverified.score);
    expect(verified.score).toBeGreaterThanOrEqual(80);
    expect(verified.band).toBe('high');
  });

  it('does not report a ceiling when the raw score was already below it', () => {
    // `ceilingApplied` must mean "we held this number down", not "this record is
    // unverified" — the UI uses it to decide whether to explain the cap.
    const weak = scoreConfidence({
      retrieved: [],
      evaluation: evaluation({ ruleCoverage: 20, missingFields: ['monthlyIncome'] }),
      verificationStatus: 'unverified_sample',
      lastVerifiedAt: null,
      hasSourceUrl: false,
      hasRequiredDocuments: false,
      hasApplicationSteps: false,
      now: NOW,
    });
    expect(weak.score).toBeLessThan(65);
    expect(weak.ceilingApplied).toBe(false);
  });
});

describe('a missing retrieval result is not the same as a direct record', () => {
  const base = {
    evaluation: evaluation(),
    verificationStatus: 'verified' as const,
    lastVerifiedAt: new Date('2026-07-20T00:00:00.000Z'),
    hasSourceUrl: true,
    hasRequiredDocuments: true,
    hasApplicationSteps: true,
    now: NOW,
  };

  it('says so plainly when retrieval genuinely found nothing', () => {
    const result = scoreConfidence({ ...base, retrieved: [] });
    expect(result.factors.retrievalQuality).toBe(0);
    expect(result.reasons.map((r) => r.en)).toContain('No supporting document was found for this answer.');
  });

  it('does NOT claim a missing document when the answer came from the record itself', () => {
    // The direct-check path (detail page, what-if panel) reads the programme's
    // own record. Reporting "no supporting document was found" there is a false
    // statement in the one place the citizen is most likely to read it.
    const result = scoreConfidence({ ...base, retrieved: [], directRecord: { indexedDocuments: 2 } });

    expect(result.reasons.map((r) => r.en)).not.toContain('No supporting document was found for this answer.');
    expect(result.reasons.some((r) => r.en.includes('own record'))).toBe(true);
    expect(result.factors.retrievalQuality).toBeGreaterThan(0);
  });

  it('scores a direct record below a well-matched passage, and an unindexed one below that', () => {
    const retrieved = scoreConfidence({ ...base, retrieved: [chunk({ score: 0.05 })] });
    const indexed = scoreConfidence({ ...base, retrieved: [], directRecord: { indexedDocuments: 1 } });
    const unindexed = scoreConfidence({ ...base, retrieved: [], directRecord: { indexedDocuments: 0 } });

    expect(retrieved.factors.retrievalQuality).toBeGreaterThan(indexed.factors.retrievalQuality);
    expect(indexed.factors.retrievalQuality).toBeGreaterThan(unindexed.factors.retrievalQuality);
  });

  it('counts a direct record as a supporting source, since the record IS the source', () => {
    const none = scoreConfidence({ ...base, retrieved: [], directRecord: { indexedDocuments: 0 } });
    const two = scoreConfidence({ ...base, retrieved: [], directRecord: { indexedDocuments: 2 } });
    expect(two.factors.supportingSources).toBeGreaterThan(none.factors.supportingSources);
  });

  it('caps lexical-only retrieval below a semantically matched result', () => {
    // Without an embedding provider the semantic channel contributes nothing, so
    // paraphrase matching is weaker — the score must admit that.
    const lexicalOnly = scoreConfidence({
      ...base,
      retrieved: [chunk({ semanticScore: 0, score: 0.06 })],
    });
    expect(lexicalOnly.factors.retrievalQuality).toBeLessThanOrEqual(78);
  });
});

describe('what the citizen is told', () => {
  const base = {
    retrieved: [chunk()],
    verificationStatus: 'verified' as const,
    lastVerifiedAt: new Date('2026-07-20T00:00:00.000Z'),
    hasSourceUrl: true,
    hasRequiredDocuments: true,
    hasApplicationSteps: true,
    now: NOW,
  };

  it('calls a decision provisional while information is still missing', () => {
    const result = scoreConfidence({
      ...base,
      evaluation: evaluation({ outcome: 'unknown', missingFields: ['monthlyIncome', 'gender'] }),
    });
    expect(result.factors.ruleCompleteness).toBeLessThanOrEqual(55);
    expect(result.reasons.some((r) => r.en.includes('provisional'))).toBe(true);
  });

  it('warns when a verification has aged past six months', () => {
    const result = scoreConfidence({
      ...base,
      evaluation: evaluation(),
      lastVerifiedAt: new Date('2025-07-20T00:00:00.000Z'),
    });
    expect(result.reasons.some((r) => r.en.includes('rules may have changed'))).toBe(true);
  });

  it('says a record has never been verified, rather than staying silent', () => {
    const result = scoreConfidence({ ...base, evaluation: evaluation(), lastVerifiedAt: null });
    expect(result.factors.dataFreshness).toBe(25);
    expect(result.reasons.some((r) => r.en.includes('never been verified'))).toBe(true);
  });

  it('gives every reason in both languages', () => {
    // A Bangla-only citizen must not hit an English string in the trust panel.
    const result = scoreConfidence({
      ...base,
      retrieved: [],
      evaluation: evaluation({ outcome: 'unknown', missingFields: ['gender'] }),
      verificationStatus: 'unverified_sample',
      lastVerifiedAt: null,
      hasSourceUrl: false,
    });
    expect(result.reasons.length).toBeGreaterThan(2);
    for (const reason of result.reasons) {
      expect(reason.en.trim().length).toBeGreaterThan(0);
      expect(reason.bn.trim().length).toBeGreaterThan(0);
      // A Bangla string that is actually English would pass a length check.
      expect(/[ঀ-৿]/.test(reason.bn)).toBe(true);
    }
  });

  it('never returns a score outside 0–100, or a band that disagrees with it', () => {
    const cases: ConfidenceInput[] = [
      bestCase(),
      bestCase({ verificationStatus: 'disputed' }),
      { ...base, evaluation: null, retrieved: [], lastVerifiedAt: null, hasSourceUrl: false,
        hasRequiredDocuments: false, hasApplicationSteps: false },
    ];
    for (const input of cases) {
      const { score, band } = scoreConfidence(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(band).toBe(score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low');
    }
  });
});
