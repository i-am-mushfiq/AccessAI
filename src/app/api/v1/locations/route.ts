import type { NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { serviceLocations } from '@/lib/db/schema';
import { ok, handle } from '@/lib/http/response';
import { getFullSession } from '@/lib/http/session';
import { nearbySchema, parseQuery } from '@/lib/validation/schemas';
import { haversineKm, getDistrict, DISTRICTS } from '@/lib/domain/geography';
import { env } from '@/lib/config/env';

/**
 * GET /api/v1/locations — Nearby Services (PRD Feature 12, §70).
 *
 * Distance is computed from either supplied coordinates or the citizen's
 * district headquarters. The response states which reference was used and marks
 * the values approximate, because presenting a district-centroid distance as a
 * precise one would send someone walking in the wrong direction.
 *
 * With no map provider configured the endpoint still returns a fully ordered,
 * usable list; the UI renders a schematic instead of a tiled map.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const query = parseQuery(nearbySchema, new URL(request.url));
    const session = await getFullSession();

    const district = query.district ?? session?.profile?.district ?? session?.user.district ?? null;

    // Widen to the whole division when a district has few records, so the list
    // is never empty just because one district town has nothing indexed.
    const districtRecord = district ? getDistrict(district) : undefined;
    const divisionDistricts = districtRecord
      ? DISTRICTS.filter((d) => d.division === districtRecord.division).map((d) => d.code)
      : [];

    const conditions = [];
    if (query.type) conditions.push(eq(serviceLocations.type, query.type as never));

    const primary = district
      ? await db
          .select()
          .from(serviceLocations)
          .where(and(eq(serviceLocations.district, district), ...conditions))
          .limit(200)
      : [];

    const rows =
      primary.length >= 3 || !districtRecord
        ? primary
        : await db
            .select()
            .from(serviceLocations)
            .where(and(inArray(serviceLocations.district, divisionDistricts), ...conditions))
            .limit(200);

    const source =
      query.lat !== undefined && query.lng !== undefined
        ? { lat: query.lat, lng: query.lng, kind: 'device' as const }
        : districtRecord
          ? { lat: districtRecord.lat, lng: districtRecord.lng, kind: 'district' as const }
          : null;

    let items = rows.map((location) => ({
      ...location,
      distanceKm: source
        ? Math.round(haversineKm(source, { lat: location.lat, lng: location.lng }) * 10) / 10
        : null,
    }));

    if (query.opportunitySlug) {
      items = items.filter((l) => l.services.includes(query.opportunitySlug!));
    }

    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

    return ok(
      {
        items: items.slice(0, query.limit ?? 40),
        reference: source,
        // The map is optional; the list is not.
        mapProvider: env.NEXT_PUBLIC_MAP_PROVIDER,
        distanceIsApproximate: source?.kind !== 'device',
      },
      { meta: { total: items.length, district, widenedToDivision: rows !== primary } },
    );
  }, 'locations:get');
}

export const dynamic = 'force-dynamic';
