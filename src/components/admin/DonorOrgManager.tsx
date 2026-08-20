'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Chip';
import { TextField } from '@/components/primitives/TextField';
import { useToast } from '@/components/providers/ToastProvider';

export interface DonorOrgRow {
  readonly id: string;
  readonly name: string;
  readonly nameBn: string;
  readonly programCodes: readonly string[];
}

/** SJ-27 — administrator creates a donor org and the programme codes it funds. */
export function DonorOrgManager({ items, canManage }: { readonly items: readonly DonorOrgRow[]; readonly canManage: boolean }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [programCodes, setProgramCodes] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.post('/admin/donors', {
        name,
        nameBn,
        programCodes: programCodes.split(',').map((c) => c.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      toast.show({ tone: 'success', message: tc('saved') });
      setShowForm(false);
      setName('');
      setNameBn('');
      setProgramCodes('');
      router.refresh();
    },
    onError: (error) => toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {items.map((org) => (
          <li key={org.id}>
            <Card padding="default" className="flex items-center justify-between gap-3">
              <p className="type-body-lg text-text-primary">
                {org.name} <span className="type-caption text-text-tertiary">({org.nameBn})</span>
              </p>
              <div className="flex flex-wrap gap-1">
                {org.programCodes.map((code) => (
                  <Badge key={code} tone="info">
                    {code}
                  </Badge>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {canManage && !showForm ? (
        <Button variant="tertiary" size="md" onClick={() => setShowForm(true)} leadingIcon={<Plus size={18} className="icon" />}>
          {t('createDonorOrg')}
        </Button>
      ) : null}

      {showForm ? (
        <Card padding="default" className="flex flex-col gap-3">
          <TextField label={`${t('donorOrgName')} (English)`} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label={`${t('donorOrgName')} (বাংলা)`} value={nameBn} onChange={(e) => setNameBn(e.target.value)} />
          <TextField
            label={t('donorProgramCodes')}
            value={programCodes}
            onChange={(e) => setProgramCodes(e.target.value)}
            placeholder="widow-allowance, elderly-allowance"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="md"
              loading={create.isPending}
              loadingLabel={tc('loading')}
              disabled={!name.trim() || !nameBn.trim() || !programCodes.trim()}
              onClick={() => create.mutate()}
            >
              {tc('save')}
            </Button>
            <Button variant="tertiary" size="md" onClick={() => setShowForm(false)}>
              {tc('cancel')}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
