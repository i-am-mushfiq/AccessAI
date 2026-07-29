import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, userProfiles, userSettings } from '@/lib/db/schema';
import { verifyAccessToken, COOKIE_NAMES } from '@/lib/security/tokens';
import { ROLE_RANK, STAFF_ROLES, type UserRole } from '@/lib/domain/enums';
import { fail, ERROR_CODES } from './response';
import type { NextResponse } from 'next/server';

/**
 * Server-side session access and the authorisation guard.
 *
 * Two separable questions, deliberately kept separate:
 *   getSession()  — WHO is this? (cheap, from the signed token)
 *   requireRole() — MAY they? (rank comparison, no database read)
 *
 * A route that needs the citizen's profile calls `getFullSession()`, which does
 * hit the database; routes that only need identity avoid that cost.
 */

export interface Session {
  readonly userId: string;
  readonly role: UserRole;
  readonly name: string;
  readonly locale: 'bn' | 'en';
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAMES.access)?.value;
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  return {
    userId: claims.sub,
    role: claims.role,
    name: claims.name,
    locale: claims.locale,
  };
}

export interface FullSession extends Session {
  readonly user: typeof users.$inferSelect;
  readonly profile: typeof userProfiles.$inferSelect | null;
  readonly settings: typeof userSettings.$inferSelect | null;
}

export async function getFullSession(): Promise<FullSession | null> {
  const session = await getSession();
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  // The token is valid but the account is gone or suspended: treat as signed
  // out rather than letting a stale token grant access for its full lifetime.
  if (!user || user.status !== 'active') return null;

  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);

  return {
    ...session,
    role: user.role,
    name: user.name,
    locale: user.language,
    user,
    profile: profile ?? null,
    settings: settings ?? null,
  };
}

/* -------------------------------------------------------- authorisation */

export type GuardResult<T> = { ok: true; session: T } | { ok: false; response: NextResponse };

export async function requireSession(): Promise<GuardResult<Session>> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: fail(ERROR_CODES.UNAUTHENTICATED, 'Please sign in to continue.'),
    };
  }
  return { ok: true, session };
}

export async function requireFullSession(): Promise<GuardResult<FullSession>> {
  const session = await getFullSession();
  if (!session) {
    return {
      ok: false,
      response: fail(ERROR_CODES.UNAUTHENTICATED, 'Please sign in to continue.'),
    };
  }
  return { ok: true, session };
}

/** Requires at least the given role by rank, so admin passes a moderator gate. */
export async function requireRole(minimum: UserRole): Promise<GuardResult<Session>> {
  const guard = await requireSession();
  if (!guard.ok) return guard;
  if (ROLE_RANK[guard.session.role] < ROLE_RANK[minimum]) {
    return {
      ok: false,
      response: fail(ERROR_CODES.FORBIDDEN, 'You do not have permission to do this.'),
    };
  }
  return guard;
}

export async function requireStaff(): Promise<GuardResult<Session>> {
  const guard = await requireSession();
  if (!guard.ok) return guard;
  if (!STAFF_ROLES.includes(guard.session.role)) {
    return {
      ok: false,
      response: fail(ERROR_CODES.FORBIDDEN, 'This area is for administrators only.'),
    };
  }
  return guard;
}

export function isStaff(role: UserRole | undefined | null): boolean {
  return role ? STAFF_ROLES.includes(role) : false;
}

export function canManageKnowledge(role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.moderator;
}

export function canApproveChanges(role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.administrator;
}

export function canManageUsers(role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.administrator;
}

export function canDeleteProgrammes(role: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.administrator;
}
