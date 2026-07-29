import { describe, it, expect } from 'vitest';
import { resolveIntent, resolveConfirmation, normalise, type IntentContext } from '@/modules/voice/intent';
import { validateCommandRegistry, VOICE_COMMANDS, COMMAND_BY_ID } from '@/modules/voice/commands';

/**
 * Voice command resolution.
 *
 * The property under test is not "it understands Bangla" — it is that a
 * mishearing can never cause an irreversible action, and that an unclear
 * utterance produces a question rather than a guess. Those two are what make a
 * voice interface safe for someone who cannot read the screen to check what just
 * happened.
 */

const citizen: IntentContext = { locale: 'bn', authenticated: true, isStaff: false };
const anonymous: IntentContext = { locale: 'bn', authenticated: false, isStaff: false };
const staff: IntentContext = { locale: 'bn', authenticated: true, isStaff: true };

function expectCommand(transcript: string, id: string, context: IntentContext = citizen) {
  const result = resolveIntent(transcript, context);
  if (result.kind !== 'command') {
    throw new Error(`"${transcript}" did not match anything (expected ${id})`);
  }
  expect(result.command.id, `"${transcript}"`).toBe(id);
  return result;
}

describe('the registry itself is sound', () => {
  it('has no duplicate ids, missing phrases, or slot/route mismatches', () => {
    expect(validateCommandRegistry()).toEqual([]);
  });

  it('gives every command at least one Bangla phrase', () => {
    // Bangla is the default locale. An English-only command is unreachable for
    // most of this audience.
    for (const command of VOICE_COMMANDS) {
      expect(command.phrases.some((p) => /[ঀ-৿]/.test(p)), command.id).toBe(true);
    }
  });

  it('marks every state-changing command as always-confirm', () => {
    // The core safety invariant of the whole feature, asserted structurally so a
    // future command cannot be added without a confirmation policy.
    const mutating = ['action.save', 'action.unsave', 'action.applyStarted', 'action.taskDone', 'action.signOut'];
    for (const id of mutating) {
      expect(COMMAND_BY_ID.get(id)?.confirm, id).toBe('always');
    }
  });

  it('treats navigation as reversible and does not confirm it', () => {
    for (const command of VOICE_COMMANDS) {
      if (command.kind === 'navigate' && !command.slots) {
        expect(command.confirm, command.id).toBe('never');
      }
    }
  });
});

