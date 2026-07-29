/**
 * Global test setup.
 *
 * Env defaults are injected before any module that imports `env` is loaded,
 * so tests never depend on a developer's .env.local.
 */
// `NODE_ENV` is declared read-only by @types/node, so it is written through a
// mutable view of process.env rather than suppressing the error at each use.
const mutableEnv = process.env as Record<string, string | undefined>;

mutableEnv.NODE_ENV = mutableEnv.NODE_ENV ?? 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/test.db';
process.env.JWT_SECRET = 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.JWT_REFRESH_SECRET = 'test-refresh-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
// Force the deterministic engine so AI tests are reproducible.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
