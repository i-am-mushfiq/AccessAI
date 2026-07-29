import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal .env loader for CLI scripts.
 *
 * Next.js loads `.env.local` automatically, but `tsx` does not, and pulling in
 * `dotenv` for four lines of parsing is not worth a dependency. Precedence
 * matches Next: `.env.local` overrides `.env`, and a variable already present
 * in the real environment always wins.
 */
function parse(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // A quoted value ends at its closing quote; anything after it (typically an
    // inline `# comment`) is discarded. An unquoted value ends at the first
    // whitespace-preceded `#`. This matches dotenv, and getting it wrong turns
    // a documented default into a validation failure.
    const quote = value[0];
    if (quote === '"' || quote === "'") {
      const close = value.indexOf(quote, 1);
      value = close === -1 ? value.slice(1) : value.slice(1, close);
    } else {
      const comment = value.search(/\s#/);
      if (comment !== -1) value = value.slice(0, comment).trim();
    }
    out[key] = value;
  }
  return out;
}

export function loadEnv(): void {
  for (const file of ['.env', '.env.local']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const values = parse(readFileSync(path, 'utf8'));
    for (const [key, value] of Object.entries(values)) {
      // Real environment variables take precedence over file values.
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnv();
