import { LIFE_EVENTS, OPPORTUNITY_CATEGORIES } from '@/lib/domain/enums';
import { DISTRICTS } from '@/lib/domain/geography';

/**
 * The voice command registry — the complete, FIXED set of things a citizen can
 * say to drive the app.
 *
 * Two decisions define this file.
 *
 * FIRST: no language model. Intent resolution is deterministic phrase matching,
 * for the same reason §24 forbids a model in the eligibility engine — a
 * misrouted command is not a wrong sentence, it is a wrong action. Determinism
 * also buys three things a model cannot: it works with no network and no API
 * key, it runs in ~1 ms so the citizen hears no lag, and every phrase that will
 * ever match is enumerable, reviewable, and testable. A model may later be added
 * to map an UNMATCHED utterance onto one of these ids — never to invent an id.
 *
 * SECOND: consequence decides confirmation, not confidence. Navigation is
 * reversible, so a wrong guess costs a tap. Marking a task done, unsaving a
 * programme, or signing out are not, so those are `confirm: 'always'` and the
 * app reads back what it is about to do and waits for a yes. A voice interface
 * that can silently mutate state on a mishearing is worse than no voice
 * interface, particularly for someone who cannot read the screen to check.
 */

export type CommandKind =
  /** Go somewhere. Reversible, so it acts immediately. */
  | 'navigate'
  /** Change something on the current screen. */
  | 'action'
  /** Ask the assistant — the utterance becomes a chat message. */
  | 'ask'
  /** Control the voice layer itself (stop reading, repeat, help). */
  | 'meta';

export type ConfirmPolicy =
  /** Act at once. */
  | 'never'
  /** Read the intent back and wait for a yes. */
  | 'always'
  /** Confirm only when the match was not exact. */
  | 'when-uncertain';

export interface CommandSlotSpec {
  readonly name: 'query' | 'district' | 'category' | 'lifeEvent' | 'index' | 'amount';
  readonly required: boolean;
}

export interface VoiceCommand {
  readonly id: string;
  readonly kind: CommandKind;
  readonly confirm: ConfirmPolicy;
  /**
   * Where it goes. `:slot` placeholders are filled from extracted slots.
   * Absent for actions and meta commands.
   */
  readonly route?: string;
  /** Requires a signed-in citizen. */
  readonly auth?: boolean;
  /** Staff-only, so a citizen saying it gets "not available", never a 403 page. */
  readonly staffOnly?: boolean;
  readonly slots?: readonly CommandSlotSpec[];
  /**
   * A REPLY to a confirmation, not a command. Excluded from general intent
   * resolution entirely and read only by `resolveConfirmation`.
   *
   * `করো` ("do it") is a yes phrase and a whole token inside `সেভ করো` ("save
   * it"), so leaving these in the command pool means an ordinary sentence can
   * resolve to "yes" — which, mid-confirmation, approves the very action the
   * citizen was being asked about. They are kept in the registry so the help
   * screen and the confirmation reader share one vocabulary.
   */
  readonly confirmationOnly?: boolean;
  /**
   * Phrases in Bangla, English, and Banglish. These are MATCH PATTERNS, not
   * copy: what the citizen is *shown* comes from the message catalogue, so this
   * list can be as long as it needs to be without bloating the UI.
   */
  readonly phrases: readonly string[];
  /** Catalogue key for the human-readable label, e.g. "Open saved programmes". */
  readonly labelKey: string;
}

/* ------------------------------------------------------------- navigation */

