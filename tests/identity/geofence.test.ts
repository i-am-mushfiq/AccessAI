import { describe, it, expect } from 'vitest';
import { isPointInPolygon } from '@/modules/identity/geofence';

/** A 2-degree square centred on (10, 20): lat 9–11, lng 19–21. */
const SQUARE: readonly [number, number][] = [
  [9, 19],
  [9, 21],
  [11, 21],
  [11, 19],
  [9, 19],
];

describe('isPointInPolygon', () => {
  it('accepts a point well inside the polygon', () => {
    expect(isPointInPolygon({ lat: 10, lng: 20 }, SQUARE)).toBe(true);
  });

  it('rejects a point well outside the polygon', () => {
    expect(isPointInPolygon({ lat: 30, lng: 40 }, SQUARE)).toBe(false);
  });

  it('rejects a point just outside each edge', () => {
    expect(isPointInPolygon({ lat: 8.99, lng: 20 }, SQUARE)).toBe(false);
    expect(isPointInPolygon({ lat: 11.01, lng: 20 }, SQUARE)).toBe(false);
    expect(isPointInPolygon({ lat: 10, lng: 18.99 }, SQUARE)).toBe(false);
    expect(isPointInPolygon({ lat: 10, lng: 21.01 }, SQUARE)).toBe(false);
  });

  it('accepts a point just inside each edge', () => {
    expect(isPointInPolygon({ lat: 9.01, lng: 20 }, SQUARE)).toBe(true);
    expect(isPointInPolygon({ lat: 10.99, lng: 20 }, SQUARE)).toBe(true);
    expect(isPointInPolygon({ lat: 10, lng: 19.01 }, SQUARE)).toBe(true);
    expect(isPointInPolygon({ lat: 10, lng: 20.99 }, SQUARE)).toBe(true);
  });

  it('handles a non-rectangular (triangular) polygon', () => {
    const triangle: readonly [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 0],
      [0, 0],
    ];
    expect(isPointInPolygon({ lat: 2, lng: 2 }, triangle)).toBe(true);
    // Outside the hypotenuse, even though it is inside the bounding box.
    expect(isPointInPolygon({ lat: 8, lng: 8 }, triangle)).toBe(false);
  });
});
