import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectVoiceSupport,
  mapRecordingError,
  queryMicrophonePermission,
} from '@/lib/voice/speech';

function installBrowser({ recognition = true, microphone = true, recorder = true } = {}) {
  const Recognition = function Recognition() {};
  const mediaRecorder = function MediaRecorder() {};
  Object.assign(mediaRecorder, { isTypeSupported: () => true });

  vi.stubGlobal('window', {
    isSecureContext: true,
    location: { hostname: 'localhost' },
    ...(recognition ? { SpeechRecognition: Recognition } : {}),
    ...(recorder ? { MediaRecorder: mediaRecorder } : {}),
    speechSynthesis: undefined,
  });
  vi.stubGlobal('navigator', microphone
    ? { mediaDevices: { getUserMedia: vi.fn() }, permissions: undefined }
    : { mediaDevices: undefined, permissions: undefined });
}

afterEach(() => vi.unstubAllGlobals());

describe('voice capability detection', () => {
  it('detects a Chrome-like browser as separate recognition and recording capabilities', () => {
    installBrowser();
    const support = detectVoiceSupport();

    expect(support.recognition).toBe(true);
    expect(support.microphone).toBe(true);
    expect(support.mediaRecorder).toBe(true);
    expect(support.recording).toBe(true);
    expect(support.microphonePermission).toBe('unknown');
  });

  it('represents a Brave-like browser with no SpeechRecognition but recording available', () => {
    installBrowser({ recognition: false });
    const support = detectVoiceSupport();

    expect(support.recognition).toBe(false);
    expect(support.microphone).toBe(true);
    expect(support.mediaRecorder).toBe(true);
    expect(support.recording).toBe(true);
  });

  it('distinguishes permission denied, prompt, and unknown without prompting', async () => {
    installBrowser();
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      permissions: { query: vi.fn(async () => ({ state: 'denied' })) },
    });
    await expect(queryMicrophonePermission()).resolves.toBe('denied');

    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      permissions: { query: vi.fn(async () => ({ state: 'prompt' })) },
    });
    await expect(queryMicrophonePermission()).resolves.toBe('prompt');
  });

  it('reports missing MediaRecorder independently from microphone API support', () => {
    installBrowser({ recorder: false });
    const support = detectVoiceSupport();

    expect(support.microphone).toBe(true);
    expect(support.mediaRecorder).toBe(false);
    expect(support.recording).toBe(false);
  });

  it('maps browser microphone errors to actionable reasons', () => {
    expect(mapRecordingError(new DOMException('denied', 'NotAllowedError'))).toEqual({
      kind: 'permission-denied', retryable: false,
    });
    expect(mapRecordingError(new DOMException('missing', 'NotFoundError'))).toEqual({
      kind: 'no-microphone', retryable: false,
    });
  });
});