const NAVIGATION: readonly VoiceCommand[] = [
  {
    id: 'nav.dashboard',
    kind: 'navigate',
    confirm: 'never',
    route: '/dashboard',
    auth: true,
    labelKey: 'navDashboard',
    phrases: [
      'হোম', 'হোম পেজ', 'ড্যাশবোর্ড', 'প্রথম পাতা', 'শুরুর পাতা', 'মূল পাতা', 'বাড়ি',
      'home', 'dashboard', 'go home', 'main page', 'start page', 'take me home',
      'home page', 'hom', 'dashbord',
    ],
  },
  {
    id: 'nav.chat',
    kind: 'navigate',
    confirm: 'never',
    route: '/chat',
    auth: true,
    labelKey: 'navChat',
    phrases: [
      'কথা বলুন', 'কথা বলব', 'জিজ্ঞাসা', 'প্রশ্ন', 'প্রশ্ন করব', 'সহায়তা চাই', 'চ্যাট',
      'chat', 'talk', 'ask', 'ask a question', 'assistant', 'help me',
      'kotha bolbo', 'kotha bolun', 'prosno',
    ],
  },
  {
    id: 'nav.opportunities',
    kind: 'navigate',
    confirm: 'never',
    route: '/opportunities',
    labelKey: 'navOpportunities',
    phrases: [
      'সুযোগ', 'সুযোগগুলো', 'কর্মসূচি', 'কর্মসূচিগুলো', 'ভাতার তালিকা',
      'সব কর্মসূচি', 'কী কী আছে',
      // `তালিকা দেখাও` ("show the list") is deliberately NOT here: it is equally
      // a request for the saved list, and an ambiguous phrase in the registry
      // sends citizens to the wrong screen with high confidence.
      'opportunities', 'programmes', 'programs', 'benefits', 'all programmes',
      'browse', 'show me programmes', 'shujog', 'kormoshuchi',
    ],
  },
  {
    id: 'nav.saved',
    kind: 'navigate',
    confirm: 'never',
    route: '/saved',
    auth: true,
    labelKey: 'navSaved',
    phrases: [
      'সংরক্ষিত', 'সেভ করা', 'আমার তালিকা', 'সংরক্ষণ করা কর্মসূচি', 'বুকমার্ক',
      'saved', 'my list', 'bookmarks', 'saved programmes', 'my saved',
      'shongrokkhito', 'save kora',
    ],
  },
  {
    id: 'nav.timeline',
    kind: 'navigate',
    confirm: 'never',
    route: '/timeline',
    auth: true,
    labelKey: 'navTimeline',
    phrases: [
      'সময়সূচি', 'ক্যালেন্ডার', 'সময়রেখা', 'শেষ তারিখ', 'ডেডলাইন', 'কাজের তালিকা',
      'timeline', 'calendar', 'deadlines', 'my tasks', 'schedule',
      'somoysuchi', 'deadline',
    ],
  },
  {
    id: 'nav.nearby',
    kind: 'navigate',
    confirm: 'never',
    route: '/nearby',
    labelKey: 'navNearby',
    phrases: [
      'কাছের অফিস', 'কাছাকাছি', 'নিকটস্থ সেবা', 'অফিস কোথায়', 'কোথায় যাব',
      'nearby', 'near me', 'offices', 'nearest office', 'where do i go',
      'kacher office', 'nearby office',
    ],
  },
  {
    id: 'nav.notifications',
    kind: 'navigate',
    confirm: 'never',
    route: '/notifications',
    auth: true,
    labelKey: 'navNotifications',
    phrases: [
      'বিজ্ঞপ্তি', 'নোটিফিকেশন', 'খবর', 'নতুন কী', 'আপডেট',
      'notifications', 'alerts', 'updates', "what's new", 'notification',
    ],
  },
  {
    id: 'nav.profile',
    kind: 'navigate',
    confirm: 'never',
    route: '/profile',
    auth: true,
    labelKey: 'navProfile',
    phrases: [
      'প্রোফাইল', 'আমার তথ্য', 'আমার বিবরণ', 'তথ্য বদলাব', 'আমার প্রোফাইল',
      'profile', 'my details', 'my information', 'edit my details', 'my profile',
    ],
  },
  {
    id: 'nav.settings',
    kind: 'navigate',
    confirm: 'never',
    route: '/settings',
    auth: true,
    labelKey: 'navSettings',
    phrases: [
      'সেটিংস', 'সেটিং', 'পছন্দ', 'ভাষা বদলাব', 'লেখার আকার',
      'settings', 'preferences', 'options', 'change language', 'text size',
    ],
  },
  {
    id: 'nav.admin',
    kind: 'navigate',
    confirm: 'never',
    route: '/admin',
    auth: true,
    staffOnly: true,
    labelKey: 'navAdmin',
    phrases: ['অ্যাডমিন', 'প্রশাসন', 'admin', 'administration', 'admin panel'],
  },
];

/* ------------------------------------------------------- search + filters */

