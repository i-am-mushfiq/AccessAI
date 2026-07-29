'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, ExternalLink, Search } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { TextField } from '@/components/primitives/TextField';
import { Badge, FilterChip, VerificationBadge } from '@/components/primitives/Chip';
import { ConfirmDialog } from '@/components/primitives/Sheet';
import { useToast } from '@/components/providers/ToastProvider';
import { formatDate } from '@/lib/format/dates';
import type { VerificationStatus } from '@/lib/domain/enums';

export interface ProgrammeRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly titleBn: string;
  readonly category: string;
  readonly status: string;
  readonly verificationStatus: VerificationStatus;
  readonly version: number;
  readonly deadline: string | null;
  readonly lastVerifiedAt: string | null;
  readonly updatedAt: string;
  readonly organizationName: string;
  readonly ruleCount: number;
}

/**
 * Programme table with search, filters, and the verify action.
 *
 * Verification is a CONFIRMED action, not a toggle: marking a record verified is
 * an assertion that a human checked it against the official circular, and it
 * lifts the confidence ceiling from 65% to 100% for every citizen who sees it.
 * A misclick there is a trust failure, so it gets a dialog that says so.
 */
export function ProgrammeTable({
  items,
  canVerify,
}: {
  readonly items: readonly ProgrammeRow[];
  readonly canVerify: boolean;
}) {
  const t = useTranslations('admin');
  const tt = useTranslations('trust');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [onlyMissingRules, setOnlyMissingRules] = useState(false);
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState<ProgrammeRow | null>(null);

  const verify = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/programs/${id}`, { verificationStatus: 'verified' }),
    onSuccess: () => {
      setConfirmVerify(null);
      toast.show({ tone: 'success', message: tt('verified') });
      router.refresh();
    },
    onError: (error) => {
      setConfirmVerify(null);
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
    },
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (onlyMissingRules && item.ruleCount > 0) return false;
      if (onlyUnverified && item.verificationStatus === 'verified') return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        item.titleBn.includes(search.trim()) ||
        item.slug.includes(needle) ||
        item.organizationName.toLowerCase().includes(needle)
      );
    });
  }, [items, onlyMissingRules, onlyUnverified, search]);

  const verificationLabel = (status: VerificationStatus) =>
    status === 'verified'
      ? tt('verified')
      : status === 'unverified_sample'
        ? tt('unverifiedSample')
        : status === 'pending_review'
          ? tt('pendingReview')
          : status === 'outdated'
            ? tt('outdated')
            : tt('disputed');

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-wrap gap-2">
        <FilterChip
          label={t('missingRules')}
          selected={onlyMissingRules}
          onToggle={() => setOnlyMissingRules((v) => !v)}
          count={items.filter((i) => i.ruleCount === 0).length}
        />
        <FilterChip
          label={tt('unverifiedSample')}
          selected={onlyUnverified}
          onToggle={() => setOnlyUnverified((v) => !v)}
          count={items.filter((i) => i.verificationStatus !== 'verified').length}
        />
      </div>

      <p className="type-body-md tabular text-text-secondary" aria-live="polite">
        {visible.length} / {items.length}
      </p>

      <ul className="flex flex-col gap-3">
        {visible.map((item) => (
          <li key={item.id}>
            <Card padding="default" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="type-body-lg text-text-primary">
                    {locale === 'bn' ? item.titleBn : item.title}
                  </p>
                  <p className="type-body-md mt-0.5 text-text-secondary">{item.organizationName}</p>
                  <p className="type-caption mt-0.5 text-text-tertiary">{item.slug}</p>
                </div>
                <Link
                  href={`/opportunities/${item.slug}`}
                  aria-label={`${item.title} — ${tc('viewDetails')}`}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill text-text-secondary hover:bg-surface-sunken focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                >
                  <ExternalLink size={20} className="icon" aria-hidden="true" />
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{item.category.replace(/_/g, ' ')}</Badge>
                <Badge tone={item.status === 'open' ? 'success' : item.status === 'draft' ? 'warning' : 'neutral'}>
                  {item.status}
                </Badge>
                <VerificationBadge status={item.verificationStatus} label={verificationLabel(item.verificationStatus)} />
                {item.ruleCount === 0 ? (
                  <Badge tone="error" icon={<AlertTriangle size={16} className="icon" />}>
                    {t('missingRules')}
                  </Badge>
                ) : (
                  <Badge tone="neutral">
                    {locale === 'bn' ? 'নিয়ম' : 'rules'} v{item.version}
                  </Badge>
                )}
                {item.deadline ? (
                  <Badge tone="neutral">{formatDate(new Date(item.deadline), locale, { style: 'short' })}</Badge>
                ) : null}
              </div>

              {item.verificationStatus !== 'verified' ? (
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  disabled={!canVerify || item.ruleCount === 0}
                  disabledReason={
                    !canVerify
                      ? locale === 'bn'
                        ? 'শুধু প্রশাসক যাচাই করতে পারেন।'
                        : 'Only an administrator can verify.'
                      : locale === 'bn'
                        ? 'নিয়ম না থাকলে যাচাই করা যায় না।'
                        : 'Cannot verify a programme with no rules.'
                  }
                  onClick={() => setConfirmVerify(item)}
                  leadingIcon={<ShieldCheck size={20} className="icon" />}
                >
                  {t('verifyRecord')}
                </Button>
              ) : (
                <p className="type-caption text-text-success">
                  {tt('lastVerified')}:{' '}
                  {item.lastVerifiedAt ? formatDate(new Date(item.lastVerifiedAt), locale) : tt('neverVerified')}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirmVerify !== null}
        onClose={() => setConfirmVerify(null)}
        onConfirm={() => confirmVerify && verify.mutate(confirmVerify.id)}
        title={t('verifyRecord')}
        description={`${t('verifyWarning')} ${confirmVerify ? `— ${confirmVerify.title}` : ''}`}
        confirmLabel={t('verifyRecord')}
        cancelLabel={tc('cancel')}
        confirming={verify.isPending}
        confirmingLabel={tc('loading')}
      />
    </div>
  );
}
