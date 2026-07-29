import type { NextRequest } from 'next/server';
import { desc, eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { aiLogs, users } from '@/lib/db/schema';
import { ok, handle } from '@/lib/http/response';
import { requireStaff } from '@/lib/http/session';
import { parseQuery } from '@/lib/validation/schemas';

const querySchema = z.object({
  engine: z.string().optional(),
  requestType: z.string().optional(),
  groundingFailure: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * GET /api/v1/admin/ai-logs — PRD §64 "Review AI Logs", §77.
 *
 * The citizen's raw message is truncated to 500 characters at write time and the
 * viewer shows only that summary. An operator reviewing AI quality does not need
 * the full personal narrative, and storing less of it is the privacy-by-design
 * position PRD §121 asks for.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const query = parseQuery(querySchema, new URL(request.url));

    const conditions = [];
    if (query.engine) conditions.push(eq(aiLogs.engine, query.engine as never));
    if (query.requestType) conditions.push(eq(aiLogs.requestType, query.requestType as never));
    if (query.groundingFailure) conditions.push(eq(aiLogs.groundingFailure, true));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totals, byEngine] = await Promise.all([
      db
        .select({
          log: aiLogs,
          userName: users.name,
        })
        .from(aiLogs)
        .leftJoin(users, eq(aiLogs.userId, users.id))
        .where(where)
        .orderBy(desc(aiLogs.createdAt))
        .limit(query.limit ?? 50)
        .offset(query.offset ?? 0),
      db.select({ n: sql<number>`count(*)` }).from(aiLogs).where(where),
      db.select({ engine: aiLogs.engine, n: sql<number>`count(*)` }).from(aiLogs).groupBy(aiLogs.engine),
    ]);

    return ok(
      {
        items,
        byEngine: Object.fromEntries(byEngine.map((e) => [e.engine, Number(e.n)])),
      },
      { meta: { total: Number(totals[0]?.n ?? 0), limit: query.limit ?? 50, offset: query.offset ?? 0 } },
    );
  }, 'admin/ai-logs:get');
}

export const dynamic = 'force-dynamic';
