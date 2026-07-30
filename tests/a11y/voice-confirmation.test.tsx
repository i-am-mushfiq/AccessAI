import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { VoiceProvider, useVoice, useVoiceActions } from '@/components/providers/VoiceProvider';

/**
 * The safety contract of voice navigation, tested through the provider rather
 * than the matcher.
 *
 * `intent.test.ts` proves the RESOLVER flags a destructive command for
 * confirmation. This proves the provider actually WITHHOLDS the action until the
 * citizen says yes — two different failures, and only the second one reaches a
 * real person's saved list.
 *
 * `submitText` is the seam that makes this testable with no speech mocking at
 * all: it is the same path a finished transcript takes, minus the microphone.
 */

const push = vi.fn();
const back = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/opportunities/widow-allowance',
  Link: ({ children }: { readonly children: ReactNode }) => children,
}));

vi.mock('@/components/providers/PreferencesProvider', () => ({
  usePreferences: () => ({ locale: 'bn', voiceEnabled: true }),
}));

vi.mock('@/lib/api/client', () => ({
  api: { get: () => Promise.resolve({ voice: { serverStt: false } }) },
}));

function Harness({ onSave }: { readonly onSave: () => void }) {
  const voice = useVoice();
  useVoiceActions({ 'action.save': onSave });

  return (
    <div>
      <span data-testid="state">{voice.state}</span>
      <span data-testid="pending">{voice.pending?.command.id ?? 'none'}</span>
      <button type="button" onClick={() => voice.submitText('সেভ করো')}>say-save</button>
      <button type="button" onClick={() => voice.submitText('সংরক্ষিত')}>say-navigate</button>
      <button type="button" onClick={() => voice.submitText('হ্যাঁ')}>say-yes</button>
      <button type="button" onClick={() => voice.submitText('করো না')}>say-no</button>
      <button type="button" onClick={() => voice.submitText('আজকের আবহাওয়া কেমন')}>say-unrelated</button>
      <button type="button" onClick={voice.confirm}>tap-confirm</button>
      <button type="button" onClick={voice.reject}>tap-reject</button>
    </div>
  );
}

function setup() {
  const onSave = vi.fn();
  render(
    <VoiceProvider authenticated>
      <Harness onSave={onSave} />
    </VoiceProvider>,
  );
  return { onSave };
}

/**
 * Action handlers are awaited inside the provider, so the state update that
 * follows lands in a later microtask. An async act flushes it before assertions.
 */
async function click(label: string): Promise<void> {
  await act(async () => {
    screen.getByText(label).click();
  });
}

const state = () => screen.getByTestId('state').textContent;
const pending = () => screen.getByTestId('pending').textContent;

beforeEach(() => {
  push.mockClear();
  back.mockClear();
});

describe('a destructive spoken command is withheld until confirmed', () => {
  it('does not run the action on hearing it', async () => {
    const { onSave } = setup();
    await click('say-save');

    expect(onSave).not.toHaveBeenCalled();
    expect(state()).toBe('confirming');
    expect(pending()).toBe('action.save');
  });

  it('runs it only after a spoken yes', async () => {
    const { onSave } = setup();
    await click('say-save');
    expect(onSave).not.toHaveBeenCalled();

    await click('say-yes');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(state()).toBe('idle');
  });

  it('runs it after a tapped confirmation too', async () => {
    // Someone in a shared room may be unable to speak the yes out loud.
    const { onSave } = setup();
    await click('say-save');
    await click('tap-confirm');
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('abandons it on a spoken no', async () => {
    const { onSave } = setup();
    await click('say-save');
    await click('say-no');

    expect(onSave).not.toHaveBeenCalled();
    expect(state()).toBe('idle');
    expect(pending()).toBe('none');
  });

  it('abandons it on a tapped cancel', async () => {
    const { onSave } = setup();
    await click('say-save');
    await click('tap-reject');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not treat an unrelated sentence as consent', async () => {
    // Silence and ambiguity are never consent: the confirmation stays open.
    const { onSave } = setup();
    await click('say-save');
    await click('say-unrelated');

    expect(onSave).not.toHaveBeenCalled();
    expect(state()).toBe('confirming');
  });

  it('does not treat a sentence that merely CONTAINS a yes-word as consent', async () => {
    /**
     * "সেভ করো" contains "করো" ("do it"), a yes phrase. Mid-confirmation for an
     * unsave, reading that as yes would perform the opposite of what the citizen
     * wants. Repeating the original command must leave the question open.
     */
    const { onSave } = setup();
    await click('say-save');
    await click('say-save');

    expect(onSave).not.toHaveBeenCalled();
    expect(state()).toBe('confirming');
  });
});

describe('navigation is immediate, because it is reversible', () => {
  it('routes without a confirmation step', async () => {
    setup();
    await click('say-navigate');

    expect(push).toHaveBeenCalledWith('/saved');
    expect(state()).toBe('idle');
    expect(pending()).toBe('none');
  });

  it('strips the locale prefix so the locale-aware router cannot double it', async () => {
    // The resolver returns "/bn/saved"; pushing that through a locale-aware
    // router would produce "/bn/bn/saved".
    setup();
    await click('say-navigate');
    expect(push).toHaveBeenCalledWith('/saved');
    expect(push).not.toHaveBeenCalledWith('/bn/saved');
  });
});
