import { env } from '@/lib/config/env';
import { boundingBox, type LatLng } from '@/lib/geo/mercator';
import { typeFromTags, overpassFilters, type PlaceType } from './osm-tags';

/**
 * The OpenStreetMap Overpass client — where the real places come from.
 *
 * Everything here is shaped by one fact: **Overpass is a free service run by
 * volunteers**, with a fair-use policy and no obligation to serve us. So:
 *
 *  • One request retrieves every type, using a regex filter, rather than one
 *    request per type.
 *  • A hard timeout, declared to Overpass in the query AND enforced locally, so a
 *    slow upstream cannot hold a page open.
 *  • An identifying User-Agent, because anonymous traffic cannot be asked to
 *    stop and is therefore blocked.
 *  • Results are cached by the caller. This module is deliberately cache-free so
 *    it stays a pure translation layer, testable without a database.
 *
 * A failure here is never fatal. The nearby screen's primary surface is a
 * distance-ordered list from the seeded corpus; OSM places are added to it. If
 * Overpass is down the screen loses real hospitals and keeps working, and says
 * so, rather than showing an error where the list should be.
 */

export interface OsmPlace {
  /** `node/12345` — stable across fetches, so it can be a React key. */
  readonly id: string;
  readonly type: PlaceType;
  readonly name: string | null;
  readonly nameBn: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly phone: string | null;
  readonly openingHours: string | null;
  /** Free-text locality from OSM's address tags, when present. */
  readonly locality: string | null;
  readonly website: string | null;
  readonly emergency: boolean;
}

/** Raw Overpass element, as far as we rely on it. */
interface OverpassElement {
  readonly type?: string;
  readonly id?: number;
  readonly lat?: number;
  readonly lon?: number;
  /** Ways and relations carry their centroid here, via `out center`. */
  readonly center?: { readonly lat?: number; readonly lon?: number };
  readonly tags?: Record<string, string>;
}

export class OverpassError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'OverpassError';
  }
}

/**
 * Build the Overpass QL query.
 *
 * `nwr` covers nodes, ways and relations in one clause — a hospital is usually a
 * way (its building footprint) or a relation, not a node, so querying only nodes
 * silently loses most of the large facilities. `out center tags` then gives every
 * element a single coordinate, which is what a marker needs.
 */
export function buildQuery(
  box: { south: number; west: number; north: number; east: number },
  timeoutSeconds: number,
): string {
  const bbox = `${box.south},${box.west},${box.north},${box.east}`;
  const clauses = overpassFilters()
    .map((filter) => `  nwr${filter}(${bbox});`)
    .join('\n');

  return `[out:json][timeout:${timeoutSeconds}];\n(\n${clauses}\n);\nout center tags;`;
}

