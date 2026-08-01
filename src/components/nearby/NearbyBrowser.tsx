'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  MapPin, Phone, Clock, Navigation, Building2, Hospital, Scale, Sprout,
  GraduationCap, Landmark, Shield, Flame, Mail, Pill, Map as MapIcon, ExternalLink,
} from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Card } from '@/components/primitives/Card';
import { Select } from '@/components/primitives/Select';
import { Banner } from '@/components/primitives/Banner';
import { Badge, FilterChip, VerificationBadge } from '@/components/primitives/Chip';
import { EmptyState, SkeletonList } from '@/components/primitives/States';
import { DISTRICTS, districtLabel } from '@/lib/domain/geography';
import { placeLabel, placeGlyph, isUrgentPlace } from '@/lib/domain/place-labels';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { localiseDigits } from '@/lib/format/numerals';
import { MapView, type MapMarker } from './MapView';
import type { PlaceType } from '@/modules/places/osm-tags';
import type { Place, OsmStatus } from '@/modules/places/places.service';

/**
 * Nearby services: a distance-ordered list, with a real map above it.
 *
 * The list stays the primary surface and the map is an enhancement — the same
 * ordering PRD §70 and the original deviation settled on, kept now that the map
 * actually exists. Everything on the map is in the list, with the address, the
 * phone number and a directions link. Nothing is reachable only by pin.
 *
 * The screen shows two kinds of record and never blurs them:
 *
 *  • **Sample records** — the authored corpus. Complete and tiered, covering all
 *    64 districts, but with invented street addresses and no real phone numbers.
 *  • **OpenStreetMap** — genuine hospitals, police stations, courts and
 *    pharmacies with genuine coordinates, contributed by volunteers, unverified
 *    by us and patchy outside the cities.
 *
 * Merging those into one list without labels would let invented addresses borrow
 * the credibility of real ones. So each card says where it came from, and the
 * distance note says what the number was measured FROM — because "4.2 km" means
 * something quite different from a GPS fix than from a district centroid.
 */

const TYPE_ICONS: Record<string, typeof Building2> = {
  district_office: Building2,
  upazila_office: Building2,
  union_office: Building2,
  government_office: Landmark,
  hospital: Hospital,
  clinic: Hospital,
  pharmacy: Pill,
  police_station: Shield,
  court: Scale,
  fire_station: Flame,
  post_office: Mail,
  legal_aid: Scale,
  agriculture_office: Sprout,
  training_center: GraduationCap,
  ngo_office: Landmark,
  bank: Landmark,
  digital_center: Building2,
};

