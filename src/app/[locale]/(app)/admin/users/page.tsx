import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { getFullSession, isStaff, canManageUsers } from '@/lib/http/session';
import { AdminNav } from '@/components/admin/AdminNav';
import { UserTable } from '@/components/admin/UserTable';
import { Badge } from '@/components/primitives/Chip';

/** User and role management — PRD §Feature 20 and §43 roles. */
export default async function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');

  const [rows, counts] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        role: users.role,
        status: users.status,
        district: users.district,
        language: users.language,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(150),
    db.select({ role: users.role, n: sql<number>`count(*)` }).from(users).groupBy(users.role),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('users')}</h1>
      </header>

      <AdminNav />

      <div className="flex flex-wrap gap-2">
        {counts.map((entry) => (
          <Badge key={entry.role} tone={entry.role === 'citizen' ? 'neutral' : 'brand'}>
            {entry.role.replace(/_/g, ' ')}: {Number(entry.n)}
          </Badge>
        ))}
      </div>

      <UserTable
        items={rows.map((row) => ({
          ...row,
          lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
        }))}
        currentUserId={session.userId}
        currentUserRole={session.user.role}
        canManage={canManageUsers(session.user.role)}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
