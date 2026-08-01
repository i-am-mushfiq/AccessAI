/* eslint-disable no-console */
import './load-env';
import { resolveIntent } from '../src/modules/voice/intent';
import { validateCommandRegistry } from '../src/modules/voice/commands';

/**
 * Does Bangla voice NAVIGATION resolve?
 *
 * Separates the two things that get conflated when someone says "Bangla voice
 * does not work":
 *
 *   1. The microphone cannot hear anything — a provider/browser problem, and
 *      identical in every language. `npm run voice:check` answers that.
 *   2. The words were heard but did not resolve to a command — a matcher
 *      problem, and the only one that is Bangla-specific.
 *
 * This answers (2) with no microphone involved, because intent resolution is
 * deterministic: the same code path a spoken transcript takes, entered as text.
 *
 * Run:  npx tsx scripts/voice-bangla-probe.ts
 */

const context = {
  locale: 'bn' as const,
  authenticated: true,
  isStaff: true,
  availableActions: [
    'action.save', 'action.unsave', 'action.applyStarted', 'action.taskDone',
    'action.signOut', 'action.markAllRead', 'action.newChat',
    'action.biggerText', 'action.smallerText', 'action.checkEligibility',
  ],
};

/** What a citizen would actually say, including filler and politeness. */
const CASES: readonly string[] = [
  // plain navigation
  'হোম',
  'ড্যাশবোর্ড',
  'সংরক্ষিত',
  'সময়সূচি',
  'কাছের অফিস',
  'বিজ্ঞপ্তি',
  'প্রোফাইল',
  'সেটিংস',
  'কর্মসূচি',
  'সুযোগ',
  'কথা বলুন',
  // polite / inflected forms
  'সংরক্ষিত দেখান',
  'আমার তালিকা দেখাও',
  'হোম পেজে যাও',
  'সময়সূচি দেখতে চাই',
  'কাছাকাছি অফিস কোথায়',
  // with filler, as speech recognition returns it
  'আচ্ছা সংরক্ষিত দেখাও',
  'একটু সময়সূচি দেখান তো',
  'ভাই কাছের অফিস দেখাও',
  // actions
  'সেভ করো',
  'এটা সংরক্ষণ করুন',
  'লগ আউট',
  'লেখা বড় করো',
  'পড়ে শোনাও',
  'সাহায্য',
  'পিছনে',
  // search with a payload
  'বিধবা ভাতা খুঁজে দাও',
  'খুঁজে দাও বৃত্তি',
  // staff
  'কর্মসূচি ব্যবস্থাপনা',
  'পর্যালোচনা',
  // Banglish, which Bangla speakers type and recognisers emit
  'shongrokkhito',
  'kacher office',
  'somoysuchi',
];

function main() {
  const problems = validateCommandRegistry();
  console.log(`\nregistry: ${problems.length === 0 ? 'OK' : `${problems.length} PROBLEM(S)`}`);
  for (const problem of problems) console.log(`  ! ${problem}`);

  let matched = 0;
  const failures: string[] = [];

  console.log('\nresolving Bangla commands (no microphone involved):\n');
  for (const said of CASES) {
    const result = resolveIntent(said, context);
    if (result.kind === 'command') {
      matched += 1;
      const target = result.href ?? result.command.id;
      console.log(`  OK    ${said.padEnd(30)} -> ${result.command.id}  ${result.href ? `(${target})` : ''}`);
    } else {
      failures.push(said);
      const hint = result.suggestions.map((s) => s.command.id).slice(0, 3).join(', ');
      console.log(`  MISS  ${said.padEnd(30)} -> unmatched   suggestions: ${hint || 'none'}`);
    }
  }

  console.log(`\n${matched}/${CASES.length} resolved.`);
  if (failures.length > 0) {
    console.log('\nunmatched:');
    for (const failure of failures) console.log(`  ${failure}`);
  }
}

main();
