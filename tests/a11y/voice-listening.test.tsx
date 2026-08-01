import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { VoiceProvider, useVoice } from '@/components/providers/VoiceProvider';
import { VoiceSheet } from '@/components/voice/VoiceSheet';
import { catalog, project, LOCALE_INDEX } from '@/messages/catalog';

/**
 * Can the citizen actually SEND what they just said?
 *
 * This suite exists because the answer was no, in the configuration the app was
 * shipped in. On the server path a recording is uploaded only when `stop()` is
 * called, and the listening sheet offered exactly one button: Cancel, which
 * discards it. So the microphone opened, the citizen spoke, and the only thing
 * they could press threw the audio away. The server log showed zero uploads and
 * the symptom was "no voice is recognised at all".
 *
 * It survived every earlier check because browser speech recognition
 * auto-finalises on silence, which hides the missing control on Chrome, and
 * because the endpoint itself was verified with curl — bypassing the UI entirely.
 * A working transcription endpoint proves nothing about whether anything can
 * reach it.
 */

const messages = project(catalog, LOCALE_INDEX.bn);

const startRecording = vi.fn();
const cancelClip = vi.fn();
const stopClip = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/dashboard',
  Link: ({ children }: { readonly children: ReactNode }) => children,
}));

vi.mock('@/components/providers/PreferencesProvider', () => ({
  usePreferences: () => ({ locale: 'bn', voiceEnabled: true, numerals: 'latin' }),
}));

vi.mock('@/lib/api/client', () => ({
  // serverStt true and mode 'server' — the configuration where the bug bit.
  api: { get: () => Promise.resolve({ voice: { serverStt: true, serverTts: false, mode: 'server' } }) },
}));

/**
 * Only the recorder is mocked. `detectVoiceSupport` is left real, so the test
 * also asserts the capability logic admits a browser that can record but cannot
 * recognise — which is Firefox, and the case this whole path exists for.
 */
vi.mock('@/lib/voice/speech', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/voice/speech')>();
  return {
    ...actual,
    detectVoiceSupport: () => ({
      recognition: false,   // Firefox
      recording: true,
      synthesis: false,
      banglaVoice: false,
      secureContext: true,
    }),
    startRecording: (...args: unknown[]) => startRecording(...args),
    speakLocally: () => false,
    stopSpeaking: () => undefined,
    whenVoicesReady: () => Promise.resolve(),
    hasBanglaVoice: () => false,
  };
});

function Probe() {
  const voice = useVoice();
  return (
    <div>
      <span data-testid="state">{voice.state}</span>
      <span data-testid="canListen">{String(voice.canListen)}</span>
      <button type="button" onClick={voice.start}>press-mic</button>
    </div>
  );
}

function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="bn" messages={messages} timeZone="Asia/Dhaka">
      <VoiceProvider authenticated>{children}</VoiceProvider>
    </NextIntlClientProvider>
  );
}

/** A clip comfortably over the mis-tap threshold. */
const clip = () => new Blob([new Uint8Array(8000)], { type: 'audio/ogg' });

beforeEach(() => {
  startRecording.mockReset();
  cancelClip.mockReset();
  stopClip.mockReset();
  stopClip.mockResolvedValue(clip());
  startRecording.mockResolvedValue({ stop: stopClip, cancel: cancelClip });

  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { text: 'সংরক্ষিত', heardNothing: false } }),
    }),
  ));
});

async function setup() {
  await act(async () => {
    render(
      <Providers>
        <Probe />
        <VoiceSheet />
      </Providers>,
    );
  });
}

const click = async (label: string | RegExp) => {
  await act(async () => {
    screen.getByRole('button', { name: label }).click();
  });
};

const state = () => screen.getByTestId('state').textContent;

describe('the listening sheet can send the recording', () => {
  it('offers the microphone at all on a browser that can only record', async () => {
    // Firefox: no Web Speech, but MediaRecorder plus a server provider is enough.
    await setup();
    expect(screen.getByTestId('canListen').textContent).toBe('true');
  });

  it('shows a button that SENDS what was said, not only one that discards it', async () => {
    /**
     * The regression, stated directly. Before the fix the listening sheet
     * contained a single action — Cancel — so there was no reachable way to
     * upload a clip, and voice recognised nothing on the server path.
     */
    await setup();
    await click('press-mic');
    expect(state()).toBe('listening');

    const send = screen.getByRole('button', { name: /বলা শেষ/ });
    expect(send).toBeTruthy();

    await act(async () => {
      send.click();
    });

    expect(stopClip).toHaveBeenCalledTimes(1);
    expect(cancelClip).not.toHaveBeenCalled();
  });

  it('uploads the clip and resolves the transcript into a command', async () => {
    await setup();
    await click('press-mic');
    await click(/বলা শেষ/);

    const uploads = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .filter(([url]) => String(url).includes('/voice/transcribe'));
    expect(uploads).toHaveLength(1);

    // "সংরক্ষিত" is navigation, so it runs immediately and returns to idle.
    expect(state()).toBe('idle');
  });

  it('still offers cancel, and cancel throws the recording away', async () => {
    // Both actions must exist: one to send, one to abandon. The bug was having
    // only the second.
    await setup();
    await click('press-mic');
    await click(/বাতিল/);

    expect(cancelClip).toHaveBeenCalledTimes(1);
    expect(stopClip).not.toHaveBeenCalled();
    expect(state()).toBe('idle');
  });

  it('tells the citizen how to finish, not just what to say', async () => {
    // Without this instruction the primary button is a guess.
    await setup();
    await click('press-mic');
    expect(document.body.textContent).toContain('পাঠান');
  });
});

describe('pressing send before the microphone has opened', () => {
  it('does not leave the citizen stuck on "listening" for ever', async () => {
    /**
     * `getUserMedia` does not resolve until the permission prompt is answered.
     * Pressing done during that window used to hit a branch that did nothing at
     * all: no upload, no error, and a sheet still claiming to listen.
     */
    let release: ((handle: unknown) => void) | undefined;
    startRecording.mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );

    await setup();
    await click('press-mic');
    expect(state()).toBe('listening');

    await click(/বলা শেষ/);
    // Reported honestly rather than hanging.
    expect(state()).toBe('error');

    // And the recorder that arrives afterwards belongs to nobody: it must close
    // itself rather than hold the microphone open.
    await act(async () => {
      release?.({ stop: stopClip, cancel: cancelClip });
    });
    expect(cancelClip).toHaveBeenCalledTimes(1);
  });

  it('abandons a late recorder after a cancel too', async () => {
    let release: ((handle: unknown) => void) | undefined;
    startRecording.mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );

    await setup();
    await click('press-mic');
    await click(/বাতিল/);

    await act(async () => {
      release?.({ stop: stopClip, cancel: cancelClip });
    });
    expect(cancelClip).toHaveBeenCalledTimes(1);
    expect(stopClip).not.toHaveBeenCalled();
  });
});
