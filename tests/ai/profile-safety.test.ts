import { describe, expect, it } from 'vitest';
import { normalizeConditionalProfilePatch } from '@/modules/eligibility/profile-safety';
import { extractEntities } from '@/modules/ai/nlu';
import { evaluateEligibility } from '@/modules/eligibility/engine';
import { isFarmerLike, rules } from '@/lib/db/seed/helpers';

describe('conditional profile safety', () => {
  it('normalizes a crafted male PATCH to the canonical null pregnancy state', () => {
    expect(
      normalizeConditionalProfilePatch({ gender: 'male', isPregnant: true }, 'female'),
    ).toEqual({ gender: 'male', isPregnant: null });
  });

  it('clears stale pregnancy when a male profile is edited and saved', () => {
    expect(normalizeConditionalProfilePatch({ monthlyIncome: 5000 }, 'male')).toEqual({
      monthlyIncome: 5000,
      isPregnant: null,
    });
  });

  it('preserves pregnancy answers for female, other, and unset gender values', () => {
    for (const gender of ['female', 'other', undefined]) {
      expect(normalizeConditionalProfilePatch({ isPregnant: true }, gender)).toEqual({ isPregnant: true });
    }
  });

  it('clears hidden farming details when farming is turned off', () => {
    expect(
      normalizeConditionalProfilePatch(
        { hasFarmingActivity: false, farmSizeDecimals: 20, crops: ['rice'] },
        undefined,
      ),
    ).toMatchObject({ hasFarmingActivity: false, farmSizeDecimals: null, crops: null, livestock: null });
  });

  it('clears stale farming details when an old false profile is edited', () => {
    expect(normalizeConditionalProfilePatch({ monthlyIncome: 5000 }, undefined, false)).toMatchObject({
      monthlyIncome: 5000,
      farmSizeDecimals: null,
      crops: null,
      livestock: null,
    });
  });

  it('uses explicit farming activity as additional agriculture evidence without denying unknown profiles', () => {
    const ruleSet = rules(['occupation'], isFarmerLike());
    expect(evaluateEligibility(ruleSet, { occupation: 'teacher', hasFarmingActivity: true }).outcome).toBe('eligible');
    expect(evaluateEligibility(ruleSet, { occupation: 'teacher' }).outcome).toBe('unknown');
    expect(evaluateEligibility(ruleSet, { occupation: 'teacher', hasFarmingActivity: false }).outcome).toBe('not_eligible');
    expect(evaluateEligibility(ruleSet, { occupation: 'farmer', hasFarmingActivity: false }).outcome).toBe('eligible');
  });

  it('does not turn an explicitly male speaker into a female profile', () => {
    const result = extractEntities('আমি পুরুষ, আমি pregnant নই');
    expect(result.profile.gender).toBe('male');
    expect(result.profile.isPregnant).toBeUndefined();
  });

  it('recognises farming language for guided profile filling', () => {
    expect(extractEntities('আমি কৃষিকাজ করি, ধান চাষ করি').profile.hasFarmingActivity).toBe(true);
  });

  it('recognises an explicit farming negative answer', () => {
    expect(extractEntities('আমি কৃষিকাজ করি না').profile.hasFarmingActivity).toBe(false);
  });
});
