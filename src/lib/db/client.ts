import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';
import { env } from '../config/env';

/**
 * Database access point.
 *
 * The ONLY file that knows which SQL engine is in use. Repositories consume
 * `db` and Drizzle's dialect-agnostic query builder, so migrating to
 * PostgreSQL + pgvector (PRD §37) touches this file, drizzle.config.ts, and
 * the column helpers in schema.ts — no service or route changes.
 */

export type Database = LibSQLDatabase<typeof schema>;

declare global {
  // Reuse across hot reloads; otherwise dev opens a new handle per request.
  // eslint-disable-next-line no-var
  var __accessai_db__: { db: Database; client: Client } | undefined;
}

function ensureLocalDirectory(url: string): void {
  if (!url.startsWith('file:')) return;
  const filePath = url.slice('file:'.length);
  try {
    mkdirSync(dirname(filePath), { recursive: true });
  } catch {
    // Directory already exists, or the path is not writable — the client
    // surfaces the real error on first query, which is more informative.
  }
}

function create(): { db: Database; client: Client } {
  ensureLocalDirectory(env.DATABASE_URL);

  const client = createClient({
    url: env.DATABASE_URL,
    ...(env.DATABASE_AUTH_TOKEN ? { authToken: env.DATABASE_AUTH_TOKEN } : {}),
  });

  const db = drizzle(client, {
    schema,
    logger: process.env.DRIZZLE_LOG === 'true',
  });

  return { db, client };
}

const instance = globalThis.__accessai_db__ ?? create();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__accessai_db__ = instance;
}

export const db = instance.db;
export const sqlClient = instance.client;

/**
 * Enable the pragmas that matter for a file-backed database under concurrent
 * route handlers. WAL lets readers proceed during a write; foreign_keys is OFF
 * by default in SQLite, which would silently void every `references()` above.
 */
export async function initialisePragmas(): Promise<void> {
  if (!env.DATABASE_URL.startsWith('file:')) return;
  await sqlClient.execute('PRAGMA journal_mode = WAL');
  await sqlClient.execute('PRAGMA foreign_keys = ON');
  await sqlClient.execute('PRAGMA busy_timeout = 5000');
}

export { schema };
