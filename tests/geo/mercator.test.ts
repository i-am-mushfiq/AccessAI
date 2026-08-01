import { describe, it, expect } from 'vitest';
import {
  project, unproject, tilesForViewport, markerOffset, fitZoom, centroid,
  boundingBox, clampLatitude, wrapLongitude, worldSize, TILE_SIZE, MAX_LATITUDE,
} from '@/lib/geo/mercator';
import { haversineKm } from '@/lib/domain/geography';

/**
 * Tile maths.
 *
 * Every failure this guards against is one that LOOKS right: a pin a few hundred
 * metres into the river, a map that drifts as you drag, an office silently
 * omitted from a search because the bounding box was 10% too narrow. None of
 * those are visible in a screenshot, so they are pinned numerically.
 *
 * Reference values are the standard OSM slippy-map ones, so a wrong projection
 * cannot agree with them by coincidence.
 */

const dhaka = { lat: 23.8103, lng: 90.4125 };
const rangpur = { lat: 25.7439, lng: 89.2752 };

describe('projection', () => {
  it('puts null island at the exact centre of the world', () => {
    const size = worldSize(0);
    expect(project({ lat: 0, lng: 0 }, 0)).toEqual({ x: size / 2, y: size / 2 });
  });

  it('treats both antimeridians as the same meridian', () => {
    // The world is a cylinder: +180 and −180 are one line, not two edges.
    expect(project({ lat: 0, lng: -180 }, 0).x).toBeCloseTo(0, 6);
    expect(project({ lat: 0, lng: 180 }, 0).x).toBeCloseTo(0, 6);
  });

  it('projects latitude through Mercator, not linearly', () => {
    /**
     * The bug this exists for. A linear scale would put 45°N exactly halfway
     * between the equator and the top of the map; Mercator puts it 7.8 px lower
     * at zoom 1 alone, and the error compounds with zoom.
     */
    const size = worldSize(1);
    const linearGuess = size / 2 - (45 / 90) * (size / 4);
    const actual = project({ lat: 45, lng: 0 }, 1).y;

    expect(actual).toBeCloseTo(184.1792, 3);
    expect(Math.abs(actual - linearGuess)).toBeGreaterThan(6);
  });

  it('agrees with the standard OSM tilenames formula, computed independently', () => {
    /**
     * Stronger than a memorised tile index: the reference is recomputed here
     * from the published formula, in a different form (tile units rather than
     * pixels, ln/π rather than ln/2π). A projection that is wrong cannot agree
     * with an independent derivation by coincidence.
     *
     * https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
     */
    const osmTile = (lat: number, lon: number, z: number) => {
      const n = 2 ** z;
      const latRad = (lat * Math.PI) / 180;
      return {
        x: Math.floor(((lon + 180) / 360) * n),
        y: Math.floor(
          ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
        ),
      };
    };

    for (const place of [dhaka, rangpur, { lat: 22.3569, lng: 91.7832 }]) {
      for (const zoom of [8, 12, 13, 16]) {
        const mine = project(place, zoom);
        const reference = osmTile(place.lat, place.lng, zoom);
        expect(Math.floor(mine.x / TILE_SIZE), `x @${zoom}`).toBe(reference.x);
        expect(Math.floor(mine.y / TILE_SIZE), `y @${zoom}`).toBe(reference.y);
      }
    }
  });

  it('places Dhaka in tile 12/3076/1768', () => {
    const { x, y } = project(dhaka, 12);
    expect(Math.floor(x / TILE_SIZE)).toBe(3076);
    expect(Math.floor(y / TILE_SIZE)).toBe(1768);
  });

  it('round-trips through unproject at every zoom that matters', () => {
    for (const zoom of [0, 5, 10, 13, 16, 19]) {
      const back = unproject(project(dhaka, zoom), zoom);
      expect(back.lat, `zoom ${zoom}`).toBeCloseTo(dhaka.lat, 6);
      expect(back.lng, `zoom ${zoom}`).toBeCloseTo(dhaka.lng, 6);
    }
  });

  it('clamps a latitude that would make Mercator diverge', () => {
    // tan(π/2) is infinite; an unclamped pole gives Infinity and a blank map.
    expect(clampLatitude(90)).toBe(MAX_LATITUDE);
    expect(clampLatitude(-90)).toBe(-MAX_LATITUDE);
    expect(Number.isFinite(project({ lat: 90, lng: 0 }, 10).y)).toBe(true);
    expect(Number.isFinite(project({ lat: -90, lng: 0 }, 10).y)).toBe(true);
  });

  it('wraps longitude instead of clamping it', () => {
    // 181° is a real place — it is −179°, not the edge of the map.
    expect(wrapLongitude(181)).toBeCloseTo(-179, 9);
    expect(wrapLongitude(-181)).toBeCloseTo(179, 9);
    expect(wrapLongitude(90.4125)).toBeCloseTo(90.4125, 9);
  });
});

