import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userSettings } from '@/lib/db/schema';
import { ok, readJson, handle } from '@/lib/http/response';
import { getSession } from '@/lib/http/session';
import { updateSettingsSchema } from '@/lib/validation/schemas';

/**
 * PATCH /api/v1/users/settings
 *
 * The client applies presentation preferences immediately and syncs here in the
 * background, so a failure must be silent-but-honest: the citizen keeps the
 * setting they chose on this device, and the response says whether it persisted.
 *
 * Returns 200 with `persisted: false` for a signed-out visitor rather than 401,
 * because a guest changing text size is a legitimate action, not an auth error.
 */
export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const body = updateSettingsSchema.parse(await readJson(request));
    const session = await getSession();

    if (!session) {
      return ok({ persisted: false, reason: 'not_signed_in' });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) patch[key] = value;
    }

    const [existing] = await db
      .select({ userId: userSettings.userId })
      .from(userSettings)
      .where(eq(userSettings.userId, session.userId))
      .limit(1);

    const [updated] = existing
      ? await db.update(userSettings).set(patch).where(eq(userSettings.userId, session.userId)).returning()
      : await db.insert(userSettings).values({ userId: session.userId, ...patch }).returning();

    return ok({ persisted: true, settings: updated });
  }, 'users/settings:patch');
}

export const dynamic = 'force-dynamic';
