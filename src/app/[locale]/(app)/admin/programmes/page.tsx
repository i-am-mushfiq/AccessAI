import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { opportunities, organizations, eligibilityRules } from '@/lib/db/schema';
import { getFullSession, isStaff } from '@/lib/http/session';
import { AdminNav } from '@/components/admin/AdminNav';
import { ProgrammeTable } from '@/components/admin/ProgrammeTable';

/**
 * Programme management — PRD §Feature 20 and §77.
 *
 * The `ruleCount` column is deliberately first among the status columns: a
 * programme with no active rule can only ever answer "more information needed",
 * so an operator needs to see that before anything else about the record.
 */
export default async function AdminProgrammesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');

  const rows = await db
    .select({
      id: opportunities.id,
      slug: opportunities.slug,
      title: opportunities.title,
      titleBn: opportunities.titleBn,
      category: opportunities.category,
      status: opportunities.status,
      verificationStatus: opportunities.verificationStatus,
      version: opportunities.version,
      deadline: opportunities.deadline,
      lastVerifiedAt: opportunities.lastVerifiedAt,
      updatedAt: opportunities.updatedAt,
      organizationName: organizations.name,
      ruleCount: sql<number>`(SELECT count(*) FROM ${eligibilityRules} WHERE ${eligibilityRules.opportunityId} = ${opportunities.id} AND ${eligibilityRules.active} = 1)`,
    })
    .from(opportunities)
    .innerJoin(organizations, eq(opportunities.organizationId, organizations.id))
    .orderBy(desc(opportunities.updatedAt))
    .limit(200);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('programmes')}</h1>
      </header>

      <AdminNav />

      <ProgrammeTable
        items={rows.map((row) => ({
          ...row,
          ruleCount: Number(row.ruleCount),
          deadline: row.deadline ? row.deadline.toISOString() : null,
          lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
          updatedAt: row.updatedAt.toISOString(),
        }))}
        canVerify={session.user.role === 'administrator' || session.user.role === 'super_admin'}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
