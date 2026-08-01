import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VoiceProvider, useVoice } from '@/components/providers/VoiceProvider';
import { TimelineView, type TimelineEntry } from '@/components/timeline/TimelineView';
import { NotificationList, type NotificationItem } from '@/components/notifications/NotificationList';
import { catalog, project, LOCALE_INDEX } from '@/messages/catalog';

/**
 * The real Bangla catalogue, not stubs. Asserting on stub strings would pass
 * while the shipped copy said something else entirely — and the copy IS the
 * feature here, since it is all the citizen receives.
 */
const messages = project(catalog, LOCALE_INDEX.bn);

/** Retries would turn a deliberate mutation failure into a multi-second hang. */
const newQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="bn" messages={messages} timeZone="Asia/Dhaka">
      <QueryClientProvider client={newQueryClient()}>
        <VoiceProvider authenticated>{children}</VoiceProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

/**
 * Read-aloud and the screen actions, tested through the real components.
 *
 * These two screens compose their spoken summary inside a CLIENT component, so
 * the text never crosses a server boundary and never appears in the server-
 * rendered HTML. A curl of the page cannot show whether "পড়ে শোনাও" has anything
 * to read — which is precisely how the command shipped resolving everywhere while
 * only the chat screen had a readable registered. So it is asserted here.
 *
 * `submitText` is the seam: the same path a finished transcript takes, minus the
 * microphone. `speak` is captured to see what the citizen would actually hear.
 */

const push = vi.fn();
const refresh = vi.fn();
const patch = vi.fn(() => Promise.resolve({}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/timeline',
  Link: ({ children }: { readonly children: ReactNode }) => children,
}));

vi.mock('@/components/providers/PreferencesProvider', () => ({
  usePreferences: () => ({ locale: 'bn', voiceEnabled: true, numerals: 'latin' }),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    get: () => Promise.resolve({ voice: { serverStt: false, serverTts: false, mode: 'auto' } }),
    patch: (...args: unknown[]) => patch(...(args as [])),
  },
  ApiError: class extends Error {},
}));

vi.mock('@/components/providers/ToastProvider', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

/** Injects a transcript down the same path a real one takes. */
function Probe() {
  const voice = useVoice();
  return (
    <div>
      <span data-testid="state">{voice.state}</span>
      <button type="button" onClick={() => voice.submitText('পড়ে শোনাও')}>say-read</button>
      <button type="button" onClick={() => voice.submitText('সব পড়া হয়েছে')}>say-mark-all</button>
      <button type="button" onClick={() => voice.submitText('হ্যাঁ')}>say-yes</button>
    </div>
  );
}

/** Everything the app tried to say, in order. Cleared per test, never per render. */
const spoken: string[] = [];

/**
 * The provider speaks through `window.speechSynthesis`. Recording utterances
 * there catches the text at the last possible moment, after every transformation
 * the real path applies.
 */
beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  patch.mockClear();
  spoken.length = 0;

  const voice = { lang: 'bn-BD', name: 'test', localService: true } as SpeechSynthesisVoice;
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speak: (utterance: SpeechSynthesisUtterance) => {
        spoken.push(utterance.text);
        utterance.onend?.(new Event('end') as SpeechSynthesisEvent);
      },
      cancel: () => undefined,
      getVoices: () => [voice],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  });
  // @ts-expect-error -- jsdom has no SpeechSynthesisUtterance; a text-carrying stub is enough.
  window.SpeechSynthesisUtterance = class {
    text: string;
    lang = '';
    rate = 1;
    onend: ((e: Event) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
});

async function click(label: string): Promise<void> {
  await act(async () => {
    screen.getByText(label).click();
  });
}

/* ------------------------------------------------------------- timeline */

const event = (over: Partial<TimelineEntry> = {}): TimelineEntry => ({
  id: 'e1',
  type: 'deadline',
  title: 'Widow allowance deadline',
  titleBn: 'বিধবা ভাতার শেষ তারিখ',
  description: null,
  descriptionBn: null,
  // Far enough ahead that it is always "upcoming" regardless of when this runs.
  eventDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  completed: false,
  opportunitySlug: null,
  ...over,
});

function renderTimeline(events: readonly TimelineEntry[]) {
  render(
    <Providers>
      <Probe />
      <TimelineView events={events} />
    </Providers>,
  );
}

