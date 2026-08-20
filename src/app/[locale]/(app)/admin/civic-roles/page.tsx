import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { desc, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { getFullSession, isStaff, canManageUsers } from '@/lib/http/session';
import { listUnions } from '@/modules/identity/identity.service';
import { AdminNav } from '@/components/admin/AdminNav';
import { CivicRoleAssignment } from '@/components/admin/CivicRoleAssignment';

/** SJ-31–34 — assigning who holds which civic title, and for which place. */
export default async function AdminCivicRolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');

  const [rows, unions] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        civicRole: users.civicRole,
        civicUnionId: users.civicUnionId,
        civicUpazila: users.civicUpazila,
        civicDistrict: users.civicDistrict,
      })
      .from(users)
      .where(ne(users.role, 'super_admin'))
      .orderBy(desc(users.createdAt))
      .limit(150),
    listUnions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('civicRoles')}</h1>
      </header>

      <AdminNav />

      <CivicRoleAssignment
        items={rows}
        unions={unions.map((u) => ({ id: u.id, name: u.name, nameBn: u.nameBn }))}
        canManage={canManageUsers(session.user.role)}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
