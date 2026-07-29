import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * `promisify` cannot express scrypt's 5-argument overload (with options), so the
 * promisified function is given an explicit signature rather than being called
 * against the wrong overload.
 */
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number; maxmem?: number },
) => Promise<Buffer>;

/**
 * Secret hashing for PINs and refresh tokens.
 *
 * PRD §48 and §121 specify Argon2id. `@node-rs/argon2` is declared as an
 * OPTIONAL dependency: when present it is used, and when it is not (a common
 * situation on Windows without prebuilt binaries) this module falls back to
 * scrypt from Node's core crypto at deliberately high cost parameters.
 *
 * Both paths are memory-hard and both produce a self-describing string, so the
 * stored value records which algorithm made it and verification routes itself
 * correctly. That means an installation can gain Argon2 later without
 * invalidating existing credentials.
 *
 * Format: `algorithm$params$salt$digest`
 */

const SCRYPT_PARAMS = {
  // 2^15 = 32768. ~32 MB of memory per hash — heavy enough to make offline
  // brute force of a 4-digit PIN expensive, light enough for a request path.
  N: 32768,
  r: 8,
  p: 1,
  keyLength: 64,
} as const;

type Argon2Module = {
  hash: (password: string, options?: Record<string, unknown>) => Promise<string>;
  verify: (hashed: string, password: string) => Promise<boolean>;
};

let argon2Promise: Promise<Argon2Module | null> | null = null;

async function loadArgon2(): Promise<Argon2Module | null> {
  if (argon2Promise === null) {
    argon2Promise = import('@node-rs/argon2')
      .then((m) => m as unknown as Argon2Module)
      .catch(() => null);
  }
  return argon2Promise;
}

export async function hashSecret(secret: string): Promise<string> {
  const argon2 = await loadArgon2();
  if (argon2) {
    // The library embeds its own parameters and salt in the returned string.
    return argon2.hash(secret);
  }
  const salt = randomBytes(16);
  const derived = (await scrypt(secret, salt, SCRYPT_PARAMS.keyLength, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: 128 * SCRYPT_PARAMS.N * SCRYPT_PARAMS.r * 2,
  })) as Buffer;
  return `scrypt$${SCRYPT_PARAMS.N}.${SCRYPT_PARAMS.r}.${SCRYPT_PARAMS.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$argon2')) {
    const argon2 = await loadArgon2();
    if (!argon2) {
      // The credential was made with Argon2 but the module is now missing.
      // Failing closed is correct: silently accepting would be a security hole.
      throw new Error(
        'This credential was created with Argon2 but @node-rs/argon2 is not installed. Reinstall it to sign in.',
      );
    }
    return argon2.verify(stored, secret).catch(() => false);
  }

  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const [, paramsRaw, saltRaw, digestRaw] = parts as [string, string, string, string];
  const [nRaw, rRaw, pRaw] = paramsRaw.split('.');
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = Buffer.from(saltRaw, 'base64url');
  const expected = Buffer.from(digestRaw, 'base64url');
  const derived = (await scrypt(secret, salt, expected.length, {
    N,
    r,
    p,
    maxmem: 128 * N * r * 2,
  })) as Buffer;

  // Constant-time comparison — a length-dependent early return would leak.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * Fast, non-reversible digest for high-volume opaque lookups (refresh tokens).
 *
 * Safe here — and NOT safe for PINs — because the input is 32+ bytes of
 * cryptographic randomness rather than a guessable 4-digit secret, so there is
 * no search space to brute-force and no need for a slow KDF.
 */
export function fastHash(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** Numeric OTP. Rejection sampling avoids the modulo bias of `% 10`. */
export function randomNumericCode(digits = 6): string {
  let out = '';
  while (out.length < digits) {
    for (const byte of randomBytes(digits * 2)) {
      if (byte < 250) {
        out += String(byte % 10);
        if (out.length === digits) break;
      }
    }
  }
  return out;
}