const SEARCH: readonly VoiceCommand[] = [
  {
    id: 'search.opportunities',
    kind: 'navigate',
    confirm: 'when-uncertain',
    route: '/opportunities?q=:query',
    slots: [{ name: 'query', required: true }],
    labelKey: 'searchOpportunities',
    phrases: [
      'খুঁজে দাও *', 'খোঁজ *', 'অনুসন্ধান *', '* খুঁজুন', '* সম্পর্কে দেখাও',
      'search for *', 'search *', 'find *', 'look for *', 'show me *',
      'khuje dao *', 'khoj *',
    ],
  },
  {
    id: 'filter.category',
    kind: 'navigate',
    confirm: 'when-uncertain',
    route: '/opportunities?category=:category',
    slots: [{ name: 'category', required: true }],
    labelKey: 'filterCategory',
    phrases: [
      ':category কর্মসূচি', ':category সুযোগ', ':category দেখাও',
      'show :category', ':category programmes', ':category benefits',
    ],
  },
  {
    id: 'filter.lifeEvent',
    kind: 'navigate',
    confirm: 'when-uncertain',
    route: '/opportunities?lifeEvent=:lifeEvent',
    slots: [{ name: 'lifeEvent', required: true }],
    labelKey: 'filterLifeEvent',
    phrases: [':lifeEvent', ':lifeEvent এর জন্য', 'help for :lifeEvent'],
  },
  {
    id: 'filter.district',
    kind: 'navigate',
    confirm: 'when-uncertain',
    route: '/nearby?district=:district',
    slots: [{ name: 'district', required: true }],
    labelKey: 'filterDistrict',
    phrases: [
      ':district এর অফিস', ':district জেলা', ':district এ কী আছে',
      'offices in :district', ':district district',
    ],
  },
];

/* ---------------------------------------------------------------- actions */

/**
 * Everything here changes state, so everything here confirms first. The
 * `confirm: 'always'` is not defensive politeness — it is the only thing
 * standing between a mishearing and an irreversible change made on behalf of
 * someone who may not be able to read what just happened.
 */
const ACTIONS: readonly VoiceCommand[] = [
  {
    id: 'action.save',
    kind: 'action',
    confirm: 'always',
    auth: true,
    labelKey: 'actionSave',
    phrases: [
      'এটা সংরক্ষণ করো', 'সেভ করো', 'তালিকায় রাখো', 'এটা রাখো', 'সংরক্ষণ',
      'save this', 'save it', 'add to my list', 'bookmark this', 'save kore rakho',
    ],
  },
  {
    id: 'action.unsave',
    kind: 'action',
    confirm: 'always',
    auth: true,
    labelKey: 'actionUnsave',
    phrases: [
      'সরিয়ে দাও', 'তালিকা থেকে বাদ দাও', 'সংরক্ষণ বাতিল',
      'remove this', 'unsave', 'remove from my list', 'delete from list',
    ],
  },
  {
    id: 'action.applyStarted',
    kind: 'action',
    confirm: 'always',
    auth: true,
    labelKey: 'actionApplyStarted',
    phrases: [
      'আবেদন করেছি', 'আবেদন করলাম', 'জমা দিয়েছি', 'আবেদন সম্পন্ন',
      'i have applied', 'mark as applied', 'i applied', 'application submitted',
    ],
  },
  {
    id: 'action.taskDone',
    kind: 'action',
    confirm: 'always',
    auth: true,
    labelKey: 'actionTaskDone',
    phrases: [
      'কাজটা শেষ', 'হয়ে গেছে', 'সম্পন্ন করেছি', 'এই কাজ শেষ', 'টিক দাও',
      'mark done', 'task done', 'completed', 'finished this', 'tick this off',
    ],
  },
  {
    id: 'action.checkEligibility',
    kind: 'action',
    confirm: 'never',
    auth: true,
    labelKey: 'actionCheckEligibility',
    phrases: [
      'আমি কি পাব', 'আমি যোগ্য কি', 'যোগ্যতা দেখাও', 'আমি কি এটা পেতে পারি',
      'am i eligible', 'check eligibility', 'do i qualify', 'can i get this',
    ],
  },
  {
    id: 'action.signOut',
    kind: 'action',
    confirm: 'always',
    auth: true,
    labelKey: 'actionSignOut',
    phrases: [
      'বেরিয়ে যাব', 'সাইন আউট', 'লগ আউট', 'প্রস্থান',
      'sign out', 'log out', 'logout', 'exit my account',
    ],
  },
];

/* ------------------------------------------------------------------- meta */

