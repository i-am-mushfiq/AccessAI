import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const layout = readFileSync(resolve(__dirname, '../../src/app/[locale]/layout.tsx'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../src/app/globals.css'), 'utf8');
const tailwind = readFileSync(resolve(__dirname, '../../tailwind.config.ts'), 'utf8');

describe('Bengali typography contract', () => {
  it('configures local Noto Sans Bengali with every UI weight and fallbacks', () => {
    expect(layout).toContain("from 'next/font/local'");
    expect(layout).toContain("public/fonts/NotoSansBengali.ttf");
    expect(layout).toContain("weight: '100 900'");
    expect(layout).toContain("fallback: ['Nirmala UI', 'Kalpurush']");
  });

  it('keeps Bengali shaping enabled and prevents synthetic faces', () => {
    expect(css).toContain("'akhn' 1");
    expect(css).toContain("'rphf' 1");
    expect(css).toContain('font-synthesis: none');
  });

  it('makes form controls inherit the document font', () => {
    expect(css).toContain('button,\n  input,\n  select,\n  textarea');
    expect(css).toContain('font-family: inherit;');
    expect(css).toContain('::placeholder');
  });

  it('declares stable named Bengali fallbacks without an external CSS import', () => {
    expect(tailwind).toContain("'Noto Sans Bengali'");
    expect(tailwind).toContain("'Nirmala UI'");
    expect(tailwind).toContain("'Kalpurush'");
    expect(css).not.toMatch(/@import\s+url\(/i);
  });
});
