'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { MapPin, Phone, Clock, Navigation, Building2, Hospital, Scale, Sprout, GraduationCap, Landmark } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Card } from '@/components/primitives/Card';
import { Select } from '@/components/primitives/Select';
import { Banner } from '@/components/primitives/Banner';
import { Badge, FilterChip, VerificationBadge } from '@/components/primitives/Chip';
import { EmptyState, SkeletonList } from '@/components/primitives/States';
import { DISTRICTS, districtLabel } from '@/lib/domain/geography';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { localiseDigits } from '@/lib/format/numerals';

/**
 * Nearby list with district and type filters.
 *
 * The "use my location" affordance is offered, and its failure is handled
 * explicitly: BDS §75 requires every error to be actionable, so a denied
 * permission falls back to district selection with an explanation rather than
 * leaving the citizen with a dead button.
 */

const TYPE_ICONS: Record<string, typeof Building2> = {
  district_office: Building2,
  upazila_office: Building2,
  union_office: Building2,
  hospital: Hospital,
  clinic: Hospital,
  legal_aid: Scale,
  agriculture_office: Sprout,
  training_center: GraduationCap,
  ngo_office: Landmark,
  bank: Landmark,
  digital_center: Building2,
  pharmacy: Hospital,
};

const TYPE_LABELS: Record<string, { bn: string; en: string }> = {
  district_office: { bn: 'সমাজসেবা অফিস', en: 'Social services' },
  hospital: { bn: 'হাসপাতাল', en: 'Hospital' },
  legal_aid: { bn: 'আইনি সহায়তা', en: 'Legal aid' },
  agriculture_office: { bn: 'কৃষি অফিস', en: 'Agriculture office' },
  training_center: { bn: 'প্রশিক্ষণ কেন্দ্র', en: 'Training centre' },
  ngo_office: { bn: 'এনজিও অফিস', en: 'NGO office' },
};

export interface NearbyItem {
  readonly id: string;
  readonly name: string;
  readonly nameBn: string;
  readonly type: string;
  readonly address: string;
  readonly addressBn: string;
  readonly district: string;
  readonly lat: number;
  readonly lng: number;
  readonly phone: string | null;
  readonly officeHours: string | null;
  readonly officeHoursBn: string | null;
  readonly services: readonly string[];
  readonly verificationStatus: 'verified' | 'unverified_sample' | 'pending_review' | 'outdated' | 'disputed';
  readonly distanceKm: number | null;
}

export function NearbyBrowser({
  items,
  activeDistrict,
  activeType,
  mapProvider,
  widenedToDivision,
}: {
  readonly items: readonly NearbyItem[];
  readonly activeDistrict: string;
  readonly activeType: string;
  readonly mapProvider: 'none' | 'mapbox' | 'google';
  readonly widenedToDivision: boolean;
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

  const apply = (next: { district?: string; type?: string }) => {
    const url = new URLSearchParams();
    url.set('district', next.district ?? activeDistrict);
    const type = next.type ?? activeType;
    if (type) url.set('type', type);
    startTransition(() => router.replace(`${pathname}?${url.toString()}`));
  };

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError(t('locationDenied'));
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Snap to the nearest district town, because the corpus is indexed by
        // district and pretending to precise coordinates would be misleading.
        let nearest = DISTRICTS[0]!;
        let best = Number.POSITIVE_INFINITY;
        for (const district of DISTRICTS) {
          const dLat = district.lat - position.coords.latitude;
          const dLng = district.lng - position.coords.longitude;
          const distance = dLat * dLat + dLng * dLng;
          if (distance < best) {
            best = distance;
            nearest = district;
          }
        }
        setLocating(false);
        apply({ district: nearest.code });
      },
      () => {
        setLocating(false);
        setLocationError(t('locationDenied'));
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const types = [...new Set(items.map((i) => i.type))];

  return (
    <div className="flex flex-col gap-4">
      {mapProvider === 'none' ? (
        <Banner tone="info" statusWord={tc('appName')}>
          {t('mapUnavailable')}
        </Banner>
      ) : null}

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

      {types.length > 1 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar md:-mx-5 md:px-5">
          <FilterChip label={t('typeAll')} selected={activeType === ''} onToggle={() => apply({ type: '' })} />
          {types.map((type) => (
            <FilterChip
              key={type}
              label={TYPE_LABELS[type] ? TYPE_LABELS[type]![locale] : type.replace(/_/g, ' ')}
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

      <Banner tone="warning" statusWord={tt('unverifiedSample')}>
        {t('unverifiedNote')}
      </Banner>

      {pending ? (
        <SkeletonList count={3} />
      ) : items.length === 0 ? (
        <EmptyState icon={<MapPin size={64} className="icon" strokeWidth={1.5} />} title={t('emptyTitle')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((location) => {
            const Icon = TYPE_ICONS[location.type] ?? Building2;
            return (
              <li key={location.id}>
                <Card padding="default" className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 shrink-0 text-ramp-green-600">
                      <Icon size={24} className="icon" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="type-heading-sm text-text-primary">
                        {locale === 'bn' ? location.nameBn : location.name}
                      </h3>
                      <p className="type-body-md mt-1 text-text-secondary">
                        {locale === 'bn' ? location.addressBn : location.address}
                      </p>
                    </div>
                    {location.distanceKm !== null ? (
                      <Badge tone="neutral">
                        {tc('approximate')} {localiseDigits(String(location.distanceKm), numerals)} {tc('km')}
                      </Badge>
                    ) : null}
                  </div>

                  {location.officeHours ? (
                    <p className="type-body-md flex items-start gap-2 text-text-primary">
                      <Clock size={18} className="icon mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
                      <span>
                        <strong>{t('officeHours')}: </strong>
                        {locale === 'bn' ? location.officeHoursBn : location.officeHours}
                      </span>
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <VerificationBadge
                      status={location.verificationStatus}
                      label={
                        location.verificationStatus === 'verified' ? tt('verified') : tt('unverifiedSample')
                      }
                    />
                    <Badge tone="neutral">{districtLabel(location.district, locale)}</Badge>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    {location.phone ? (
                      <a
                        href={`tel:${location.phone}`}
                        className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-md bg-ramp-green-600 px-5 type-label-lg text-text-on-brand hover:bg-ramp-green-700 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                      >
                        <Phone size={20} className="icon" aria-hidden="true" />
                        {t('callOffice')} {location.phone}
                      </a>
                    ) : null}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-md border-1.5 border-stroke px-5 type-label-lg text-text-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                    >
                      <Navigation size={20} className="icon" aria-hidden="true" />
                      {t('getDirections')}
                    </a>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="type-caption text-text-tertiary">{t('distanceApproxNote')}</p>
    </div>
  );
}