const META: readonly VoiceCommand[] = [
  {
    id: 'meta.readAloud',
    kind: 'meta',
    confirm: 'never',
    labelKey: 'metaReadAloud',
    phrases: [
      'পড়ে শোনাও', 'পড়ো', 'শোনাও', 'জোরে পড়ো', 'আবার পড়ো',
      'read this', 'read it out', 'read aloud', 'speak this', 'read to me',
      'pore shonao', 'porre shonao',
    ],
  },
  {
    id: 'meta.stopReading',
    kind: 'meta',
    confirm: 'never',
    labelKey: 'metaStopReading',
    phrases: [
      'থামো', 'চুপ', 'বন্ধ করো', 'পড়া বন্ধ', 'থামুন',
      'stop', 'stop reading', 'be quiet', 'silence', 'thamo',
    ],
  },
  {
    id: 'meta.repeat',
    kind: 'meta',
    confirm: 'never',
    labelKey: 'metaRepeat',
    phrases: [
      'আবার বলো', 'পুনরাবৃত্তি', 'আরেকবার', 'বুঝিনি',
      'repeat', 'say again', 'again', "i didn't understand", 'pardon',
    ],
  },
  {
    id: 'meta.help',
    kind: 'meta',
    confirm: 'never',
    labelKey: 'metaHelp',
    phrases: [
      'কী বলতে পারি', 'সাহায্য', 'কমান্ড', 'কী কী বলা যায়', 'নির্দেশনা',
      'what can i say', 'help', 'commands', 'voice help', 'ki bolte pari',
    ],
  },
  {
    id: 'meta.back',
    kind: 'meta',
    confirm: 'never',
    labelKey: 'metaBack',
    phrases: [
      'পিছনে', 'ফিরে যাও', 'আগের পাতা', 'বাতিল',
      'back', 'go back', 'previous page', 'cancel',
    ],
  },
  {
    id: 'meta.yes',
    kind: 'meta',
    confirm: 'never',
    confirmationOnly: true,
    labelKey: 'metaYes',
    phrases: ['হ্যাঁ', 'হ্যা', 'হ', 'ঠিক আছে', 'করো', 'অবশ্যই', 'yes', 'yeah', 'ok', 'okay', 'confirm', 'do it', 'ha', 'hae'],
  },
  {
    id: 'meta.no',
    kind: 'meta',
    confirm: 'never',
    confirmationOnly: true,
    labelKey: 'metaNo',
    phrases: ['না', 'নাহ', 'করো না', 'বাদ দাও', 'no', 'nope', 'cancel that', 'do not', "don't", 'na'],
  },
];

export const VOICE_COMMANDS: readonly VoiceCommand[] = [...NAVIGATION, ...SEARCH, ...ACTIONS, ...META];

export const COMMAND_BY_ID: ReadonlyMap<string, VoiceCommand> = new Map(
  VOICE_COMMANDS.map((command) => [command.id, command]),
);

/* ------------------------------------------------------- slot vocabulary */

/**
 * Spoken forms for the enum slots.
 *
 * These are matched against, so they include the plausible mishearings and the
 * colloquial words a citizen would actually use — nobody says "livelihood
 * category", they say "কাজ" or "ব্যবসা".
 */
export const CATEGORY_PHRASES: Record<string, readonly string[]> = {
  scholarship: ['বৃত্তি', 'শিক্ষা', 'পড়াশোনা', 'স্কলারশিপ', 'scholarship', 'education', 'study', 'brittti', 'shikkha'],
  healthcare: ['স্বাস্থ্য', 'চিকিৎসা', 'ডাক্তার', 'হাসপাতাল', 'health', 'healthcare', 'medical', 'treatment', 'shastho'],
  agriculture: ['কৃষি', 'চাষ', 'ফসল', 'কৃষক', 'agriculture', 'farming', 'crop', 'krishi'],
  business: ['ব্যবসা', 'উদ্যোক্তা', 'ব্যবসার ঋণ', 'business', 'entrepreneur', 'enterprise', 'byabsa'],
  legal_aid: ['আইনি', 'আইন', 'মামলা', 'আইনি সহায়তা', 'legal', 'law', 'legal aid', 'aini shohayota'],
  employment: ['চাকরি', 'কাজ', 'নিয়োগ', 'job', 'employment', 'work', 'chakri'],
  financial: ['ঋণ', 'আর্থিক', 'টাকা', 'অনুদান', 'loan', 'financial', 'grant', 'credit', 'rin'],
  social_welfare: ['ভাতা', 'সমাজসেবা', 'কল্যাণ', 'সামাজিক', 'welfare', 'allowance', 'social', 'bhata'],
  training: ['প্রশিক্ষণ', 'ট্রেনিং', 'দক্ষতা', 'training', 'skills', 'course', 'proshikkhon'],
  disaster: ['দুর্যোগ', 'বন্যা', 'ঝড়', 'ক্ষতিপূরণ', 'disaster', 'flood', 'cyclone', 'relief', 'durjog'],
  research: ['গবেষণা', 'রিসার্চ', 'research', 'fellowship', 'gobeshona'],
};

