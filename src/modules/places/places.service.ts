import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { osmPlaceCache, serviceLocations } from '@/lib/db/schema';
import { env } from '@/lib/config/env';
import { haversineKm, DISTRICTS, getDistrict } from '@/lib/domain/geography';
import type { LatLng } from '@/lib/geo/mercator';
import type { PlaceSource, ServiceLocationType, VerificationStatus } from '@/lib/domain/enums';
import { cellKey, fetchPlaces, OverpassError, type OsmPlace } from './overpass';
import type { PlaceType } from './osm-tags';

/**
 * Assembling the nearby list from two sources that must stay distinguishable.
 *
 * The seeded corpus is authored sample data: complete, tiered, covering all 64
 * districts, with plausible-but-invented addresses and no real phone numbers.
 * OpenStreetMap is real: genuine hospitals, police stations and courts with
 * genuine coordinates, contributed and maintained by people on the ground, but
 * patchy — thorough in Dhaka, thin in a rural upazila — and not verified by
 * anyone here.
 *
 * Neither is a substitute for the other, and the citizen is told which is which.
 * Collapsing them into one undifferentiated list would be the single most
 * misleading thing this feature could do: it would let invented addresses borrow
 * the credibility of real ones, and let real hospitals inherit the "sample data"
 * warning that exists for the invented records.
 */

export interface Place {
  readonly id: string;
  readonly source: PlaceSource;
  readonly name: string;
  readonly nameBn: string;
  readonly type: PlaceType;
  readonly address: string | null;
  readonly addressBn: string | null;
  readonly district: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly phone: string | null;
  readonly officeHours: string | null;
  readonly officeHoursBn: string | null;
  readonly website: string | null;
  readonly emergency: boolean;
  readonly services: readonly string[];
  /** Only meaningful for seeded records; OSM data carries its own provenance. */
  readonly verificationStatus: VerificationStatus | null;
  readonly distanceKm: number | null;
}

/** What the caller learned about the OSM half of the answer. */
export type OsmStatus =
  | {
      readonly kind: 'ok';
      /** How many OSM places are actually in the returned list. */
      readonly count: number;
      /** How many exist in the searched area, before the display cap. */
      readonly found: number;
      readonly cached: boolean;
    }
  /** Overpass could not be reached. The list is seed-only and says so. */
  | { readonly kind: 'unavailable'; readonly retryable: boolean }
  /** Turned off by configuration. */
  | { readonly kind: 'disabled' };

export interface NearbyResult {
  readonly places: readonly Place[];
  readonly osm: OsmStatus;
  /** The point distances were measured from, and how it was obtained. */
  readonly reference: {
    readonly point: LatLng;
    readonly kind: 'gps' | 'district';
    readonly districtCode: string | null;
  };
  /** True when the seeded search was broadened to the whole division. */
  readonly widenedToDivision: boolean;
}

/* --------------------------------------------------------------- caching */

const cacheTtlMs = () => env.OVERPASS_CACHE_HOURS * 3600 * 1000;

/**
 * Read a cached lookup, or fetch and store one.
 *
 * A stale row is deleted rather than served: the whole point of a TTL here is
 * that OSM changes, and a hospital that closed should stop being recommended.
 */
async function cachedPlaces(
  centre: LatLng,
  radiusKm: number,
): Promise<{ places: OsmPlace[]; cached: boolean }> {
  const key = cellKey(centre, radiusKm);
  const cutoff = new Date(Date.now() - cacheTtlMs());

  const [hit] = await db
    .select()
    .from(osmPlaceCache)
    .where(eq(osmPlaceCache.cellKey, key))
    .limit(1);

  if (hit && hit.fetchedAt.getTime() > cutoff.getTime()) {
    return { places: hit.payload as OsmPlace[], cached: true };
  }

  const { places, box } = await fetchPlaces(centre, radiusKm);

  /**
   * Upsert on the cell key. Two citizens in the same town can miss the cache
   * simultaneously and both write; without the conflict target the second insert
   * fails on the unique index and takes down a request that had already
   * succeeded at everything that mattered.
   */
  await db
    .insert(osmPlaceCache)
    .values({
      cellKey: key,
      south: box.south,
      west: box.west,
      north: box.north,
      east: box.east,
      payload: places,
      placeCount: places.length,
      fetchedAt: new Date(),
      sourceUrl: env.OVERPASS_URL,
    })
    .onConflictDoUpdate({
      target: osmPlaceCache.cellKey,
      set: {
        payload: places,
        placeCount: places.length,
        fetchedAt: new Date(),
        sourceUrl: env.OVERPASS_URL,
        south: box.south,
        west: box.west,
        north: box.north,
        east: box.east,
      },
    });

  return { places, cached: false };
}

