import { asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { lifeEventCatalog, opportunities } from '@/lib/db/schema';
import { ok, handle } from '@/lib/http/response';

/**
 * GET /api/v1/life-events
 *
 * The catalogue that drives the landing page and the "tell me what happened"
 * chips. Each entry carries a live count of matching programmes, because an
 * entry that leads to nothing is worse than not offering it.
 *
 * Detection keywords are deliberately NOT returned: they are an internal
 * matching lexicon, and exposing them would invite gaming of the detector.
 */
export async function GET() {
  return handle(async () => {
    const events = await db
      .select({
        code: lifeEventCatalog.code,
        label: lifeEventCatalog.label,
        labelBn: lifeEventCatalog.labelBn,
        description: lifeEventCatalog.description,
        descriptionBn: lifeEventCatalog.descriptionBn,
        icon: lifeEventCatalog.icon,
        sortOrder: lifeEventCatalog.sortOrder,
      })
      .from(lifeEventCatalog)
      .orderBy(asc(lifeEventCatalog.sortOrder));

    const counts = await db
      .select({
        event: sql<string>`json_each.value`.as('event'),
        n: sql<number>`count(*)`.as('n'),
      })
      .from(sql`${opportunities}, json_each(${opportunities.lifeEvents})`)
      .where(sql`${opportunities.status} in ('open','rolling')`)
      .groupBy(sql`json_each.value`);

    const countByEvent = new Map(counts.map((c) => [c.event, Number(c.n)]));

    return ok({
      events: events.map((event) => ({
        ...event,
        opportunityCount: countByEvent.get(event.code) ?? 0,
      })),
    });
  }, 'life-events:get');
}

export const revalidate = 300;