export const LIFE_EVENT_PHRASES: Record<string, readonly string[]> = {
  widowhood: ['বিধবা', 'স্বামী মারা', 'স্বামীর মৃত্যু', 'widow', 'husband died', 'bidhoba'],
  job_loss: ['চাকরি হারিয়েছি', 'কাজ নেই', 'বেকার', 'lost my job', 'unemployed', 'no work'],
  disability_onset: ['প্রতিবন্ধী হয়েছি', 'অক্ষম হয়েছি', 'became disabled', 'disability'],
  old_age: ['বৃদ্ধ', 'বয়স্ক', 'old age', 'elderly', 'briddho'],
  pregnancy: ['গর্ভবতী', 'সন্তান হবে', 'pregnant', 'pregnancy', 'gorbhoboti'],
  serious_medical_need: ['অসুস্থ', 'বড় রোগ', 'ক্যান্সার', 'seriously ill', 'cancer', 'kidney'],
  higher_education: ['উচ্চশিক্ষা', 'ভর্তি', 'বিশ্ববিদ্যালয়', 'higher education', 'university', 'admission'],
  child_education: ['সন্তানের পড়া', 'বাচ্চার স্কুল', 'child education', 'school fees'],
  crop_loss: ['ফসল নষ্ট', 'ফসল হারিয়েছি', 'crop loss', 'harvest failed'],
  disaster_recovery: ['বন্যা', 'ঝড়', 'দুর্যোগ', 'flood', 'cyclone', 'disaster'],
  legal_dispute: ['মামলা', 'আইনি সমস্যা', 'legal dispute', 'court case'],
  entrepreneurship: ['ব্যবসা শুরু', 'নতুন ব্যবসা', 'start a business', 'new business'],
  seeking_employment: ['চাকরি খুঁজছি', 'কাজ খুঁজছি', 'looking for work', 'job search'],
  migration: ['বিদেশ যাব', 'প্রবাস', 'go abroad', 'migration', 'bidesh'],
  divorce: ['তালাক', 'বিচ্ছেদ', 'divorce', 'separated', 'talak'],
};

/** District slot vocabulary, built from the geography table so it cannot drift. */
export const DISTRICT_PHRASES: Record<string, readonly string[]> = Object.fromEntries(
  DISTRICTS.map((district) => [district.code, [district.en.toLowerCase(), district.bn]]),
);

/** Guards against a typo in a slot id going unnoticed. */
export function validateCommandRegistry(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  for (const command of VOICE_COMMANDS) {
    if (ids.has(command.id)) problems.push(`Duplicate command id: ${command.id}`);
    ids.add(command.id);

    if (command.phrases.length === 0) problems.push(`${command.id} has no phrases`);

    // A phrase list with only English entries would be unusable for the default
    // locale, which is the one most of this audience uses.
    const hasBangla = command.phrases.some((p) => /[ঀ-৿]/.test(p));
    if (!hasBangla) problems.push(`${command.id} has no Bangla phrase`);

    for (const slot of command.slots ?? []) {
      if (command.route && !command.route.includes(`:${slot.name}`)) {
        problems.push(`${command.id} declares slot "${slot.name}" but its route never uses it`);
      }
    }

    if (command.route?.includes(':')) {
      const placeholders = command.route.match(/:(\w+)/g) ?? [];
      for (const placeholder of placeholders) {
        const name = placeholder.slice(1);
        if (!(command.slots ?? []).some((s) => s.name === name)) {
          problems.push(`${command.id} route needs "${name}" but declares no such slot`);
        }
      }
    }
  }

  for (const category of OPPORTUNITY_CATEGORIES) {
    if (!CATEGORY_PHRASES[category]) problems.push(`Category "${category}" has no spoken phrases`);
  }
  for (const event of LIFE_EVENTS) {
    if (!LIFE_EVENT_PHRASES[event]) problems.push(`Life event "${event}" has no spoken phrases`);
  }

  return problems;
}
