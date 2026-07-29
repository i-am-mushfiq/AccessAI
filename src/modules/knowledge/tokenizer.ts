/**
 * Bilingual tokenisation for lexical retrieval.
 *
 * Bangla is written without inter-word spaces being a reliable guide to
 * morpheme boundaries, and it has no widely available stemmer of production
 * quality. Rather than pretend otherwise, this tokeniser:
 *
 *  1. Splits on anything that is not a letter or digit in either script.
 *  2. Strips a short list of high-frequency Bangla suffixes (-টি, -টা, -গুলো,
 *     -এর, -কে, -য়ে …) which are genuinely productive and safe to remove.
 *  3. Applies light English suffix trimming, deliberately conservative.
 *  4. Removes stopwords in both languages.
 *
 * The goal is recall for BM25, not linguistic correctness. Over-aggressive
 * stemming on Bangla conjuncts produces false matches that are worse than a
 * missed one, because a citizen acting on a wrong programme wastes a trip to a
 * government office.
 */

const BANGLA_RANGE = 'ঀ-৿';

const TOKEN_SPLIT = new RegExp(`[^a-z0-9${BANGLA_RANGE}]+`, 'g');

const BANGLA_STOPWORDS = new Set([
  'এবং', 'বা', 'কিন্তু', 'এই', 'সেই', 'যে', 'তার', 'আমি', 'আমার', 'আমাকে', 'আমরা',
  'তুমি', 'আপনি', 'আপনার', 'তিনি', 'এটি', 'এটা', 'কি', 'কী', 'না', 'নেই', 'হবে',
  'হয়', 'হয়েছে', 'করা', 'করে', 'করতে', 'জন্য', 'থেকে', 'সঙ্গে', 'মধ্যে', 'পরে',
  'আগে', 'সব', 'কোন', 'কোনো', 'যদি', 'তাহলে', 'ও', 'একটি', 'একটা', 'অনেক', 'খুব',
  'আছে', 'ছিল', 'দিয়ে', 'উপর', 'দ্বারা', 'যা', 'যার',
]);

const ENGLISH_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can',
  'could', 'should', 'may', 'might', 'must', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
  'he', 'she', 'it', 'its', 'they', 'them', 'their', 'this', 'that', 'these', 'those',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'as', 'about', 'into',
  'through', 'during', 'not', 'no', 'so', 'than', 'too', 'very', 'just', 'also', 'any',
  'all', 'some', 'more', 'most', 'other', 'such', 'only', 'own', 'same', 'up', 'out',
]);

/** Productive Bangla suffixes, longest first so "গুলোর" strips before "র". */
const BANGLA_SUFFIXES = [
  'গুলোর', 'গুলোকে', 'গুলো', 'গুলি', 'দেরকে', 'দের', 'টির', 'টিকে', 'টার', 'টাকে',
  'েতে', 'তেই', 'কেই', 'রই', 'টি', 'টা', 'খানা', 'এর', 'ের', 'কে', 'তে', 'য়ে', 'ই',
];

const ENGLISH_SUFFIXES = ['ational', 'iveness', 'fulness', 'ousness', 'ization', 'ations', 'ingly', 'edly', 'ies', 'ing', 'ers', 'er', 'ed', 'es', 's'];

function stemBangla(token: string): string {
  for (const suffix of BANGLA_SUFFIXES) {
    // Keep at least 3 characters: stripping "টি" from "টি" leaves nothing, and
    // over-trimming short words destroys their identity.
    if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

function stemEnglish(token: string): string {
  if (token.length <= 4) return token;
  for (const suffix of ENGLISH_SUFFIXES) {
    if (token.length > suffix.length + 3 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

const banglaOnly = new RegExp(`^[${BANGLA_RANGE}]+$`);

export function tokenize(text: string): string[] {
  if (!text) return [];
  const lowered = text.toLowerCase();
  const raw = lowered.split(TOKEN_SPLIT).filter(Boolean);

  const out: string[] = [];
  for (const token of raw) {
    if (token.length < 2) continue;
    if (BANGLA_STOPWORDS.has(token) || ENGLISH_STOPWORDS.has(token)) continue;
    const stemmed = banglaOnly.test(token) ? stemBangla(token) : stemEnglish(token);
    if (stemmed.length >= 2) out.push(stemmed);
  }
  return out;
}

export function termFrequencies(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of tokenize(text)) {
    counts[token] = (counts[token] ?? 0) + 1;
  }
  return counts;
}

/**
 * Splits a document into retrieval chunks on paragraph boundaries, merging
 * short paragraphs so a chunk carries enough context to be useful as a citation
 * on its own. Bangla and English text for the same passage stay together so a
 * query in either language can retrieve it.
 */
export function chunkText(text: string, targetChars = 900, maxChars = 1400): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      // Split an over-long paragraph on sentence boundaries in both scripts
      // (Bangla uses the danda "।").
      const sentences = paragraph.split(/(?<=[।.!?])\s+/);
      let buffer = '';
      for (const sentence of sentences) {
        if ((buffer + ' ' + sentence).trim().length > targetChars && buffer) {
          chunks.push(buffer.trim());
          buffer = sentence;
        } else {
          buffer = `${buffer} ${sentence}`.trim();
        }
      }
      if (buffer) chunks.push(buffer.trim());
      continue;
    }

    if ((current + '\n\n' + paragraph).trim().length > targetChars && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Rough token estimate for budget accounting; Bangla runs denser per char. */
export function estimateTokens(text: string): number {
  const banglaChars = (text.match(new RegExp(`[${BANGLA_RANGE}]`, 'g')) ?? []).length;
  const otherChars = text.length - banglaChars;
  return Math.ceil(banglaChars / 2.5 + otherChars / 4);
}
