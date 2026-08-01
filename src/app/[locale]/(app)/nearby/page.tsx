import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getFullSession } from '@/lib/http/session';
import { findNearby } from '@/modules/places/places.service';
import { placeLabel } from '@/lib/domain/place-labels';
import { NearbyBrowser } from '@/components/nearby/NearbyBrowser';
import { env } from '@/lib/config/env';
import type { PlaceType } from '@/modules/places/osm-tags';

/**
 * Nearby Services — PRD §Feature 12 and §70.
 *
 * Two sources, kept distinguishable: the authored sample corpus (complete,
 * tiered, all 64 districts, invented addresses) and OpenStreetMap (real
 * hospitals, police stations, courts and pharmacies, volunteer-maintained,
 * patchy outside the cities). See `places.service.ts` for why they are never
 * merged into one undifferentiated list.
 *
 * The distance-ordered LIST remains the primary surface and the map an
 * enhancement, per the original deviation — but the map is now real rather than
 * absent, served through this app's own tile proxy so no third-party origin is
 * added to the CSP and the tile host never sees who is looking up a legal-aid
 * office.
 */
export default async function NearbyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    district?: string;
    type?: string;
    opportunitySlug?: string;
    lat?: string;
    lng?: string;
  }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('nearby');
  const session = await getFullSession();

  const district =
    query.district ?? session?.profile?.district ?? session?.user.district ?? 'dhaka';

  /**
   * A shared GPS fix arrives in the URL, so a reload keeps the honest distances.
   *
   * Validated rather than trusted: these are numbers from a query string that
   * become a coordinate in an outbound Overpass bounding box. A NaN would produce
   * a malformed query, and an out-of-range value a pointless worldwide search.
   */
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  const coords =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      ? { lat, lng }
      : null;

  const result = await findNearby({
    coords,
    districtCode: district,
    type: (query.type as PlaceType | undefined) ?? null,
    opportunitySlug: query.opportunitySlug ?? null,
    // Passed in rather than imported inside the service, so the business logic
    // holds no copy of the UI's strings.
    typeLabel: (type) => placeLabel(type, locale === 'bn' ? 'bn' : 'en'),
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary measure">{t('subtitle')}</p>
      </header>

      <NearbyBrowser
        places={result.places}
        activeDistrict={district}
        activeType={query.type ?? ''}
        osm={result.osm}
        reference={{ ...result.reference.point, kind: result.reference.kind }}
        widenedToDivision={result.widenedToDivision}
        mapEnabled={env.NEXT_PUBLIC_MAP_PROVIDER !== 'none'}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nearby' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
