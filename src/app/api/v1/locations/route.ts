import type { NextRequest } from 'next/server';
import { ok, handle } from '@/lib/http/response';
import { getFullSession } from '@/lib/http/session';
import { nearbySchema, parseQuery } from '@/lib/validation/schemas';
import { findNearby } from '@/modules/places/places.service';
import { placeLabel } from '@/lib/domain/place-labels';
import { env } from '@/lib/config/env';
import type { PlaceType } from '@/modules/places/osm-tags';

/**
 * GET /api/v1/locations — Nearby Services (PRD Feature 12, §70).
 *
 * Returns the seeded corpus AND real OpenStreetMap places, each row carrying the
 * `source` that produced it. A client must be able to tell an authored sample
 * address from a genuine hospital, so provenance is a field rather than something
 * inferred from which endpoint was called.
 *
 * Distance is measured from supplied coordinates when present, otherwise from the
 * district town centre — and the response says which, because a district-centroid
 * distance presented as precise would send someone walking the wrong way.
 *
 * `osm` reports whether the OpenStreetMap half succeeded. A failure there is not
 * an error response: the seeded list is the primary surface and still works, so
 * the caller gets its data plus an honest note that the real places are missing.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const query = parseQuery(nearbySchema, new URL(request.url));
    const session = await getFullSession();

    const district = query.district ?? session?.profile?.district ?? session?.user.district ?? null;
    const locale = session?.user.language === 'en' ? 'en' : 'bn';

    const result = await findNearby({
      coords:
        query.lat !== undefined && query.lng !== undefined
          ? { lat: query.lat, lng: query.lng }
          : null,
      districtCode: district,
      type: (query.type as PlaceType | undefined) ?? null,
      opportunitySlug: query.opportunitySlug ?? null,
      typeLabel: (type) => placeLabel(type, locale),
    });

    const limit = query.limit ?? 40;

    return ok(
      {
        items: result.places.slice(0, limit),
        reference: {
          ...result.reference.point,
          // `device` is kept as the wire value for backwards compatibility with
          // existing clients; internally the same thing is called `gps`.
          kind: result.reference.kind === 'gps' ? ('device' as const) : ('district' as const),
        },
        osm: result.osm,
        mapProvider: env.NEXT_PUBLIC_MAP_PROVIDER,
        distanceIsApproximate: result.reference.kind !== 'gps',
        attribution: '© OpenStreetMap contributors, ODbL',
      },
      {
        meta: {
          total: result.places.length,
          district,
          widenedToDivision: result.widenedToDivision,
          osmCount: result.places.filter((p) => p.source === 'osm').length,
          seedCount: result.places.filter((p) => p.source === 'seed').length,
        },
      },
    );
  }, 'locations:get');
}

export const dynamic = 'force-dynamic';
