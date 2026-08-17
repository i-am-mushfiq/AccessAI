import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const { requireFullSession } = vi.hoisted(() => ({ requireFullSession: vi.fn() }));
vi.mock('@/lib/http/session', () => ({ requireFullSession }));

import { POST } from '@/app/api/v1/users/onboarding/complete/route';

describe('POST /api/v1/users/onboarding/complete', () => {
  beforeEach(() => requireFullSession.mockReset());

  it('rejects unauthenticated direct access before reading or writing profile data', async () => {
    requireFullSession.mockResolvedValue({ ok: false, response: NextResponse.json({ success: false }, { status: 401 }) });

    const response = await POST();

    expect(response.status).toBe(401);
  });
});
