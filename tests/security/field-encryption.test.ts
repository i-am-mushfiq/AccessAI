import { describe, it, expect } from 'vitest';
import {
  encryptField,
  decryptField,
  encryptStringArray,
  decryptStringArray,
} from '@/lib/security/field-encryption';

describe('encryptField / decryptField', () => {
  it('round-trips plaintext exactly', () => {
    const stored = encryptField('cancer, diabetes');
    expect(decryptField(stored)).toBe('cancer, diabetes');
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const a = encryptField('same value');
    const b = encryptField('same value');
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe('same value');
    expect(decryptField(b)).toBe('same value');
  });

  it('rejects tampered ciphertext instead of silently returning garbage', () => {
    const stored = encryptField('sensitive');
    const parts = stored.split(':');
    // Flip the FIRST character, not the last: a base64 group's final character
    // can carry unused padding bits that some flips don't actually change —
    // flipping the first character of a full 4-char group always changes the
    // decoded bytes.
    const ct = parts[3]!;
    const flipped = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
    const tampered = [parts[0], parts[1], parts[2], flipped].join(':');
    expect(() => decryptField(tampered)).toThrow();
  });

  it('rejects a tampered auth tag', () => {
    const stored = encryptField('sensitive');
    const parts = stored.split(':');
    const tag = parts[2]!;
    const flipped = (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1);
    const tampered = [parts[0], parts[1], flipped, parts[3]].join(':');
    expect(() => decryptField(tampered)).toThrow();
  });

  it('rejects a malformed stored value', () => {
    expect(() => decryptField('not-the-right-format')).toThrow();
  });
});

describe('encryptStringArray / decryptStringArray', () => {
  it('round-trips an array', () => {
    const stored = encryptStringArray(['cancer', 'kidney_failure']);
    expect(decryptStringArray(stored)).toEqual(['cancer', 'kidney_failure']);
  });

  it('passes null through both directions without touching the key', () => {
    expect(encryptStringArray(null)).toBeNull();
    expect(decryptStringArray(null)).toBeNull();
  });

  it('round-trips an empty array distinctly from null', () => {
    const stored = encryptStringArray([]);
    expect(stored).not.toBeNull();
    expect(decryptStringArray(stored)).toEqual([]);
  });
});