describe('"পড়ে শোনাও" on the timeline', () => {
  it('reads the count and the upcoming items', async () => {
    renderTimeline([
      event({ id: 'a', titleBn: 'বিধবা ভাতার শেষ তারিখ' }),
      event({ id: 'b', titleBn: 'কাগজ জমা দিতে হবে', type: 'task' }),
    ]);

    await click('say-read');

    expect(spoken).toHaveLength(1);
    const said = spoken[0]!;
    expect(said).toContain('সামনে দুই');           // the count, as a WORD not "2"
    expect(said).toContain('বিধবা ভাতার শেষ তারিখ');
    expect(said).toContain('কাগজ জমা দিতে হবে');
  });

  it('says the screen is empty rather than saying nothing at all', async () => {
    // Silence is indistinguishable from a broken microphone.
    renderTimeline([]);
    await click('say-read');

    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toContain('সামনে কোনো কাজ নেই');
  });

  it('admits how many items it did not read', async () => {
    // A list read aloud has no scrollbar; stopping silently at five would tell
    // someone with eight deadlines that they have three fewer things to do.
    renderTimeline(
      Array.from({ length: 8 }, (_, i) => event({ id: `e${i}`, titleBn: `কাজ ${i}` })),
    );
    await click('say-read');

    const said = spoken[0]!;
    expect(said).toContain('সামনে আট');  // eight in total
    expect(said).toMatch(/আরও তিন/);      // and three were not read
  });

  it('counts overdue items without reading them all out', async () => {
    renderTimeline([
      event({ id: 'past1', eventDate: new Date(Date.now() - 10 * 86_400_000).toISOString(), titleBn: 'পুরনো এক' }),
      event({ id: 'past2', eventDate: new Date(Date.now() - 20 * 86_400_000).toISOString(), titleBn: 'পুরনো দুই' }),
      event({ id: 'next', titleBn: 'সামনের কাজ' }),
    ]);
    await click('say-read');

    const said = spoken[0]!;
    expect(said).toContain('সামনের কাজ');
    expect(said).toContain('দুইটির সময় পেরিয়ে গেছে');
    // Counted, not recited — a missed date cannot be un-missed, and reciting them
    // delays the part the citizen can still act on.
    expect(said).not.toContain('পুরনো এক');
  });
});

/* -------------------------------------------------------- notifications */

const notification = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n1',
  title: 'Deadline soon',
  titleBn: 'শেষ তারিখ ঘনিয়ে এসেছে',
  body: 'Apply before 30 June',
  bodyBn: '৩০ জুনের আগে আবেদন করুন',
  type: 'deadline_reminder',
  read: false,
  actionUrl: null,
  createdAt: new Date().toISOString(),
  ...over,
});

function renderNotifications(items: readonly NotificationItem[]) {
  const unread = items.filter((i) => !i.read).length;
  render(
    <Providers>
      <Probe />
      <NotificationList items={items} initialUnread={unread} />
    </Providers>,
  );
}

describe('"পড়ে শোনাও" on notifications', () => {
  it('reads the unread ones', async () => {
    renderNotifications([notification()]);
    await click('say-read');

    const said = spoken[0]!;
    expect(said).toContain('শেষ তারিখ ঘনিয়ে এসেছে');
    expect(said).toContain('৩০ জুনের আগে আবেদন করুন');
  });

  it('does not read the ones already dealt with', async () => {
    /**
     * On screen an unread row is bold, green-dotted and outlined. In audio those
     * cues do not exist, so reading everything would bury the one thing the
     * citizen has not seen among the ones they have.
     */
    renderNotifications([
      notification({ id: 'old', titleBn: 'পুরনো খবর', bodyBn: 'আগেই দেখা হয়েছে', read: true }),
      notification({ id: 'new', titleBn: 'নতুন খবর', bodyBn: 'এখনো দেখা হয়নি', read: false }),
    ]);
    await click('say-read');

    const said = spoken[0]!;
    expect(said).toContain('নতুন খবর');
    expect(said).not.toContain('পুরনো খবর');
  });

  it('says so when everything has been read', async () => {
    renderNotifications([notification({ read: true })]);
    await click('say-read');

    expect(spoken[0]).toContain('পড়ে শোনানোর মতো কিছু নেই');
  });
});

describe('"সব পড়া হয়েছে" marks everything read', () => {
  it('waits for a yes before erasing the citizen’s record of what was new', async () => {
    // Not undoable, and it destroys their own list of what still needs dealing
    // with — so the registry marks it confirm: 'always'.
    renderNotifications([notification()]);

    await click('say-mark-all');
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByTestId('state').textContent).toBe('confirming');

    await click('say-yes');
    expect(patch).toHaveBeenCalledWith('/notifications', { all: true });
  });

  it('does nothing when there is nothing unread', async () => {
    renderNotifications([notification({ read: true })]);
    await click('say-mark-all');
    await click('say-yes');

    expect(patch).not.toHaveBeenCalled();
  });
});
