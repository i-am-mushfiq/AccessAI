import { SERVICE_LOCATION_TYPES, type ServiceLocationType } from './enums';
import type { PlaceType } from '@/modules/places/osm-tags';

/**
 * Human labels and map glyphs for every kind of place.
 *
 * Kept beside the enum rather than in the component, so the exhaustiveness check
 * at the bottom of this file fails the BUILD when a type is added without a
 * label. The alternative — a lookup with a `?? type.replace(/_/g, ' ')` fallback —
 * is how a citizen ends up reading "police station" in a Bangla interface, or
 * worse, `agriculture_office`.
 *
 * The glyph is a one- or two-character Bangla/Latin cue drawn on the map marker.
 * It exists because BDS §2.2 rule 4 forbids conveying meaning by colour alone, and
 * a map of same-coloured dots is exactly that. A letter also survives the
 * greyscale printing and the cracked screens this audience actually uses.
 */
export interface PlaceLabel {
  readonly bn: string;
  readonly en: string;
  /** Marker glyph. Short — it sits in a 28 dp circle. */
  readonly glyph: string;
  /** Drawn in the alert tint: somewhere you go when something has gone wrong. */
  readonly urgent?: boolean;
}

export const PLACE_LABELS: Record<PlaceType, PlaceLabel> = {
  // ---- administrative tiers. The tier is the point: it decides where a form
  // can actually be filed, so the labels name it explicitly.
  union_office: { bn: 'ইউনিয়ন পরিষদ', en: 'Union council office', glyph: 'ইউ' },
  upazila_office: { bn: 'উপজেলা অফিস', en: 'Upazila office', glyph: 'উ' },
  district_office: { bn: 'জেলা সমাজসেবা অফিস', en: 'District social services', glyph: 'জ' },
  // Untiered, for OSM records where the tier is genuinely unknown.
  government_office: { bn: 'সরকারি অফিস', en: 'Government office', glyph: 'স' },

  // ---- health
  hospital: { bn: 'হাসপাতাল', en: 'Hospital', glyph: 'হা', urgent: true },
  clinic: { bn: 'ক্লিনিক / স্বাস্থ্যকেন্দ্র', en: 'Clinic or health centre', glyph: 'ক' },
  pharmacy: { bn: 'ফার্মেসি', en: 'Pharmacy', glyph: 'ফা' },

  // ---- emergency and justice
  police_station: { bn: 'থানা', en: 'Police station', glyph: 'থা', urgent: true },
  court: { bn: 'আদালত', en: 'Court', glyph: 'আ' },
  fire_station: { bn: 'ফায়ার সার্ভিস', en: 'Fire service', glyph: 'ফ', urgent: true },

  // ---- everything else
  post_office: { bn: 'ডাকঘর', en: 'Post office', glyph: 'ডা' },
  legal_aid: { bn: 'আইনি সহায়তা', en: 'Legal aid', glyph: 'আই' },
  agriculture_office: { bn: 'কৃষি অফিস', en: 'Agriculture office', glyph: 'কৃ' },
  training_center: { bn: 'প্রশিক্ষণ কেন্দ্র', en: 'Training centre', glyph: 'প্র' },
  ngo_office: { bn: 'এনজিও অফিস', en: 'NGO office', glyph: 'এন' },
  bank: { bn: 'ব্যাংক', en: 'Bank', glyph: 'ব্যা' },
  digital_center: { bn: 'ডিজিটাল সেন্টার', en: 'Digital centre', glyph: 'ডি' },
};

export function placeLabel(type: PlaceType, locale: 'bn' | 'en'): string {
  return PLACE_LABELS[type]?.[locale] ?? type.replace(/_/g, ' ');
}

export function placeGlyph(type: PlaceType): string {
  return PLACE_LABELS[type]?.glyph ?? '•';
}

export function isUrgentPlace(type: PlaceType): boolean {
  return PLACE_LABELS[type]?.urgent === true;
}

/**
 * Compile-time exhaustiveness.
 *
 * If a type is added to `SERVICE_LOCATION_TYPES` without a label above, this
 * assignment stops typechecking — which is the whole reason the labels live here
 * instead of in a component with a string fallback that would hide the omission.
 */
const _exhaustive: Record<ServiceLocationType, PlaceLabel> = PLACE_LABELS;
void _exhaustive;
void SERVICE_LOCATION_TYPES;
