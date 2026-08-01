import type { ServiceLocationType } from '@/lib/domain/enums';

/**
 * The OpenStreetMap tags that correspond to the service types this app knows
 * about — and, just as importantly, the ones that do not.
 *
 * The rule applied throughout: **never map a tag to a type it does not actually
 * mean.** OSM is a physical-geography database, not an administrative register,
 * and the temptation is to force its tags onto our enum so every filter looks
 * populated. That produces confident falsehoods, which on this app means sending
 * a widow to an office that cannot process her allowance.
 *
 * Three concrete decisions of that kind:
 *
 *  • **`office=government` becomes `government_office`, not a tier.** Our enum
 *    distinguishes union / upazila / district offices, because in Bangladesh the
 *    tier decides which forms you can file. OSM does not reliably record the
 *    tier. Guessing would put a citizen in the wrong queue, so OSM-sourced
 *    government offices get their own untiered type and the seeded corpus keeps
 *    supplying the tiered ones.
 *
 *  • **`office=lawyer` is NOT legal aid.** It is a private practice that charges
 *    fees. Mapping it onto `legal_aid` would send someone who cannot afford a
 *    lawyer to a lawyer. Legal aid stays with the seeded records and the real
 *    `16430` helpline.
 *
 *  • **`agriculture_office` and `digital_center` have no OSM equivalent** and are
 *    left unmapped rather than approximated. Those filters simply show seeded
 *    records, which is honest.
 */

/** OSM-sourced government offices, where the administrative tier is unknown. */
export type OsmOnlyType = 'government_office';

export type PlaceType = ServiceLocationType | OsmOnlyType;

interface TagRule {
  /** OSM key, e.g. `amenity`. */
  readonly key: string;
  /** Accepted values for that key. */
  readonly values: readonly string[];
  readonly type: PlaceType;
}

/**
 * Ordered most-specific first. `amenity=hospital` must be tested before the
 * broader clinic values so a hospital is never demoted to a clinic.
 */
export const TAG_RULES: readonly TagRule[] = [
  { key: 'amenity', values: ['police'], type: 'police_station' },
  { key: 'amenity', values: ['courthouse'], type: 'court' },
  { key: 'amenity', values: ['hospital'], type: 'hospital' },
  // `doctors` is a GP surgery and `health_post` a rural outpost; both are the
  // "somewhere to be seen today" that `clinic` represents here.
  { key: 'amenity', values: ['clinic', 'doctors', 'health_post'], type: 'clinic' },
  { key: 'healthcare', values: ['clinic', 'centre', 'doctor'], type: 'clinic' },
  { key: 'amenity', values: ['pharmacy'], type: 'pharmacy' },
  { key: 'amenity', values: ['fire_station'], type: 'fire_station' },
  { key: 'amenity', values: ['post_office'], type: 'post_office' },
  { key: 'amenity', values: ['bank'], type: 'bank' },
  { key: 'amenity', values: ['college', 'university'], type: 'training_center' },
  { key: 'amenity', values: ['townhall'], type: 'government_office' },
  { key: 'office', values: ['government', 'administrative'], type: 'government_office' },
  { key: 'office', values: ['ngo', 'charity'], type: 'ngo_office' },
];

/**
 * Which of our types OSM can actually supply.
 *
 * Exposed so the UI can say *why* a filter shows only seeded records instead of
 * leaving the citizen to conclude the map is broken.
 */
export const OSM_BACKED_TYPES: readonly PlaceType[] = [
  ...new Set(TAG_RULES.map((rule) => rule.type)),
];

/** Decide a place's type from its tags, or null if none of them mean anything here. */
export function typeFromTags(tags: Record<string, string> | undefined): PlaceType | null {
  if (!tags) return null;
  for (const rule of TAG_RULES) {
    const value = tags[rule.key];
    if (value && rule.values.includes(value)) return rule.type;
  }
  return null;
}

/**
 * The Overpass filter clauses needed to retrieve everything above.
 *
 * Grouped by OSM key and combined with a regex so the whole lookup is ONE
 * request. Overpass is a shared volunteer service with a strict fair-use policy;
 * issuing thirteen queries where one would do is how an application gets its IP
 * range blocked, and the block would take the feature down for every user.
 */
export function overpassFilters(): readonly string[] {
  const byKey = new Map<string, Set<string>>();
  for (const rule of TAG_RULES) {
    const values = byKey.get(rule.key) ?? new Set<string>();
    for (const value of rule.values) values.add(value);
    byKey.set(rule.key, values);
  }

  return [...byKey.entries()].map(
    ([key, values]) => `["${key}"~"^(${[...values].join('|')})$"]`,
  );
}
