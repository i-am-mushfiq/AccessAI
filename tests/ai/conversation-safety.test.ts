import { describe, expect, it } from 'vitest';
import { chooseMissingField } from '@/modules/ai/conversation.service';
import type { EnrichedOpportunity } from '@/modules/opportunities/opportunity.service';

function unknownPregnancyOpportunity(): EnrichedOpportunity {
  return {
    evaluation: {
      outcome: 'unknown',
      missingFields: ['isPregnant'],
      unknown: [{ field: 'isPregnant' }],
    },
  } as unknown as EnrichedOpportunity;
}

describe('conversation pregnancy clarification safety', () => {
  it('does not select pregnancy as a follow-up for a male profile', () => {
    expect(chooseMissingField([unknownPregnancyOpportunity()], { gender: 'male' })).toBeNull();
  });

  it('keeps pregnancy clarification available for a female profile', () => {
    expect(chooseMissingField([unknownPregnancyOpportunity()], { gender: 'female' })).toBe('isPregnant');
  });

  it('does not infer the same restriction for other or unset gender', () => {
    const opportunity = unknownPregnancyOpportunity();
    expect(chooseMissingField([opportunity], { gender: 'other' })).toBe('isPregnant');
    expect(chooseMissingField([opportunity], {})).toBe('isPregnant');
  });
});
