/* eslint-disable no-console */
import './load-env';
import { sttPromptFor, STT_PROMPT_LIMIT } from '../src/modules/voice/stt-prompt';

const command = sttPromptFor('command') ?? '';
const dictation = sttPromptFor('dictation') ?? '';

console.log(`COMMAND prompt (${command.length}/${STT_PROMPT_LIMIT} chars):`);
console.log(`  ${command}\n`);
console.log(`DICTATION prompt (${dictation.length} chars):`);
console.log(`  ${dictation.slice(0, 220)}…`);
