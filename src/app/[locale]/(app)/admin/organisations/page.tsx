import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { asc, sql } from 'drizzle-orm';
import { ExternalLink, Phone } from 'lucide-react';
import { db } from '@/lib/db/client';
import { organizations, opportunities } from '@/lib/db/schema';
import { getFullSession, isStaff } from '@/lib/http/session';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card } from '@/components/primitives/Card';
import { Badge, VerificationBadge } from '@/components/primitives/Chip';
import { Num } from '@/components/primitives/Money';

/** Organisation register — PRD §Feature 20 ("Manage Organizations"). */
export default async function AdminOrganisationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const bn = locale === 'bn';

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');
  const tt = await getTranslations('trust');

  const rows = await db
    .select({
      organization: organizations,
      programmeCount: sql<number>`(SELECT count(*) FROM ${opportunities} WHERE ${opportunities.organizationId} = ${organizations.id})`,
    })
    .from(organizations)
    .orderBy(asc(organizations.name));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('organizations')}</h1>
        <p className="type-body-md mt-1 text-text-secondary">
          <Num value={rows.length} />
        </p>
      </header>

      <AdminNav />

      <ul className="flex flex-col gap-3">
        {rows.map(({ organization, programmeCount }) => (
          <li key={organization.id}>
            <Card padding="default" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="type-body-lg text-text-primary">
                    {bn ? organization.nameBn : organization.name}
                  </p>
                  <p className="type-body-md mt-1 text-text-secondary clamp-2">
                    {bn ? organization.descriptionBn : organization.description}
                  </p>
                </div>
                <Badge tone="brand">
                  <Num value={Number(programmeCount)} />
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{organization.type.replace(/_/g, ' ')}</Badge>
                {/* `verified` (is the entity real) is distinct from
                    verificationStatus (are its details checked). Both shown. */}
                <Badge tone={organization.verified ? 'success' : 'warning'}>
                  {organization.verified
                    ? bn
                      ? 'সংস্থা যাচাইকৃত'
                      : 'Entity verified'
                    : bn
                      ? 'সংস্থা যাচাই হয়নি'
                      : 'Entity unverified'}
                </Badge>
                <VerificationBadge
                  status={organization.verificationStatus}
                  label={
                    organization.verificationStatus === 'verified'
                      ? tt('verified')
                      : tt('unverifiedSample')
                  }
                />
              </div>

              <div className="flex flex-wrap gap-4">
                {organization.website ? (
                  <a
                    href={organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-body-md inline-flex min-h-12 items-center gap-1.5 text-text-link underline"
                  >
                    <ExternalLink size={18} className="icon" aria-hidden="true" />
                    {organization.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : null}
                {organization.contactPhone ? (
                  <a
                    href={`tel:${organization.contactPhone}`}
                    className="type-body-md inline-flex min-h-12 items-center gap-1.5 tabular text-text-link underline"
                  >
                    <Phone size={18} className="icon" aria-hidden="true" />
                    {organization.contactPhone}
                  </a>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const dynamic = 'force-dynamic';