describe('tile coverage', () => {
  const viewport = { width: 640, height: 400 };

  it('covers the viewport with no gaps', () => {
    const { tiles } = tilesForViewport(dhaka, 12, viewport.width, viewport.height, 0);

    // Every pixel of the viewport must fall inside some tile.
    for (const probe of [
      { x: 0, y: 0 },
      { x: viewport.width - 1, y: 0 },
      { x: 0, y: viewport.height - 1 },
      { x: viewport.width - 1, y: viewport.height - 1 },
      { x: viewport.width / 2, y: viewport.height / 2 },
    ]) {
      const covering = tiles.filter(
        (t) =>
          probe.x >= t.left && probe.x < t.left + TILE_SIZE &&
          probe.y >= t.top && probe.y < t.top + TILE_SIZE,
      );
      expect(covering.length, `${probe.x},${probe.y}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('places tiles on an exact grid', () => {
    // Any misalignment here shows up as visible seams between tiles.
    const { tiles } = tilesForViewport(dhaka, 12, viewport.width, viewport.height, 0);
    const lefts = [...new Set(tiles.map((t) => t.left))].sort((a, b) => a - b);

    for (let i = 1; i < lefts.length; i += 1) {
      expect(lefts[i]! - lefts[i - 1]!).toBeCloseTo(TILE_SIZE, 6);
    }
  });

  it('never asks for a tile above or below the world', () => {
    // y = -1 is a 404 from every tile server; a clamped duplicate would render
    // the arctic where empty sky belongs.
    const { tiles } = tilesForViewport({ lat: 84, lng: 0 }, 3, 1024, 1024, 2);
    const count = 2 ** 3;
    for (const tile of tiles) {
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeLessThan(count);
    }
  });

  it('wraps horizontally so panning across the date line still shows map', () => {
    const { tiles } = tilesForViewport({ lat: 0, lng: 179.9 }, 2, 1024, 400, 1);
    const count = 2 ** 2;
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x).toBeLessThan(count);
    }
    // Wrapped tiles keep distinct screen positions — they are not stacked.
    expect(new Set(tiles.map((t) => t.left)).size).toBeGreaterThan(1);
  });

  it('fetches a ring beyond the edge so a drag is not blank', () => {
    const bare = tilesForViewport(dhaka, 12, viewport.width, viewport.height, 0);
    const padded = tilesForViewport(dhaka, 12, viewport.width, viewport.height, 1);
    expect(padded.tiles.length).toBeGreaterThan(bare.tiles.length);
  });
});

describe('marker placement', () => {
  const viewport = { width: 600, height: 400 };

  it('puts the centre point in the middle of the viewport', () => {
    const offset = markerOffset(dhaka, dhaka, 13, viewport.width, viewport.height);
    expect(offset.x).toBeCloseTo(viewport.width / 2, 6);
    expect(offset.y).toBeCloseTo(viewport.height / 2, 6);
  });

  it('puts a northern point above centre and an eastern point right of it', () => {
    // Screen y grows downward, so further north must be a SMALLER y.
    const north = markerOffset(rangpur, dhaka, 8, viewport.width, viewport.height);
    expect(north.y).toBeLessThan(viewport.height / 2);
    // Rangpur is west of Dhaka.
    expect(north.x).toBeLessThan(viewport.width / 2);

    const east = markerOffset({ lat: 23.8103, lng: 91.5 }, dhaka, 8, viewport.width, viewport.height);
    expect(east.x).toBeGreaterThan(viewport.width / 2);
  });

  it('agrees with the tile grid it is drawn over', () => {
    /**
     * The drift bug: markers computed from a different projection call, or a
     * different zoom, than the tiles underneath. Both must derive from the same
     * centre pixel, so a marker's offset has to equal its world pixel minus the
     * viewport origin.
     */
    const zoom = 12;
    const { centrePixel } = tilesForViewport(dhaka, zoom, viewport.width, viewport.height);
    const marker = markerOffset(rangpur, dhaka, zoom, viewport.width, viewport.height);
    const world = project(rangpur, zoom);

    expect(marker.x).toBeCloseTo(world.x - (centrePixel.x - viewport.width / 2), 6);
    expect(marker.y).toBeCloseTo(world.y - (centrePixel.y - viewport.height / 2), 6);
  });
});

describe('framing a set of results', () => {
  it('zooms out far enough to hold two distant districts', () => {
    const zoom = fitZoom([dhaka, rangpur], 600, 400);
    const a = project(dhaka, zoom);
    const b = project(rangpur, zoom);
    expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(600);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(400);
  });

  it('zooms in close for points in one town', () => {
    const near = [dhaka, { lat: 23.815, lng: 90.418 }];
    expect(fitZoom(near, 600, 400)).toBeGreaterThan(fitZoom([dhaka, rangpur], 600, 400));
  });

  it('picks a sensible zoom for a single point rather than the maximum', () => {
    // One result must not drop the citizen at street level with no context.
    const zoom = fitZoom([dhaka], 600, 400);
    expect(zoom).toBeGreaterThanOrEqual(11);
    expect(zoom).toBeLessThanOrEqual(14);
  });

  it('stays within the requested bounds', () => {
    const wholeCountry = fitZoom(
      [{ lat: 20.7, lng: 88.0 }, { lat: 26.6, lng: 92.7 }],
      320, 240,
      { min: 5, max: 16 },
    );
    expect(wholeCountry).toBeGreaterThanOrEqual(5);
    expect(wholeCountry).toBeLessThanOrEqual(16);
  });
});

describe('centroid', () => {
  it('returns the single point unchanged', () => {
    expect(centroid([dhaka])).toEqual(dhaka);
  });

  it('lands between two points', () => {
    const mid = centroid([dhaka, rangpur])!;
    expect(mid.lat).toBeGreaterThan(dhaka.lat);
    expect(mid.lat).toBeLessThan(rangpur.lat);
    expect(mid.lng).toBeLessThan(dhaka.lng);
    expect(mid.lng).toBeGreaterThan(rangpur.lng);
  });

  it('is null for nothing, so the caller must choose a fallback', () => {
    expect(centroid([])).toBeNull();
  });
});

describe('bounding box for a radius search', () => {
  it('reaches approximately the requested distance north and south', () => {
    const box = boundingBox(dhaka, 20);
    expect(haversineKm(dhaka, { lat: box.north, lng: dhaka.lng })).toBeCloseTo(20, 0);
    expect(haversineKm(dhaka, { lat: box.south, lng: dhaka.lng })).toBeCloseTo(20, 0);
  });

  it('widens for latitude so it does not silently omit places east and west', () => {
    /**
     * A longitude degree is shorter than a latitude degree at 24°N. Dividing by
     * cos(lat) is what keeps the east–west reach honest; without it the box is
     * ~9% too narrow here and real offices near the edge never appear.
     */
    const box = boundingBox(dhaka, 20);
    expect(haversineKm(dhaka, { lat: dhaka.lat, lng: box.east })).toBeCloseTo(20, 0);
    expect(haversineKm(dhaka, { lat: dhaka.lat, lng: box.west })).toBeCloseTo(20, 0);

    const naiveDelta = 20 / 111.32;
    expect(box.east - dhaka.lng).toBeGreaterThan(naiveDelta * 1.05);
  });

  it('produces a box that actually contains its centre', () => {
    const box = boundingBox(rangpur, 5);
    expect(rangpur.lat).toBeGreaterThan(box.south);
    expect(rangpur.lat).toBeLessThan(box.north);
    expect(rangpur.lng).toBeGreaterThan(box.west);
    expect(rangpur.lng).toBeLessThan(box.east);
  });
});