export function NearbyBrowser({
  places,
  activeDistrict,
  activeType,
  osm,
  reference,
  widenedToDivision,
  mapEnabled,
}: {
  readonly places: readonly Place[];
  readonly activeDistrict: string;
  readonly activeType: string;
  readonly osm: OsmStatus;
  readonly reference: { readonly lat: number; readonly lng: number; readonly kind: 'gps' | 'district' };
  readonly widenedToDivision: boolean;
  readonly mapEnabled: boolean;
}) {
  const t = useTranslations('nearby');
  const tt = useTranslations('trust');
  const tc = useTranslations('common');
  const locale = useLocale() as 'bn' | 'en';
  const { numerals } = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapVisible, setMapVisible] = useState(true);

  const apply = (next: { district?: string; type?: string; lat?: number; lng?: number }) => {
    const url = new URLSearchParams();
    url.set('district', next.district ?? activeDistrict);
    const type = next.type ?? activeType;
    if (type) url.set('type', type);
    // Precise coordinates travel in the URL so a reload keeps the honest
    // distances rather than silently reverting to the district centroid.
    if (next.lat !== undefined && next.lng !== undefined) {
      url.set('lat', next.lat.toFixed(5));
      url.set('lng', next.lng.toFixed(5));
    } else if (reference.kind === 'gps') {
      url.set('lat', reference.lat.toFixed(5));
      url.set('lng', reference.lng.toFixed(5));
    }
    startTransition(() => router.replace(`${pathname}?${url.toString()}`));
  };

  /**
   * Use the citizen's real position.
   *
   * The previous version took the GPS fix, snapped it to the nearest district
   * town and discarded the coordinates — so someone standing outside a hospital
   * was told it was eleven kilometres away, that being the distance from their
   * district's centroid. The fix is now kept and every distance on the screen is
   * measured from it. The district is still resolved alongside, because the
   * seeded corpus is indexed by district.
   */
  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError(t('locationDenied'));
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        let nearest = DISTRICTS[0]!;
        let best = Number.POSITIVE_INFINITY;
        for (const district of DISTRICTS) {
          const dLat = district.lat - latitude;
          const dLng = district.lng - longitude;
          const distance = dLat * dLat + dLng * dLng;
          if (distance < best) {
            best = distance;
            nearest = district;
          }
        }
        setLocating(false);
        apply({ district: nearest.code, lat: latitude, lng: longitude });
      },
      () => {
        setLocating(false);
        setLocationError(t('locationDenied'));
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const types = useMemo(() => [...new Set(places.map((p) => p.type))], [places]);

  const markers = useMemo<MapMarker[]>(
    () =>
      places.map((place) => ({
        id: place.id,
        lat: place.lat,
        lng: place.lng,
        label: locale === 'bn' ? place.nameBn : place.name,
        description: [
          placeLabel(place.type, locale),
          place.distanceKm !== null
            ? `${localiseDigits(String(place.distanceKm), numerals)} ${tc('km')}`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        glyph: placeGlyph(place.type),
        emphasis: isUrgentPlace(place.type),
      })),
    [places, locale, numerals, tc],
  );

  const osmCount = osm.kind === 'ok' ? osm.count : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------------------------------------------- filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          label={t('title')}
          value={activeDistrict}
          onChange={(district) => apply({ district })}
          placeholder={tc('search')}
          containerClassName="flex-1"
          searchPlaceholder={tc('search')}
          popularHeading={locale === 'bn' ? 'বড় শহর' : 'Major cities'}
          allHeading={locale === 'bn' ? 'সব জেলা' : 'All districts'}
          options={DISTRICTS.map((d) => ({
            value: d.code,
            label: locale === 'bn' ? d.bn : d.en,
            keywords: [d.en, d.bn, d.code],
            popular: ['dhaka', 'chattogram', 'khulna', 'rajshahi', 'sylhet', 'rangpur', 'barishal', 'mymensingh'].includes(d.code),
          }))}
        />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border-1.5 border-stroke px-5 type-label-lg text-text-brand hover:bg-surface-brand-subtle disabled:cursor-not-allowed disabled:text-text-disabled focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2 sm:mb-6"
        >
          <Navigation size={20} className="icon" aria-hidden="true" />
          {locating ? t('locating') : t('useMyLocation')}
        </button>
      </div>

      {locationError ? (
        <Banner tone="warning" statusWord={tc('unknown')} live>
          {locationError}
        </Banner>
      ) : null}

      {/* ---------------------------------------------------- the map */}
      {mapEnabled && places.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="type-label-md text-text-secondary">
              {osm.kind === 'ok' && osmCount > 0
                ? t('osmCount', { count: localiseDigits(String(osmCount), numerals) })
                : t('mapLabel')}
            </p>
            {/* Dismissible: on a metered connection the tiles are the most
                expensive thing on the page, and the list works without them. */}
            <button
              type="button"
              onClick={() => setMapVisible((v) => !v)}
              className="inline-flex min-h-12 items-center gap-2 rounded-md px-3 type-label-md text-text-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
            >
              <MapIcon size={20} className="icon" aria-hidden="true" />
              {mapVisible ? t('hideMap') : t('showMap')}
            </button>
          </div>

          {mapVisible ? (
            <MapView
              markers={markers}
              centre={reference}
              reference={reference}
              referenceLabel={reference.kind === 'gps' ? t('yourLocation') : t('districtCentre')}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                // Scroll the matching card into view: tapping a pin must lead to
                // the address and phone number, not just a highlighted dot.
                document.getElementById(`place-${id}`)?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
              }}
            />
          ) : null}
        </div>
      ) : null}

      {/* ---------------------------------------------------- type filter */}
      {types.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar md:-mx-5 md:px-5">
          <FilterChip label={t('typeAll')} selected={activeType === ''} onToggle={() => apply({ type: '' })} />
          {types.map((type) => (
            <FilterChip
              key={type}
              label={placeLabel(type, locale)}
              selected={activeType === type}
              onToggle={() => apply({ type: activeType === type ? '' : type })}
            />
          ))}
        </div>
      ) : null}

      {widenedToDivision ? (
        <p className="type-body-md text-text-secondary">
          {locale === 'bn'
            ? 'এই জেলায় কম তথ্য আছে, তাই আশপাশের জেলাও দেখানো হচ্ছে।'
            : 'Few records in this district, so nearby districts are included.'}
        </p>
      ) : null}

      {/* ---- provenance, stated once at the top rather than implied ---- */}
      {osm.kind === 'unavailable' ? (
        <Banner tone="warning" statusWord={tc('unknown')}>
          {t('osmUnavailable')}
        </Banner>
      ) : null}

      <Banner tone="warning" statusWord={tt('unverifiedSample')}>
        {t('unverifiedNote')}
      </Banner>

      {osmCount > 0 ? (
        <Banner tone="info" statusWord={tc('appName')}>
          {t('sourceOsmNote')}
          {/* Never let a trimmed list read as a complete one. */}
          {osm.kind === 'ok' && osm.found > osm.count ? (
            <>
              {' '}
              {t('osmTrimmed', { count: localiseDigits(String(osm.count), numerals) })}
            </>
          ) : null}
        </Banner>
      ) : null}

      {/* ---------------------------------------------------- the list */}
      {pending ? (
        <SkeletonList count={3} />
      ) : places.length === 0 ? (
        <EmptyState icon={<MapPin size={64} className="icon" strokeWidth={1.5} />} title={t('emptyTitle')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {places.map((place) => {
            const Icon = TYPE_ICONS[place.type] ?? Building2;
            const selected = selectedId === place.id;
            return (
              <li key={place.id} id={`place-${place.id}`}>
                <Card
                  padding="default"
                  className={cnCard(selected)}
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 shrink-0 text-ramp-green-600">
                      <Icon size={24} className="icon" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="type-heading-sm text-text-primary">
                        {locale === 'bn' ? place.nameBn : place.name}
                      </h3>
                      <p className="type-body-md mt-1 text-text-secondary">
                        {placeLabel(place.type, locale)}
                        {place.address ? ` · ${locale === 'bn' ? place.addressBn : place.address}` : ''}
                      </p>
                    </div>
                    {place.distanceKm !== null ? (
                      <Badge tone="neutral">
                        {tc('approximate')} {localiseDigits(String(place.distanceKm), numerals)} {tc('km')}
                      </Badge>
                    ) : null}
                  </div>

                  {place.emergency ? (
                    <p className="type-label-md text-text-error">{t('emergencyDept')}</p>
                  ) : null}

                  {place.officeHours ? (
                    <p className="type-body-md flex items-start gap-2 text-text-primary">
                      <Clock size={18} className="icon mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
                      <span>
                        <strong>{t('officeHours')}: </strong>
                        {locale === 'bn' ? place.officeHoursBn : place.officeHours}
                      </span>
                    </p>
                  ) : null}

                  {/* ---- where this record came from ---- */}
                  <div className="flex flex-wrap items-center gap-2">
                    {place.source === 'osm' ? (
                      <Badge tone="info">{t('sourceOsm')}</Badge>
                    ) : (
                      <VerificationBadge
                        status={place.verificationStatus ?? 'unverified_sample'}
                        label={
                          place.verificationStatus === 'verified' ? tt('verified') : tt('unverifiedSample')
                        }
                      />
                    )}
                    {place.district ? (
                      <Badge tone="neutral">{districtLabel(place.district, locale)}</Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    {place.phone ? (
                      <a
                        href={`tel:${place.phone}`}
                        className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-5 type-label-lg text-text-on-brand hover:bg-ramp-green-700 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                      >
                        <Phone size={20} className="icon" aria-hidden="true" />
                        {t('callOffice')} {place.phone}
                      </a>
                    ) : null}
                    {/* Directions go to OpenStreetMap, not Google Maps: the
                        coordinates came from OSM and its own router can show them
                        without an account. */}
                    <a
                      href={`https://www.openstreetmap.org/directions?to=${place.lat}%2C${place.lng}#map=16/${place.lat}/${place.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-md border-1.5 border-stroke px-5 type-label-lg text-text-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                    >
                      <Navigation size={20} className="icon" aria-hidden="true" />
                      {t('getDirections')}
                    </a>
                    {place.website ? (
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border-1.5 border-stroke px-5 type-label-lg text-text-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                      >
                        <ExternalLink size={20} className="icon" aria-hidden="true" />
                        {t('website')}
                      </a>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* The distance note names its reference point, because the same number
          means different things from a GPS fix and from a district centroid. */}
      <p className="type-caption text-text-tertiary">
        {reference.kind === 'gps' ? t('distanceFromYou') : t('distanceFromDistrict')}
      </p>
    </div>
  );
}

/** Highlight the card a map pin points at, without colour being the only cue. */
function cnCard(selected: boolean): string {
  return [
    'flex flex-col gap-3',
    selected ? 'ring-2 ring-stroke-focus' : '',
  ].filter(Boolean).join(' ');
}

export type { PlaceType };
