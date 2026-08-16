import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  describeAiDiagnostics,
  getProvider,
  setProviderForTesting,
} from '@/modules/ai/providers';
import {
  postJson,
  ProviderError,
  safeProviderFailure,
} from '@/modules/ai/providers/types';

afterEach(() => {
  setProviderForTesting(null);
  vi.unstubAllGlobals();
});

describe('AI provider diagnostics', () => {
  it('reports simulated mode without making a provider call', () => {
    const provider = getProvider();
    expect(provider.isLive).toBe(false);
    expect(describeAiDiagnostics().status).toBe('simulated');
    expect(describeAiDiagnostics().model).toBe('deterministic-composer-v1');
  });

  it.each([
    [401, 'authentication'],
    [404, 'unsupported-model'],
    [429, 'rate-limit'],
    [503, 'network-unavailable'],
  ] as const)('classifies HTTP %s without exposing the response body', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('secret-looking upstream body', { status })));
    await expect(postJson('https://provider.test', {}, {})).rejects.toMatchObject({ code, status });
    const error = await postJson('https://provider.test', {}, {}).catch((value: unknown) => value);
    expect(safeProviderFailure(error).message).not.toContain('secret-looking');
  });

  it('distinguishes malformed JSON and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{not-json', { status: 200 })));
    await expect(postJson('https://provider.test', {}, {})).rejects.toMatchObject({ code: 'malformed-response' });

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network secret'); }));
    const error = await postJson('https://provider.test', {}, {}).catch((value: unknown) => value);
    expect(safeProviderFailure(error)).toMatchObject({ code: 'network-unavailable' });
    expect(safeProviderFailure(error).message).not.toContain('network secret');
  });

  it('accepts a successful provider response without changing deterministic status semantics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ message: { content: 'safe prose' } }] })));
    await expect(postJson('https://provider.test', {}, {})).resolves.toMatchObject({
      choices: [{ message: { content: 'safe prose' } }],
    });
  });

  it('keeps provider failures safe and structured', () => {
    const error = new ProviderError('raw Authorization: secret', 401, false, 'authentication');
    expect(safeProviderFailure(error)).toEqual({
      code: 'authentication',
      status: 401,
      message: 'Provider authentication failed.',
    });
  });
});