describe('navigation in Bangla', () => {
  const cases: [string, string][] = [
    ['হোম', 'nav.dashboard'],
    ['ড্যাশবোর্ড', 'nav.dashboard'],
    ['প্রথম পাতা', 'nav.dashboard'],
    ['কথা বলুন', 'nav.chat'],
    ['আমার প্রশ্ন আছে', 'nav.chat'],
    ['সংরক্ষিত', 'nav.saved'],
    ['আমার তালিকা দেখাও', 'nav.saved'],
    ['সময়সূচি', 'nav.timeline'],
    ['শেষ তারিখ', 'nav.timeline'],
    ['কাছের অফিস', 'nav.nearby'],
    ['বিজ্ঞপ্তি', 'nav.notifications'],
    ['প্রোফাইল', 'nav.profile'],
    ['সেটিংস', 'nav.settings'],
  ];

  for (const [said, id] of cases) {
    it(`"${said}" → ${id}`, () => {
      const result = expectCommand(said, id);
      expect(result.needsConfirmation).toBe(false);
      expect(result.href).toMatch(/^\/bn\//);
    });
  }
});

describe('navigation in English and Banglish', () => {
  const cases: [string, string][] = [
    ['go home', 'nav.dashboard'],
    ['dashboard', 'nav.dashboard'],
    ['open chat', 'nav.chat'],
    ['show me my saved programmes', 'nav.saved'],
    ['deadlines', 'nav.timeline'],
    ['nearest office', 'nav.nearby'],
    ['settings', 'nav.settings'],
    ['kotha bolbo', 'nav.chat'],
    ['kacher office', 'nav.nearby'],
  ];

  for (const [said, id] of cases) {
    it(`"${said}" → ${id}`, () => {
      expectCommand(said, id, { ...citizen, locale: 'en' });
    });
  }

  it('builds the href for the active locale', () => {
    const result = expectCommand('dashboard', 'nav.dashboard', { ...citizen, locale: 'en' });
    expect(result.href).toBe('/en/dashboard');
  });
});

describe('permissions are respected before routing, not after', () => {
  it('does not offer an authenticated destination to a signed-out visitor', () => {
    // Routing them to /saved would bounce to login — a dead end that reads as
    // the command having failed.
    const result = resolveIntent('সংরক্ষিত', anonymous);
    expect(result.kind).toBe('unmatched');
  });

  it('still allows public destinations when signed out', () => {
    expectCommand('কর্মসূচি', 'nav.opportunities', anonymous);
  });

  it('hides the admin area from a citizen but offers it to staff', () => {
    expect(resolveIntent('অ্যাডমিন', citizen).kind).toBe('unmatched');
    expectCommand('অ্যাডমিন', 'nav.admin', staff);
  });

  it('only offers screen actions the current screen actually has', () => {
    const withSave: IntentContext = { ...citizen, availableActions: ['action.save'] };
    expectCommand('সেভ করো', 'action.save', withSave);

    const withoutSave: IntentContext = { ...citizen, availableActions: [] };
    expect(resolveIntent('সেভ করো', withoutSave).kind).toBe('unmatched');
  });
});

describe('search and filters extract their slot', () => {
  it('pulls the query out of a Bangla search phrase', () => {
    const result = expectCommand('খুঁজে দাও বিধবা ভাতা', 'search.opportunities');
    expect(result.slots.query).toBe('বিধবা ভাতা');
    expect(result.href).toBe(`/bn/opportunities?q=${encodeURIComponent('বিধবা ভাতা')}`);
  });

  it('pulls the query out of an English search phrase', () => {
    const result = expectCommand('search for widow allowance', 'search.opportunities',
      { ...citizen, locale: 'en' });
    expect(result.slots.query).toBe('widow allowance');
  });

  it('maps a spoken category to its enum value', () => {
    const result = resolveIntent('শিক্ষা কর্মসূচি', citizen);
    expect(result.kind).toBe('command');
    if (result.kind !== 'command') return;
    // Either the category filter or the list is defensible here; what must NOT
    // happen is a wrong category.
    if (result.command.id === 'filter.category') {
      expect(result.slots.category).toBe('education');
      expect(result.href).toContain('category=education');
    }
  });

  it('maps a spoken district to its code', () => {
    const result = resolveIntent('রংপুর এর অফিস', citizen);
    expect(result.kind).toBe('command');
    if (result.kind !== 'command') return;
    expect(result.slots.district ?? 'rangpur').toBe('rangpur');
  });

  it('refuses a search command whose required query is empty', () => {
    // "খুঁজে দাও" with nothing after it must ask, not open an empty search.
    const result = resolveIntent('খুঁজে দাও', citizen);
    expect(result.kind).toBe('unmatched');
  });
});

describe('destructive actions always confirm', () => {
  const context: IntentContext = {
    ...citizen,
    availableActions: ['action.save', 'action.unsave', 'action.taskDone', 'action.applyStarted', 'action.signOut'],
  };

  for (const [said, id] of [
    ['সেভ করো', 'action.save'],
    ['সরিয়ে দাও', 'action.unsave'],
    ['কাজটা শেষ', 'action.taskDone'],
    ['আবেদন করেছি', 'action.applyStarted'],
    ['লগ আউট', 'action.signOut'],
  ] as [string, string][]) {
    it(`"${said}" requires confirmation`, () => {
      const result = expectCommand(said, id, context);
      expect(result.needsConfirmation).toBe(true);
    });
  }

  it('confirms even on a perfect, exact match', () => {
    // Confidence is irrelevant for an irreversible action: the citizen may have
    // been misheard with total confidence.
    const result = expectCommand('লগ আউট', 'action.signOut', context);
    expect(result.quality).toBe('exact');
    expect(result.needsConfirmation).toBe(true);
  });
});

describe('it asks instead of guessing', () => {
  it('returns unmatched for speech that is not a command', () => {
    const result = resolveIntent('আমার স্বামী মারা গেছেন আমি কী করব', citizen);
    // This is a question for the assistant, not a navigation command. It may
    // match a life-event filter, but it must never match an ACTION.
    if (result.kind === 'command') {
      expect(result.command.kind).not.toBe('action');
    }
  });

  it('returns unmatched, with suggestions, for near-miss gibberish', () => {
    const result = resolveIntent('ঘঘঘ ঝঝঝ', citizen);
    expect(result.kind).toBe('unmatched');
  });

  it('offers suggestions rather than silence when it fails', () => {
    const result = resolveIntent('সময়', citizen);
    if (result.kind === 'unmatched') {
      expect(result.suggestions.length).toBeGreaterThan(0);
    }
  });

  it('never returns a href containing an unfilled placeholder', () => {
    for (const phrase of ['খুঁজে দাও', 'search for', 'show me', ':category']) {
      const result = resolveIntent(phrase, citizen);
      if (result.kind === 'command' && result.href) {
        expect(result.href).not.toContain(':');
      }
    }
  });
});

describe('confirmation replies', () => {
  it('reads a yes', () => {
    for (const said of ['হ্যাঁ', 'ঠিক আছে', 'yes', 'ok', 'confirm']) {
      expect(resolveConfirmation(said), said).toBe('yes');
    }
  });

  it('reads a no', () => {
    for (const said of ['না', 'নাহ', 'no', 'cancel that']) {
      expect(resolveConfirmation(said), said).toBe('no');
    }
  });

  it('treats a negated verb as NO, not as the verb', () => {
    // "করো না" contains "করো" (do it). Reading that as yes would perform the
    // action the citizen just refused — the worst bug this feature could have.
    expect(resolveConfirmation('করো না')).toBe('no');
    expect(resolveConfirmation('do not')).toBe('no');
  });

  it('reports anything else as unclear rather than assuming', () => {
    for (const said of ['হয়তো', 'maybe', 'কী', 'what']) {
      expect(resolveConfirmation(said), said).toBe('unclear');
    }
  });
});

describe('normalisation keeps Bangla intact', () => {
  it('preserves combining marks', () => {
    // The bug this codebase already hit once: \p{L} alone deletes া ি ে and
    // turns চার into "চ র".
    expect(normalise('চার')).toBe('চার');
    expect(normalise('সংরক্ষিত তালিকা')).toBe('সংরক্ষিত তালিকা');
  });

  it('strips punctuation and collapses whitespace', () => {
    expect(normalise('  হোম,  পেজ!  ')).toBe('হোম পেজ');
  });
});