/** Longest name wins between OSM's several name tags for the same thing. */
function pickName(tags: Record<string, string>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = tags[key]?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * A name reduced to what identifies the place, for comparison only.
 *
 * "United Hospital" and "United Hospital Limited" are one hospital, entered twice
 * by different contributors. Exact string equality misses that, and the citizen
 * sees the same hospital twice at 0.7 km — which reads as broken data and makes
 * the result count meaningless.
 *
 * Only company suffixes and punctuation are stripped. Deliberately NOT stripping
 * the type word: "Sadar Hospital" and "Sadar Pharmacy" must stay distinct, and
 * removing "hospital" would collapse them.
 */
const NAME_NOISE = /\b(limited|ltd|pvt|private|company|co|and|the|&)\b/g;

export function comparableName(name: string): string {
  return name
    .toLowerCase()
    // Bangla marks matter to the word; keep \p{M}.
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(NAME_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalise one Overpass element, or reject it.
 *
 * Rejection is the common case and must be cheap: a bbox query returns plenty of
 * elements whose tags mean nothing to this app, plus relations with no resolvable
 * centre.
 */
export function normaliseElement(element: OverpassElement): OsmPlace | null {
  const type = typeFromTags(element.tags);
  if (!type) return null;

  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  // A place with no coordinate cannot be shown on a map or given a distance,
  // which is the entire value it would add.
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const tags = element.tags ?? {};

  const name = pickName(tags, ['name:en', 'name', 'official_name', 'alt_name']);
  const nameBn = pickName(tags, ['name:bn', 'name:bn-BD']);

  return {
    id: `${element.type ?? 'node'}/${element.id ?? `${lat},${lng}`}`,
    type,
    name,
    nameBn,
    lat,
    lng,
    // `contact:phone` is the newer convention; plenty of Bangladesh data uses
    // the older bare `phone`.
    phone: pickName(tags, ['phone', 'contact:phone', 'contact:mobile']),
    openingHours: pickName(tags, ['opening_hours']),
    locality: pickName(tags, ['addr:city', 'addr:suburb', 'addr:village', 'addr:district']),
    website: pickName(tags, ['website', 'contact:website']),
    // A 24-hour emergency department is decision-relevant at 2am and is the one
    // OSM tag on a hospital worth surfacing directly.
    emergency: tags.emergency === 'yes',
  };
}

/**
 * De-duplicate places that are the same facility recorded twice.
 *
 * OSM frequently holds both a node ("Dhaka Medical College Hospital", the label)
 * and a way (its building outline) for one hospital, and a bbox query returns
 * both. Without this the citizen sees the same hospital listed twice at slightly
 * different distances, which reads as sloppy data and makes the count meaningless.
 *
 * Matched on name plus proximity rather than on id, because the ids are genuinely
 * different objects. 150 m is comfortably inside one hospital campus and well
 * below the distance between two distinct pharmacies on the same street.
 */
export function dedupe(places: readonly OsmPlace[]): OsmPlace[] {
  const kept: OsmPlace[] = [];

  for (const place of places) {
    const key = comparableName(place.name ?? place.nameBn ?? '');

    const duplicate = kept.find((other) => {
      if (other.type !== place.type) return false;
      const otherKey = comparableName(other.name ?? other.nameBn ?? '');
      // An empty name is never evidence that two things are the same. Two unnamed
      // pharmacies on one street are two pharmacies.
      if (!key || !otherKey) return false;
      // One name containing the other catches "United Hospital" against "United
      // Hospital Dhaka", which suffix-stripping alone does not.
      const sameName = key === otherKey || key.includes(otherKey) || otherKey.includes(key);
      if (!sameName) return false;
      // ~150 m, in degrees. Latitude is the tighter bound, so use it for both.
      return Math.abs(other.lat - place.lat) < 0.0014 && Math.abs(other.lng - place.lng) < 0.0014;
    });

    if (!duplicate) {
      kept.push(place);
      continue;
    }
    // Prefer the record that carries more usable detail: a named node with a
    // phone number beats an unnamed building outline.
    const score = (p: OsmPlace) =>
      (p.nameBn ? 2 : 0) + (p.name ? 2 : 0) + (p.phone ? 1 : 0) + (p.openingHours ? 1 : 0);
    if (score(place) > score(duplicate)) {
      kept[kept.indexOf(duplicate)] = place;
    }
  }

  return kept;
}

/** Parse a whole Overpass JSON response. */
export function parseResponse(body: unknown): OsmPlace[] {
  const elements = (body as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) {
    throw new OverpassError('Overpass returned no element list', false);
  }

  const places: OsmPlace[] = [];
  for (const element of elements) {
    const place = normaliseElement(element as OverpassElement);
    if (place) places.push(place);
  }
  return dedupe(places);
}

/**
 * Fetch real places around a point.
 *
 * Throws `OverpassError` rather than returning empty on failure, so the caller
 * can distinguish "there are no hospitals here" from "we could not ask" — the
 * first is information for the citizen, the second is not.
 */
export async function fetchPlaces(
  centre: LatLng,
  radiusKm = env.OVERPASS_RADIUS_KM,
): Promise<{ places: OsmPlace[]; box: ReturnType<typeof boundingBox> }> {
  const box = boundingBox(centre, radiusKm);
  // Declared to Overpass as well as enforced locally: told the budget, it aborts
  // its own work rather than finishing a query nobody is waiting for.
  const timeoutSeconds = 25;
  const query = buildQuery(box, timeoutSeconds);

  let response: Response;
  try {
    response = await fetch(env.OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': env.MAP_USER_AGENT,
        Accept: 'application/json',
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout((timeoutSeconds + 5) * 1000),
    });
  } catch {
    throw new OverpassError('Could not reach OpenStreetMap', true);
  }

  if (response.status === 429 || response.status === 504) {
    // Overpass says these explicitly when it is loaded. Retryable, and a reason
    // for the deployment to run its own instance.
    throw new OverpassError('OpenStreetMap is busy', true);
  }
  if (!response.ok) {
    throw new OverpassError(`OpenStreetMap returned ${response.status}`, false);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Overpass answers a malformed query with an HTML error page and a 200.
    throw new OverpassError('OpenStreetMap returned something that was not JSON', false);
  }

  return { places: parseResponse(body), box };
}

/**
 * The cache key for a search.
 *
 * Coordinates are snapped to a ~5.5 km grid (0.05°). Keying on exact GPS would
 * give every citizen a cache miss and a separate upstream query for results that
 * are, in practice, identical — the opposite of fair use. The grid is finer than
 * the search radius, so snapping never moves the centre outside the area asked
 * for.
 */
export function cellKey(centre: LatLng, radiusKm: number): string {
  const snap = (value: number) => (Math.round(value / 0.05) * 0.05).toFixed(2);
  return `${snap(centre.lat)}:${snap(centre.lng)}:${Math.round(radiusKm)}`;
}