/** Housekeeping for the scheduled job: drop expired rows. */
export async function pruneOsmCache(): Promise<number> {
  const cutoff = new Date(Date.now() - cacheTtlMs());
  const removed = await db
    .delete(osmPlaceCache)
    .where(lt(osmPlaceCache.fetchedAt, cutoff))
    .returning({ id: osmPlaceCache.id });
  return removed.length;
}

/* ----------------------------------------------------------- conversion */

/**
 * An OSM place as a `Place`.
 *
 * The name fallback matters. A Bangla-reading citizen given an English-only OSM
 * name is better served than one given a blank row, so `nameBn` falls back to
 * the English name rather than to nothing — and an unnamed feature gets its type
 * label from the caller, never the raw tag string.
 */
function fromOsm(place: OsmPlace, reference: LatLng | null, typeLabel: (t: PlaceType) => string): Place {
  const label = typeLabel(place.type);
  return {
    id: `osm:${place.id}`,
    source: 'osm',
    name: place.name ?? place.nameBn ?? label,
    nameBn: place.nameBn ?? place.name ?? label,
    type: place.type,
    address: place.locality,
    addressBn: place.locality,
    district: null,
    lat: place.lat,
    lng: place.lng,
    phone: place.phone,
    officeHours: place.openingHours,
    officeHoursBn: place.openingHours,
    website: place.website,
    emergency: place.emergency,
    services: [],
    // Deliberately null. OSM data is real but unverified by us, and reusing the
    // `unverified_sample` badge would label a genuine hospital as sample data.
    verificationStatus: null,
    distanceKm: reference ? round1(haversineKm(reference, place)) : null,
  };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/* ------------------------------------------------------------- the query */

export interface NearbyQuery {
  /** Precise position, when the citizen shared it. Takes priority. */
  readonly coords?: LatLng | null;
  readonly districtCode?: string | null;
  readonly type?: PlaceType | null;
  /** Only places offering this programme (seeded records carry that mapping). */
  readonly opportunitySlug?: string | null;
  readonly radiusKm?: number;
  /** Hard cap on returned places. */
  readonly limit?: number;
  /** Type label resolver, so this module holds no copy of the UI's strings. */
  readonly typeLabel: (type: PlaceType) => string;
}

/**
 * Most places of any ONE type shown when the citizen has not filtered.
 *
 * Central Dhaka returns 36 banks and 6 hospitals within 25 km, all real. Ordered
 * by distance alone, the banks bury the hospitals: someone opening this screen to
 * find where to go sees a wall of branch offices. So each category is capped
 * while no filter is applied, which turns the default view into a spread of what
 * is around rather than a census of whatever OSM happens to hold most of.
 *
 * Applying a type filter lifts the cap — at that point the citizen has said what
 * they want and completeness is the useful thing.
 */
const PER_TYPE_CAP = 6;

/** Total places returned when the caller sets no limit. */
const DEFAULT_LIMIT = 60;

/**
 * Cap per category, keeping the nearest of each.
 *
 * Order is preserved, so the caller's distance sort survives and the result is
 * still "nearest first" — just with no single category allowed to monopolise it.
 */
function capPerType(places: readonly Place[], cap: number): Place[] {
  const seen = new Map<string, number>();
  const kept: Place[] = [];

  for (const place of places) {
    const count = seen.get(place.type) ?? 0;
    if (count >= cap) continue;
    seen.set(place.type, count + 1);
    kept.push(place);
  }
  return kept;
}

/**
 * The nearby list: seeded records plus real OSM places, ordered by distance.
 *
 * Distance is measured from the citizen's ACTUAL position when they shared it.
 * The screen previously snapped a GPS fix to the nearest district town and threw
 * the coordinates away, so someone standing outside a hospital was told it was
 * eleven kilometres off — the distance from their district's centroid. Keeping
 * the fix makes every number on the screen mean what it says.
 */
export async function findNearby(query: NearbyQuery): Promise<NearbyResult> {
  const radiusKm = query.radiusKm ?? env.OVERPASS_RADIUS_KM;

  const districtCode = query.districtCode ?? null;
  const district = getDistrict(districtCode ?? undefined);

  /**
   * GPS wins when present, because it is the only reference that makes the
   * distances true. Otherwise the district town centre, which is honest as long
   * as the UI says so — hence `kind` travelling with the point.
   */
  const reference: NearbyResult['reference'] = query.coords
    ? { point: query.coords, kind: 'gps', districtCode }
    : district
      ? { point: { lat: district.lat, lng: district.lng }, kind: 'district', districtCode: district.code }
      : { point: { lat: 23.8103, lng: 90.4125 }, kind: 'district', districtCode: 'dhaka' };

  /* ---- seeded records ---- */

  const seedConditions = [];
  if (query.type) seedConditions.push(eq(serviceLocations.type, query.type as ServiceLocationType));

  // District scoping, widened to the division when a district holds too little to
  // be useful. Without this a citizen in a thinly indexed district sees an empty
  // screen and concludes there is no help anywhere.
  const districtsToSearch = districtCode ? [districtCode] : [];
  let seedRows = districtsToSearch.length
    ? await db
        .select()
        .from(serviceLocations)
        .where(and(inArray(serviceLocations.district, districtsToSearch), ...seedConditions))
        .limit(200)
    : [];

  let widened = false;
  if (seedRows.length < 3 && district) {
    const divisionCodes = DISTRICTS.filter((d) => d.division === district.division).map((d) => d.code);
    if (divisionCodes.length > 0) {
      seedRows = await db
        .select()
        .from(serviceLocations)
        .where(and(inArray(serviceLocations.district, divisionCodes), ...seedConditions))
        .limit(200);
      widened = true;
    }
  }

  const seedPlaces: Place[] = seedRows.map((row) => ({
    id: `seed:${row.id}`,
    source: 'seed' as const,
    name: row.name,
    nameBn: row.nameBn,
    type: row.type as PlaceType,
    address: row.address,
    addressBn: row.addressBn,
    district: row.district,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone,
    officeHours: row.officeHours,
    officeHoursBn: row.officeHoursBn,
    website: null,
    emergency: false,
    services: row.services,
    verificationStatus: row.verificationStatus,
    distanceKm: round1(haversineKm(reference.point, { lat: row.lat, lng: row.lng })),
  }));

  /* ---- real OSM places ---- */

  let osmPlaces: Place[] = [];
  let osmFound = 0;
  let osmCached = false;
  let osmFailure: OsmStatus | null = null;

  if (env.NEXT_PUBLIC_MAP_PROVIDER === 'none') {
    osmFailure = { kind: 'disabled' };
  } else {
    try {
      const { places, cached } = await cachedPlaces(reference.point, radiusKm);
      osmCached = cached;
      const usable = query.type ? places.filter((p) => p.type === query.type) : places;
      osmFound = usable.length;
      osmPlaces = usable.map((p) => fromOsm(p, reference.point, query.typeLabel));
    } catch (error) {
      // Never fatal: the seeded list is the primary surface and still works.
      osmFailure = {
        kind: 'unavailable',
        retryable: error instanceof OverpassError ? error.retryable : true,
      };
    }
  }

  /* ---- combine ---- */

  let places = [...seedPlaces, ...osmPlaces];

  if (query.opportunitySlug) {
    // Only seeded records map to programmes. An OSM pharmacy has no opinion about
    // which allowance it processes, so filtering by programme necessarily
    // excludes them rather than guessing.
    places = places.filter((p) => p.services.includes(query.opportunitySlug!));
  }

  // Beyond the searched radius the OSM half is incomplete by construction, so
  // seeded records further out would be ordered against an unfair comparison.
  places = places.filter((p) => p.distanceKm === null || p.distanceKm <= radiusKm * 2);

  places.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  /**
   * Balance, then cap.
   *
   * In that order: capping first would take the nearest 60 — which in central
   * Dhaka is almost entirely banks — and then balance a list that had already
   * lost every hospital. The seeded records are exempt, because they are the
   * curated set this screen exists to surface and there are only a handful per
   * district.
   */
  if (!query.type) {
    const seeds = places.filter((p) => p.source === 'seed');
    const balanced = capPerType(places.filter((p) => p.source === 'osm'), PER_TYPE_CAP);
    places = [...seeds, ...balanced].sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    );
  }

  places = places.slice(0, query.limit ?? DEFAULT_LIMIT);

  return {
    places,
    osm:
      osmFailure ?? {
        kind: 'ok',
        // What is actually in the list, versus what exists nearby. Reporting the
        // second as if it were the first would claim 5,388 results on a screen
        // showing 60.
        count: places.filter((p) => p.source === 'osm').length,
        found: osmFound,
        cached: osmCached,
      },
    reference,
    widenedToDivision: widened,
  };
}
