'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, MapPin, CreditCard } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card, Section } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { TextField } from '@/components/primitives/TextField';
import { Select } from '@/components/primitives/Select';
import { Banner } from '@/components/primitives/Banner';
import { Badge } from '@/components/primitives/Chip';
import { useToast } from '@/components/providers/ToastProvider';
import type { NidVerificationStatus, ResidencyVerificationMethod } from '@/lib/domain/enums';

interface UnionOption {
  readonly id: string;
  readonly name: string;
  readonly nameBn: string;
}

interface IdentityStatusView {
  readonly nidVerificationStatus: NidVerificationStatus | 'unverified';
  readonly residencyUnionId: string | null;
  readonly residencyVerificationMethod: ResidencyVerificationMethod | null;
  readonly union: { readonly id: string; readonly name: string; readonly nameBn: string } | null;
}

export function IdentityVerification({
  initialStatus,
  unions,
}: {
  readonly initialStatus: IdentityStatusView;
  readonly unions: readonly UnionOption[];
}) {
  const t = useTranslations('identity');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const router = useRouter();

  const [status, setStatus] = useState(initialStatus);
  const [nidNumber, setNidNumber] = useState('');
  const [nidError, setNidError] = useState<string | undefined>();
  const [selectedUnionId, setSelectedUnionId] = useState<string | undefined>(status.residencyUnionId ?? undefined);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const verifyNid = useMutation({
    mutationFn: () => api.post<{ accepted: boolean; status: NidVerificationStatus; reason: string | null }>(
      '/identity/nid',
      { nidNumber },
    ),
    onSuccess: (result) => {
      if (result.accepted) {
        setStatus((prev) => ({ ...prev, nidVerificationStatus: result.status }));
        setNidError(undefined);
        toast.show({ tone: 'success', message: tc('saved') });
      } else {
        setNidError(result.reason ?? undefined);
      }
    },
    onError: (error) => toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const verifyResidency = useMutation({
    mutationFn: (input: { lat?: number; lng?: number; unionId?: string }) =>
      api.post<{ matched: boolean; union: UnionOption | null; method: ResidencyVerificationMethod | null }>(
        '/identity/residency',
        input,
      ),
    onSuccess: (result) => {
      if (result.matched && result.union && result.method) {
        setStatus((prev) => ({
          ...prev,
          residencyUnionId: result.union!.id,
          residencyVerificationMethod: result.method,
          union: result.union,
        }));
        setLocationNote(null);
        toast.show({ tone: 'success', message: tc('saved') });
        router.refresh();
      } else {
        setLocationNote(t('locationFailed'));
      }
    },
    onError: (error) => toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationNote(t('locationDenied'));
      return;
    }
    setLocating(true);
    setLocationNote(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        verifyResidency.mutate({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocationNote(t('locationDenied'));
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const nidBadge =
    status.nidVerificationStatus === 'simulated_verified' || status.nidVerificationStatus === 'verified'
      ? { tone: 'success' as const, label: t('nidStatusSimulated') }
      : status.nidVerificationStatus === 'rejected'
        ? { tone: 'error' as const, label: t('nidStatusRejected') }
        : { tone: 'neutral' as const, label: t('nidStatusUnverified') };

  return (
    <div className="flex flex-col gap-6">
      <Banner tone="info" statusWord={tc('appName')}>
        {t('simulatedNotice')}
      </Banner>

      <Section title={t('nidSectionTitle')}>
        <Card padding="default" className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <CreditCard size={24} className="icon shrink-0 text-ramp-green-600" aria-hidden="true" />
            <Badge tone={nidBadge.tone}>{nidBadge.label}</Badge>
          </div>
          <TextField
            label={t('nidLabel')}
            helper={t('nidHelper')}
            error={nidError}
            value={nidNumber}
            onChange={(e) => setNidNumber(e.target.value)}
            inputMode="numeric"
            normaliseDigits
            maxLength={20}
          />
          <Button
            variant="primary"
            size="md"
            disabled={nidNumber.trim().length === 0}
            loading={verifyNid.isPending}
            loadingLabel={tc('loading')}
            onClick={() => verifyNid.mutate()}
            leadingIcon={<ShieldCheck size={20} className="icon" />}
          >
            {t('nidVerify')}
          </Button>
        </Card>
      </Section>

      <Section title={t('residencySectionTitle')}>
        <Card padding="default" className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <MapPin size={24} className="icon shrink-0 text-ramp-green-600" aria-hidden="true" />
            {status.union ? (
              <Badge tone="success">
                {status.residencyVerificationMethod === 'gps_geofence'
                  ? t('residencyVerifiedGps')
                  : t('residencyVerifiedManual')}
                {' · '}
                {status.union.name}
              </Badge>
            ) : (
              <Badge tone="neutral">{t('residencyNotVerified')}</Badge>
            )}
          </div>
          <p className="type-body-md text-text-secondary">{t('residencyHelper')}</p>

          <Button
            variant="secondary"
            size="md"
            loading={locating || verifyResidency.isPending}
            loadingLabel={t('locating')}
            onClick={useMyLocation}
            leadingIcon={<MapPin size={20} className="icon" />}
          >
            {t('useMyLocation')}
          </Button>

          {locationNote ? <p className="type-body-md text-text-error">{locationNote}</p> : null}

          <Select
            label={t('chooseUnion')}
            placeholder={t('chooseUnion')}
            options={unions.map((u) => ({ value: u.id, label: `${u.name} (${u.nameBn})` }))}
            value={selectedUnionId}
            onChange={(value) => {
              setSelectedUnionId(value);
              verifyResidency.mutate({ unionId: value });
            }}
          />
        </Card>
      </Section>
    </div>
  );
}
