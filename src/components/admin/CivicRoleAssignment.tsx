'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { Check } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Chip';
import { Select } from '@/components/primitives/Select';
import { TextField } from '@/components/primitives/TextField';
import { useToast } from '@/components/providers/ToastProvider';
import { CIVIC_ROLES, type CivicRole } from '@/lib/domain/enums';

export interface CivicUserRow {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly civicRole: CivicRole;
  readonly civicUnionId: string | null;
  readonly civicUpazila: string | null;
  readonly civicDistrict: string | null;
}

const ROLE_LABEL: Record<CivicRole, string> = {
  none: 'None',
  union_staff: 'Union Office Staff',
  union_chairman: 'Union Parishad Chairman',
  upazila_officer: 'Upazila Officer',
  zila_officer: 'Zila Officer',
};

export function CivicRoleAssignment({
  items,
  unions,
  canManage,
}: {
  readonly items: readonly CivicUserRow[];
  readonly unions: readonly { readonly id: string; readonly name: string; readonly nameBn: string }[];
  readonly canManage: boolean;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<CivicRole>('none');
  const [draftUnionId, setDraftUnionId] = useState<string | undefined>();
  const [draftUpazila, setDraftUpazila] = useState('');
  const [draftDistrict, setDraftDistrict] = useState('');

  const assign = useMutation({
    mutationFn: (userId: string) =>
      api.patch('/admin/users', {
        userId,
        civicRole: draftRole,
        civicUnionId: draftRole === 'union_chairman' || draftRole === 'union_staff' ? draftUnionId : null,
        civicUpazila: draftRole === 'upazila_officer' ? draftUpazila : null,
        civicDistrict: draftRole === 'zila_officer' ? draftDistrict : null,
      }),
    onSuccess: () => {
      toast.show({ tone: 'success', message: tc('saved') });
      setEditingId(null);
      router.refresh();
    },
    onError: (error) => toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const startEditing = (row: CivicUserRow) => {
    setEditingId(row.id);
    setDraftRole(row.civicRole);
    setDraftUnionId(row.civicUnionId ?? undefined);
    setDraftUpazila(row.civicUpazila ?? '');
    setDraftDistrict(row.civicDistrict ?? '');
  };

  return (
    <ul className="flex flex-col gap-3">
      {items.map((row) => (
        <li key={row.id}>
          <Card padding="default" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="type-body-lg text-text-primary">{row.name}</p>
                <p className="type-caption tabular text-text-tertiary">{row.phone}</p>
              </div>
              <Badge tone={row.civicRole === 'none' ? 'neutral' : 'brand'}>
                {row.civicRole === 'none' ? t('noCivicRole') : ROLE_LABEL[row.civicRole]}
              </Badge>
            </div>

            {canManage && editingId !== row.id ? (
              <Button variant="tertiary" size="md" onClick={() => startEditing(row)}>
                {t('assignCivicRole')}
              </Button>
            ) : null}

            {editingId === row.id ? (
              <div className="flex flex-col gap-3 border-t border-stroke-subtle pt-3">
                <Select
                  label={t('assignCivicRole')}
                  placeholder={t('assignCivicRole')}
                  options={CIVIC_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                  value={draftRole}
                  onChange={(value) => setDraftRole(value)}
                />
                {draftRole === 'union_chairman' || draftRole === 'union_staff' ? (
                  <Select
                    label="Union"
                    placeholder="Union"
                    options={unions.map((u) => ({ value: u.id, label: `${u.name} (${u.nameBn})` }))}
                    value={draftUnionId}
                    onChange={setDraftUnionId}
                  />
                ) : null}
                {draftRole === 'upazila_officer' ? (
                  <TextField label="Upazila" value={draftUpazila} onChange={(e) => setDraftUpazila(e.target.value)} />
                ) : null}
                {draftRole === 'zila_officer' ? (
                  <TextField label="District" value={draftDistrict} onChange={(e) => setDraftDistrict(e.target.value)} />
                ) : null}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    loading={assign.isPending}
                    loadingLabel={tc('loading')}
                    onClick={() => assign.mutate(row.id)}
                    leadingIcon={<Check size={18} className="icon" />}
                  >
                    {tc('save')}
                  </Button>
                  <Button variant="tertiary" size="md" onClick={() => setEditingId(null)}>
                    {tc('cancel')}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}
