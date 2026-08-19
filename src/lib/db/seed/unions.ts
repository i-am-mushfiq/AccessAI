/**
 * Union Parishad boundaries — Phase 1 sample corpus.
 *
 * Authored sample geometry, the same way `opportunities-*.ts` are authored
 * sample programmes and `locations.ts` are authored sample offices: real
 * union names and real districts, but hand-drawn square boundaries rather
 * than surveyed polygons — small enough that a citizen's GPS fix lands
 * inside deterministically for a demo, not intended as a source of truth for
 * an actual administrative boundary. See docs/DEVIATIONS.md.
 */

export interface SeedUnion {
  readonly unionCode: string;
  readonly name: string;
  readonly nameBn: string;
  readonly division: string;
  readonly district: string;
  readonly upazila: string;
  readonly centroidLat: number;
  readonly centroidLng: number;
}

/** A small square ring around the centroid, ~1.1 km per side. */
function squareRing(lat: number, lng: number, halfWidthDeg = 0.01): [number, number][] {
  return [
    [lat - halfWidthDeg, lng - halfWidthDeg],
    [lat - halfWidthDeg, lng + halfWidthDeg],
    [lat + halfWidthDeg, lng + halfWidthDeg],
    [lat + halfWidthDeg, lng - halfWidthDeg],
    [lat - halfWidthDeg, lng - halfWidthDeg],
  ];
}

const RAW_UNIONS: readonly SeedUnion[] = [
  {
    unionCode: 'rangpur-sadar-kaligonj',
    name: 'Kaligonj Union',
    nameBn: 'কালিগঞ্জ ইউনিয়ন',
    division: 'rangpur',
    district: 'rangpur',
    upazila: 'Rangpur Sadar',
    centroidLat: 25.755,
    centroidLng: 89.285,
  },
  {
    unionCode: 'rajshahi-paba-daman',
    name: 'Daman Union',
    nameBn: 'দামন ইউনিয়ন',
    division: 'rajshahi',
    district: 'rajshahi',
    upazila: 'Paba',
    centroidLat: 24.4,
    centroidLng: 88.55,
  },
  {
    unionCode: 'kurigram-bhurungamari-pathordubi',
    name: 'Pathordubi Union',
    nameBn: 'পাথরডুবি ইউনিয়ন',
    division: 'rangpur',
    district: 'kurigram',
    upazila: 'Bhurungamari',
    centroidLat: 25.95,
    centroidLng: 89.65,
  },
  {
    unionCode: 'dhaka-savar-tetuljhora',
    name: 'Tetuljhora Union',
    nameBn: 'তেঁতুলঝোড়া ইউনিয়ন',
    division: 'dhaka',
    district: 'dhaka',
    upazila: 'Savar',
    centroidLat: 23.86,
    centroidLng: 90.27,
  },
];

export const SEED_UNIONS: readonly (SeedUnion & { polygon: [number, number][] })[] = RAW_UNIONS.map((u) => ({
  ...u,
  polygon: squareRing(u.centroidLat, u.centroidLng),
}));
