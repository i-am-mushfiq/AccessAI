'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Search, ShieldOff } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { TextField } from '@/components/primitives/TextField';
import { Select } from '@/components/primitives/Select';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Chip';
import { Banner } from '@/components/primitives/Banner';
import { useToast } from '@/components/providers/ToastProvider';
import { formatPhone } from '@/lib/format/numerals';
import { formatDate } from '@/lib/format/dates';
import { ROLE_RANK, USER_ROLES, type UserRole } from '@/lib/domain/enums';

/**
 * Role management with the guard rails enforced on BOTH sides.
 *
 * The API refuses a self-edit or a grant at-or-above the actor's rank; this UI
 * disables those controls WITH A REASON, so a moderator understands why they
 * cannot promote someone rather than tapping a button that always fails.
 */
export function UserTable({
  items,
  currentUserId,
  currentUserRole,
  canManage,
}: {
  readonly items: readonly {
    id: string; name: string; phone: string; role: UserRole; status: string;
    district: string | null; language: string; lastLoginAt: string | null; createdAt: string;
  }[];
  readonly currentUserId: string;
  readonly currentUserRole: UserRole;
  readonly canManage: boolean;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: (input: { userId: string; role?: UserRole; status?: 'active' | 'suspended' }) =>
      api.patch<{ sessionsRevoked: boolean }>('/admin/users', input),
    onSuccess: (data) => {
      toast.show({
        tone: 'success',
        message: data.sessionsRevoked
          ? locale === 'bn'
            ? 'পরিবর্তন হয়েছে এবং সব ডিভাইস থেকে বের করে দেওয়া হয়েছে।'
            : 'Changed, and their sessions were revoked immediately.'
          : tc('saved'),
      });
      router.refresh();
    },
    onError: (error) =>
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
    onSettled: () => setPendingId(null),
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) => item.name.toLowerCase().includes(needle) || item.phone.includes(needle),
    );
  }, [items, search]);

  /** Only roles strictly below the actor's own rank can be granted. */
  const grantableRoles = USER_ROLES.filter((role) => ROLE_RANK[role] < ROLE_RANK[currentUserRole]);

  return (
    <div className="flex flex-col gap-4">
      {!canManage ? (
        <Banner tone="info" statusWord={tc('appName')}>
          {locale === 'bn'
            ? 'আপনি ব্যবহারকারীর তালিকা দেখতে পারেন, তবে ভূমিকা বদলাতে প্রশাসকের অনুমতি লাগে।'
            : 'You can view users, but changing a role requires administrator rank.'}
        </Banner>
      ) : null}

      <TextField
        label={tc('search')}
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        leadingIcon={<Search size={20} className="icon" />}
        clearable
        onClear={() => setSearch('')}
        clearLabel={tc('close')}
      />

      <ul className="flex flex-col gap-3">
        {visible.map((item) => {
          const isSelf = item.id === currentUserId;
          const outranksMe = ROLE_RANK[item.role] >= ROLE_RANK[currentUserRole];
          const locked = !canManage || isSelf || outranksMe;

          return (
            <li key={item.id}>
              <Card padding="default" className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="type-body-lg text-text-primary">
                      {item.name}
                      {isSelf ? (
                        <span className="type-body-md text-text-secondary">
                          {' '}
                          ({locale === 'bn' ? 'আপনি' : 'you'})
                        </span>
                      ) : null}
                    </p>
                    <p className="type-body-md mt-0.5 tabular text-text-secondary" dir="ltr">
                      {formatPhone(item.phone)}
                    </p>
                    <p className="type-caption mt-0.5 text-text-tertiary">
                      {item.lastLoginAt
                        ? `${locale === 'bn' ? 'শেষ প্রবেশ' : 'Last sign-in'}: ${formatDate(new Date(item.lastLoginAt), locale, { style: 'short' })}`
                        : locale === 'bn'
                          ? 'কখনো ঢোকেননি'
                          : 'Never signed in'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={item.role === 'citizen' ? 'neutral' : 'brand'}>
                      {item.role.replace(/_/g, ' ')}
                    </Badge>
                    <Badge tone={item.status === 'active' ? 'success' : 'error'}>{item.status}</Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Select
                    label={locale === 'bn' ? 'ভূমিকা' : 'Role'}
                    value={item.role}
                    onChange={(role) => {
                      setPendingId(item.id);
                      update.mutate({ userId: item.id, role });
                    }}
                    placeholder={item.role}
                    disabled={locked}
                    containerClassName="flex-1"
                    options={
                      grantableRoles.length >= 2
                        ? grantableRoles.map((role) => ({ value: role, label: role.replace(/_/g, ' ') }))
                        : USER_ROLES.map((role) => ({
                            value: role,
                            label: role.replace(/_/g, ' '),
                            disabled: ROLE_RANK[role] >= ROLE_RANK[currentUserRole],
                          }))
                    }
                  />

                  <Button
                    variant={item.status === 'active' ? 'danger-subtle' : 'secondary'}
                    size="md"
                    fullWidth={false}
                    disabled={locked}
                    disabledReason={
                      isSelf
                        ? locale === 'bn'
                          ? 'নিজের অবস্থা নিজে বদলাতে পারবেন না।'
                          : 'You cannot change your own status.'
                        : outranksMe
                          ? locale === 'bn'
                            ? 'আপনার সমান বা উঁচু পদের কারও তথ্য বদলাতে পারবেন না।'
                            : 'You cannot change someone at or above your own rank.'
                          : locale === 'bn'
                            ? 'শুধু প্রশাসক পারেন।'
                            : 'Administrators only.'
                    }
                    loading={pendingId === item.id && update.isPending}
                    loadingLabel={tc('loading')}
                    onClick={() => {
                      setPendingId(item.id);
                      update.mutate({
                        userId: item.id,
                        status: item.status === 'active' ? 'suspended' : 'active',
                      });
                    }}
                    leadingIcon={<ShieldOff size={20} className="icon" />}
                    className="sm:mb-6"
                  >
                    {item.status === 'active'
                      ? locale === 'bn'
                        ? 'স্থগিত করুন'
                        : 'Suspend'
                      : locale === 'bn'
                        ? 'সক্রিয় করুন'
                        : 'Reactivate'}
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
