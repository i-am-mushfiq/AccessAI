import { getTranslations, setRequestLocale } from 'next-intl/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { serviceLocations } from '@/lib/db/schema';
import { getFullSession } from '@/lib/http/session';
import { DISTRICTS, getDistrict, haversineKm } from '@/lib/domain/geography';
import { NearbyBrowser } from '@/components/nearby/NearbyBrowser';
import { env } from '@/lib/config/env';

/**
 * Nearby Services — PRD §Feature 12 and §70.
 *
 * Renders a distance-ordered LIST as the primary surface, with the map as an
 * enhancement. With no map provider key the screen is fully functional; PRD §70
 * describes an interactive map, and delivering a broken empty map instead of a
 * usable list would be worse than the documented deviation.
 */
export default async function NearbyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ district?: string; type?: string; opportunitySlug?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('nearby');
  const session = await getFullSession();

  const district =
    query.district ?? session?.profile?.district ?? session?.user.district ?? 'dhaka';
  const reference = getDistrict(district);

  // Widen to the division when a district has little indexed, so the list is
  // never empty simply because one district town has few records.
  const conditions = [];
  if (query.type) conditions.push(eq(serviceLocations.type, query.type as never));

  const primary = await db
    .select()
    .from(serviceLocations)
    .where(and(eq(serviceLocations.district, district), ...conditions))
    .limit(200);

  const divisionCodes = reference
    ? DISTRICTS.filter((d) => d.division === reference.division).map((d) => d.code)
    : [];

  const rows =
    primary.length >= 3 || divisionCodes.length === 0
      ? primary
      : await db
          .select()
          .from(serviceLocations)
          .where(and(inArray(serviceLocations.district, divisionCodes), ...conditions))
          .limit(200);

  let items = rows.map((location) => ({
    id: location.id,
    name: location.name,
    nameBn: location.nameBn,
    type: location.type,
    address: location.address,
    addressBn: location.addressBn,
    district: location.district,
    lat: location.lat,
    lng: location.lng,
    phone: location.phone,
    officeHours: location.officeHours,
    officeHoursBn: location.officeHoursBn,
    services: location.services,
    verificationStatus: location.verificationStatus,
    distanceKm: reference
      ? Math.round(haversineKm(reference, { lat: location.lat, lng: location.lng }) * 10) / 10
      : null,
  }));

  if (query.opportunitySlug) {
    items = items.filter((l) => l.services.includes(query.opportunitySlug!));
  }
  items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary measure">{t('subtitle')}</p>
      </header>

      <NearbyBrowser
        items={items}
        activeDistrict={district}
        activeType={query.type ?? ''}
        mapProvider={env.NEXT_PUBLIC_MAP_PROVIDER}
        widenedToDivision={rows !== primary}
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
