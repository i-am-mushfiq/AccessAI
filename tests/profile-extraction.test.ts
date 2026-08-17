import { describe, expect, it } from 'vitest';
import { extractProfileCandidates } from '@/modules/profile/extraction';

describe('deterministic profile extraction', () => {
  it('extracts district, occupation, farming and Bengali-digit land amount together', () => {
    const result = extractProfileCandidates('আমি কুড়িগ্রামে কৃষিকাজ করি, ৩ বিঘা জমি আছে।');

    expect(result.proposedUpdates).toMatchObject({
      district: 'kurigram',
      occupation: 'farmer',
      hasFarmingActivity: true,
      landOwnershipDecimals: 99,
    });
    expect(result.recognizedFields).toEqual(expect.arrayContaining([
      'district', 'occupation', 'hasFarmingActivity', 'landOwnershipDecimals',
    ]));
    expect(result.unresolvedParts).toHaveLength(0);
  });

  it('handles mixed Bangla and English without using an LLM', () => {
    const result = extractProfileCandidates('I farm in Kurigram, income 4 হাজার টাকা');

    expect(result.proposedUpdates).toMatchObject({
      district: 'kurigram',
      occupation: 'farmer',
      hasFarmingActivity: true,
      monthlyIncome: 4000,
    });
  });

  it('marks ambiguous and unrelated speech unresolved instead of guessing', () => {
    expect(extractProfileCandidates('আমার জমি আছে').candidates).toHaveLength(0);
    expect(extractProfileCandidates('আমার জমি আছে').unresolvedParts).toEqual(['আমার জমি আছে']);
    expect(extractProfileCandidates('আজ ক্রিকেট দেখব').candidates).toHaveLength(0);
  });

  it('requires stronger review for pregnancy and blocks male contradictions', () => {
    const female = extractProfileCandidates('আমি মহিলা, আমি গর্ভবতী');
    expect(female.candidates.find((candidate) => candidate.field === 'isPregnant')?.sensitive).toBe(true);

    const male = extractProfileCandidates('আমি পুরুষ, আমি pregnant', { currentGender: 'male' });
    expect(male.proposedUpdates.isPregnant).toBeUndefined();
    expect(male.unresolvedParts.length).toBeGreaterThan(0);
  });

  it('proposes farming without forcing an answer when the user only mentions agriculture', () => {
    const result = extractProfileCandidates('আমি কৃষিকাজ করি');

    expect(result.proposedUpdates.hasFarmingActivity).toBe(true);
    expect(result.proposedUpdates.occupation).toBe('farmer');
  });
});
