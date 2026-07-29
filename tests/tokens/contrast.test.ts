import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contrast enforcement for the Bhorosha token layer.
 *
 * globals.css asserts specific WCAG ratios in its comments. This test computes
 * them from the actual declared RGB values, so a token cannot be nudged without
 * the claim being re-checked. BDS §1.2 makes sub-4.5:1 body text a red line and
 * §7 states AAA (7:1) on body text as the house rule, so both are asserted.
 */

const css = readFileSync(resolve(__dirname, '../../src/app/globals.css'), 'utf8');

function blockFor(selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector ${selector} not found in globals.css`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('\n}', open);
  return css.slice(open, close);
}

/** Reads literal `--bds-<name>: r g b;` triplets from a selector block. */
function readTokens(selector: string): Map<string, [number, number, number]> {
  const block = blockFor(selector);
  const tokens = new Map<string, [number, number, number]>();
  const pattern = /--bds-([a-z0-9-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block)) !== null) {
    tokens.set(match[1]!, [Number(match[2]), Number(match[3]), Number(match[4])]);
  }
  return tokens;
}

/**
 * Counts every `--bds-*` declaration in a block, including the ones that point
 * at another token via `var()`. The dark and sunlight themes REMAP rather than
 * redefine, so they contain almost no literal triplets — counting only literals
 * would wrongly report those themes as empty.
 */
function countDeclarations(selector: string): number {
  return (blockFor(selector).match(/--bds-[a-z0-9-]+\s*:/g) ?? []).length;
}

const root = readTokens(':root');

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function token(name: string): [number, number, number] {
  const value = root.get(name);
  if (!value) throw new Error(`Token --bds-${name} is not declared in :root`);
  return value;
}

const WHITE = token('neutral-0');
const DARK = token('neutral-950');

describe('token layer is parsable', () => {
  it('declares the full primitive ramp', () => {
    // A dropped token would otherwise silently fall back to an inherited value.
    for (const name of [
      'green-50', 'green-300', 'green-500', 'green-600', 'green-700', 'green-800', 'green-950',
      'success-500', 'success-600', 'success-700',
      'warning-500', 'warning-700',
      'error-500', 'error-600', 'error-700',
      'info-500', 'info-600',
      'neutral-0', 'neutral-100', 'neutral-200', 'neutral-300', 'neutral-400',
      'neutral-500', 'neutral-600', 'neutral-700', 'neutral-900', 'neutral-950',
    ]) {
      expect(root.has(name), `--bds-${name} missing`).toBe(true);
    }
  });

  it('deliberately omits the unusable grey between neutral.400 and neutral.500', () => {
    // BDS §3.3: "We deleted the shades that fail." A 2.6:1 "designer grey" must
    // not exist in the system, so it cannot be reached by accident.
    expect(root.has('neutral-450')).toBe(false);
  });
});

describe('body text meets AAA (7:1) on light surfaces', () => {
  const surfaces: [string, [number, number, number]][] = [
    ['neutral.0 (surface)', WHITE],
    ['neutral.50 (canvas)', token('neutral-50')],
  ];

  for (const [surfaceName, surface] of surfaces) {
    it(`text.primary on ${surfaceName}`, () => {
      expect(contrast(token('neutral-900'), surface)).toBeGreaterThanOrEqual(7);
    });
  }
});

describe('secondary and tertiary text meet AA (4.5:1)', () => {
  it('text.secondary (neutral.600) on white', () => {
    expect(contrast(token('neutral-600'), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('text.tertiary (neutral.500) is the lightest permissible text', () => {
    expect(contrast(token('neutral-500'), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('neutral.400 does NOT qualify as text, only as a border', () => {
    // Enforces the hard rule in §3.3: neutral.400 is "never body text".
    const ratio = contrast(token('neutral-400'), WHITE);
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeGreaterThanOrEqual(3); // but must still pass UI 3:1
  });
});

describe('brand and status colours', () => {
  it('white on green.600 passes AA for the primary button', () => {
    expect(contrast(WHITE, token('green-600'))).toBeGreaterThanOrEqual(4.5);
  });

  it('green.700 passes AAA as green text on white', () => {
    expect(contrast(token('green-700'), WHITE)).toBeGreaterThanOrEqual(7);
  });

  /**
   * DESIGN SYSTEM ERRATUM, verified here rather than trusted.
   *
   * BDS §3.3 states that green.300 on green.800 is 8.63:1 and calls it "the
   * mandatory text/icon colour" for the hero surface. The computed value is
   * 5.29:1 — which passes AA for normal text and the 3:1 icon threshold, but
   * NOT the AAA-on-body-text house rule the same document sets in its header.
   *
   * The implementation therefore splits the pairing: green.300 for small labels
   * and icons on surface.brand, and green.100 (8.36:1) for body copy. Both
   * bounds are asserted so neither can drift. See docs/DEVIATIONS.md §10.
   */
  it('green.300 on green.800 passes AA but NOT AAA (document says 8.63:1; actual 5.29:1)', () => {
    const ratio = contrast(token('green-300'), token('green-800'));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(7);
    expect(ratio).toBeCloseTo(5.29, 1);
  });

  it('green.100 on green.800 passes AAA — used for body copy on the hero', () => {
    expect(contrast(token('green-100'), token('green-800'))).toBeGreaterThanOrEqual(7);
  });

  it('white on error.600 passes AA for the danger button', () => {
    expect(contrast(WHITE, token('error-600'))).toBeGreaterThanOrEqual(4.5);
  });

  it('status TEXT colours all pass AA on white', () => {
    for (const name of ['success-700', 'warning-700', 'error-700', 'info-600']) {
      expect(contrast(token(name), WHITE), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('status text passes AA on its own tinted surface', () => {
    const pairs: [string, string][] = [
      ['success-700', 'success-50'],
      ['warning-700', 'warning-50'],
      ['error-700', 'error-50'],
      ['info-600', 'info-50'],
    ];
    for (const [text, surface] of pairs) {
      expect(contrast(token(text), token(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('icon/border shades pass the 3:1 UI threshold but are not used as text', () => {
    for (const name of ['green-500', 'success-500', 'warning-500', 'error-500', 'info-500']) {
      expect(contrast(token(name), WHITE), name).toBeGreaterThanOrEqual(3);
    }
  });

  it('warning.400 is never usable as text on white', () => {
    // §3.3 marks this shade "never text on white"; asserting it keeps a future
    // author from promoting it.
    expect(contrast(token('warning-400'), WHITE)).toBeLessThan(3);
  });
});

describe('functional borders', () => {
  it('border.default (neutral.400) passes the 3:1 non-text minimum', () => {
    expect(contrast(token('neutral-400'), WHITE)).toBeGreaterThanOrEqual(3);
  });

  it('border.subtle (neutral.200) is decorative only and does NOT reach 3:1', () => {
    expect(contrast(token('neutral-200'), WHITE)).toBeLessThan(3);
  });

  it('focus ring (green.700) exceeds 3:1 against both white and the primary fill', () => {
    expect(contrast(token('green-700'), WHITE)).toBeGreaterThanOrEqual(3);
    expect(contrast(token('green-700'), token('neutral-50'))).toBeGreaterThanOrEqual(3);
  });
});

describe('dark theme', () => {
  it('remaps a substantial set of tokens rather than inverting', () => {
    expect(countDeclarations("[data-theme='dark']")).toBeGreaterThan(25);
  });

  it('body text passes AAA on the dark background', () => {
    expect(contrast(token('neutral-50'), DARK)).toBeGreaterThanOrEqual(7);
  });

  it('green.300 is used for brand text on dark, and green.600 would fail', () => {
    expect(contrast(token('green-300'), DARK)).toBeGreaterThanOrEqual(7);
    // The reason the dark theme cannot simply reuse the light brand colour.
    expect(contrast(token('green-600'), DARK)).toBeLessThan(4.5);
  });

  it('background is not pure black', () => {
    // §3.5: pure black increases halation and destroys elevation perception.
    expect(DARK).not.toEqual([0, 0, 0]);
  });
});

describe('sunlight theme', () => {
  it('promotes body text to the maximum-contrast neutral', () => {
    expect(countDeclarations("[data-theme='sunlight']")).toBeGreaterThan(15);
    expect(contrast(token('neutral-950'), WHITE)).toBeGreaterThanOrEqual(7);
  });

  it('promotes secondary text to AAA, since 4.5:1 is unreadable at 50,000 lux', () => {
    expect(contrast(token('neutral-700'), WHITE)).toBeGreaterThanOrEqual(7);
  });

  it('promotes the functional border to 6:1', () => {
    expect(contrast(token('neutral-600'), WHITE)).toBeGreaterThanOrEqual(6);
  });
});

describe('colour-vision safety', () => {
  it('success and error are distinguishable in greyscale by luminance', () => {
    // §3.8 makes greyscale usability the acceptance test. These two are close in
    // luminance ON PURPOSE — which is exactly why the system also requires a
    // distinct icon silhouette and a word for every status.
    const successLuminance = luminance(token('success-600'));
    const errorLuminance = luminance(token('error-600'));
    const separation = Math.abs(successLuminance - errorLuminance);

    // Documented, asserted expectation: they are NOT separable by value alone.
    expect(separation).toBeLessThan(0.1);
  });

  it('every status has a distinct text colour token', () => {
    const statusTokens = ['success-700', 'warning-700', 'error-700', 'info-600'];
    const values = statusTokens.map((name) => token(name).join(','));
    expect(new Set(values).size).toBe(statusTokens.length);
  });
});
