import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireSession, generateActionPlan } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  generateActionPlan: vi.fn(),
}));

vi.mock('@/lib/http/session', () => ({ requireSession }));
vi.mock('@/modules/citizen/citizen.service', () => ({
  generateActionPlan,
  listActionPlans: vi.fn(),
}));

import { POST } from '@/app/api/v1/action-plans/route';

describe('POST /api/v1/action-plans', () => {
  beforeEach(() => {
    requireSession.mockReset();
    generateActionPlan.mockReset();
    requireSession.mockResolvedValue({ ok: true, session: { userId: 'user-1' } });
  });

  it('returns the canonical plan and generated timeline event identifiers', async () => {
    generateActionPlan.mockResolvedValue({
      plan: { id: 'plan-1' },
      tasks: [{ id: 'task-1' }],
      created: true,
      timelineEventIds: ['event-1', 'event-2'],
    });

    const response = await POST(new Request('http://localhost/api/v1/action-plans', {
      method: 'POST',
      body: JSON.stringify({ opportunityId: '00000000-0000-4000-8000-000000000001' }),
      headers: { 'content-type': 'application/json' },
    }) as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({ plan: { id: 'plan-1' }, timelineEventIds: ['event-1', 'event-2'] });
  });
});
