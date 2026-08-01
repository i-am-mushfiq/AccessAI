/**
 * Web Mercator tile maths — the whole basis of a slippy map.
 *
 * Separated from the component and kept pure because this is where map bugs
 * actually live, and they are the kind that look plausible: markers a few
 * hundred metres off, a map that drifts as you pan, a hospital pin that sits in
 * the river. None of those look like errors in a screenshot, and all of them are
 * arithmetic that can be pinned in a test.
 *
 * The projection is EPSG:3857, the one every raster tile server uses, including
 * OpenStreetMap. Two things about it matter here:
 *
 *  • Longitude is linear, latitude is NOT. Latitude goes through a logarithm, so
 *    the naive "scale the difference" approach that works for x is wrong for y —
 *    and wrong in a way that is small near the equator and grows northwards.
 *    Bangladesh sits at 20–27°N, far enough for a linear approximation to be
 *    visibly off.
 *
 *  • It cannot represent the poles. tan(π/2) diverges, so latitude is clamped to
 *    the standard ±85.0511°. Bangladesh is nowhere near that, but an unclamped
 *    value from a bad GPS fix would otherwise produce Infinity and a blank map.
 */

/** Every raster tile OSM serves is 256 px square. */
export const TILE_SIZE = 256;

/** Beyond this, Mercator y diverges. The conventional cutoff. */
export const MAX_LATITUDE = 85.0511287798066;

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** A position in whole-world pixel space at a given zoom. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export const clampLatitude = (lat: number): number =>
  Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));

/** Longitude wraps rather than clamps: 181° is a real place, it is −179°. */
export function wrapLongitude(lng: number): number {
  const wrapped = ((lng + 180) % 360 + 360) % 360;
  return wrapped - 180;
}

/** World size in pixels at this zoom. Zoom 0 is one 256 px tile. */
export const worldSize = (zoom: number): number => TILE_SIZE * 2 ** zoom;

/**
 * Geographic coordinates to absolute pixel coordinates.
 *
 * The y term is the Mercator projection proper. Getting this wrong by using a
 * linear latitude scale is the single most common slippy-map bug.
 */
export function project({ lat, lng }: LatLng, zoom: number): Point {
  const size = worldSize(zoom);
  const latRad = (clampLatitude(lat) * Math.PI) / 180;

  const x = ((wrapLongitude(lng) + 180) / 360) * size;
  const y =
    (0.5 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / (2 * Math.PI)) * size;

  return { x, y };
}

/** The exact inverse of `project`, used to turn a drag into a new centre. */
export function unproject({ x, y }: Point, zoom: number): LatLng {
  const size = worldSize(zoom);
  const lng = (x / size) * 360 - 180;
  const n = Math.PI * (1 - 2 * (y / size));
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

export interface TileRef {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Which tiles cover a viewport, plus where to place them.
 *
 * Returns the tile list AND the pixel offset of the top-left tile relative to the
 * viewport, because the two must be derived from the same numbers. Computing them
 * in separate passes is how a map ends up half a tile out of alignment.
 *
 * Tiles outside the vertical range are dropped rather than clamped — requesting
 * y = −1 returns a 404 from every tile server, and a clamped duplicate would
 * render the arctic where the sky should be. Horizontal wrap IS applied, so
 * panning across the date line keeps working.
 */
export function tilesForViewport(
  centre: LatLng,
  zoom: number,
  width: number,
  height: number,
  /** Extra ring of tiles fetched beyond the edge, so panning is not blank. */
  padding = 1,
): { tiles: readonly (TileRef & { left: number; top: number })[]; centrePixel: Point } {
  const z = Math.round(zoom);
  const centrePixel = project(centre, z);
  const count = 2 ** z;

  // Pixel coordinates of the viewport's top-left corner in world space.
  const originX = centrePixel.x - width / 2;
  const originY = centrePixel.y - height / 2;

  const firstX = Math.floor(originX / TILE_SIZE) - padding;
  const firstY = Math.floor(originY / TILE_SIZE) - padding;
  const lastX = Math.floor((originX + width) / TILE_SIZE) + padding;
  const lastY = Math.floor((originY + height) / TILE_SIZE) + padding;

  const tiles: (TileRef & { left: number; top: number })[] = [];

  for (let ty = firstY; ty <= lastY; ty += 1) {
    // No tiles above the north edge or below the south edge of the world.
    if (ty < 0 || ty >= count) continue;

    for (let tx = firstX; tx <= lastX; tx += 1) {
      tiles.push({
        z,
        // Wrap horizontally: the world is a cylinder.
        x: ((tx % count) + count) % count,
        y: ty,
        // Placed from the UNWRAPPED index, so a wrapped tile still lands in the
        // spot the citizen is looking at.
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }

  return { tiles, centrePixel };
}

/**
 * Where a marker sits inside the viewport, in CSS pixels from the top-left.
 *
 * Derived from the same `project` call as the tiles, at the same integer zoom, so
 * a pin cannot drift relative to the map underneath it.
 */
export function markerOffset(
  point: LatLng,
  centre: LatLng,
  zoom: number,
  width: number,
  height: number,
): Point {
  const z = Math.round(zoom);
  const centrePixel = project(centre, z);
  const target = project(point, z);
  return {
    x: target.x - centrePixel.x + width / 2,
    y: target.y - centrePixel.y + height / 2,
  };
}

/**
 * The zoom at which a set of points all fit inside the viewport.
 *
 * Used so opening the screen frames every result rather than dropping the
 * citizen at an arbitrary zoom where half the offices are off-screen. Integer
 * zoom only, because raster tiles exist at integer zooms and a fractional zoom
 * would mean scaling tiles and blurring them.
 */
export function fitZoom(
  points: readonly LatLng[],
  width: number,
  height: number,
  { min = 5, max = 16, padding = 48 }: { min?: number; max?: number; padding?: number } = {},
): number {
  if (points.length < 2) return Math.min(max, 13);

  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);

  // Walk down from the tightest zoom and take the first that fits. Cheaper to
  // reason about than solving for it, and only ~12 iterations.
  for (let z = max; z >= min; z -= 1) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const point of points) {
      const { x, y } = project(point, z);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    if (maxX - minX <= usableWidth && maxY - minY <= usableHeight) return z;
  }

  return min;
}

/** Centre of a set of points, in projected space so it is not skewed by latitude. */
export function centroid(points: readonly LatLng[], zoom = 12): LatLng | null {
  if (points.length === 0) return null;
  const first = points[0]!;
  if (points.length === 1) return { lat: first.lat, lng: first.lng };

  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    const { x, y } = project(point, zoom);
    sumX += x;
    sumY += y;
  }
  return unproject({ x: sumX / points.length, y: sumY / points.length }, zoom);
}

/**
 * A bounding box around a centre, in kilometres.
 *
 * Longitude degrees shrink as you go north, so the east–west span is divided by
 * cos(latitude). Skipping that gives a box ~10% too narrow in Bangladesh — which
 * silently omits real places near the edges of a search.
 */
export function boundingBox(
  centre: LatLng,
  radiusKm: number,
): { south: number; west: number; north: number; east: number } {
  const latDelta = radiusKm / 111.32;
  const cos = Math.cos((clampLatitude(centre.lat) * Math.PI) / 180);
  // Guard the pole case: cos → 0 would give an infinite span.
  const lngDelta = radiusKm / (111.32 * Math.max(0.01, cos));

  return {
    south: clampLatitude(centre.lat - latDelta),
    west: wrapLongitude(centre.lng - lngDelta),
    north: clampLatitude(centre.lat + latDelta),
    east: wrapLongitude(centre.lng + lngDelta),
  };
}
