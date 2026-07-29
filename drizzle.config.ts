import { defineConfig } from 'drizzle-kit';

/**
 * PRD §37 specifies PostgreSQL + pgvector. This prototype targets libSQL
 * (SQLite dialect) so the whole system runs with `npm run setup` and no
 * external services. See docs/DEVIATIONS.md §1 — the schema, repositories,
 * and services are dialect-agnostic; only this file and src/lib/db/client.ts
 * change when moving to Postgres.
 */
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/accessai.db',
  },
  verbose: true,
  strict: true,
});
