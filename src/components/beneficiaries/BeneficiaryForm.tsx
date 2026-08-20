'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { TextField } from '@/components/primitives/TextField';
import { Select } from '@/components/primitives/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { ENTITLEMENT_PERIODS, type EntitlementPeriod } from '@/lib/domain/enums';

export function BeneficiaryForm() {
  const t = useTranslations('beneficiaries');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const router = useRouter();

  const [nidNumber, setNidNumber] = useState('');
  const [programCode, setProgramCode] = useState('');
  const [programName, setProgramName] = useState('');
  const [programNameBn, setProgramNameBn] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<EntitlementPeriod>('monthly');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ beneficiary: { id: string } }>('/beneficiaries', {
        nidNumber,
        programCode,
        programName,
        programNameBn,
        amount: Number(amount),
        period,
      }),
    onSuccess: (result) => {
      toast.show({ tone: 'success', message: t('enrolled') });
      router.push(`/beneficiaries/${result.beneficiary.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isValidation && error.fields) {
        setFieldErrors(error.fields);
        return;
      }
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
    },
  });

  const canSubmit =
    nidNumber.trim().length >= 9 &&
    programCode.trim().length >= 1 &&
    programName.trim().length >= 1 &&
    programNameBn.trim().length >= 1 &&
    Number(amount) > 0;

  return (
    <Card padding="default" className="flex flex-col gap-4">
      <TextField
        label={t('nidLabel')}
        helper={t('nidHelper')}
        error={fieldErrors.nidNumber}
        value={nidNumber}
        onChange={(e) => setNidNumber(e.target.value)}
        inputMode="numeric"
        normaliseDigits
        maxLength={20}
      />
      <TextField
        label={t('programCodeLabel')}
        helper={t('programCodeHelper')}
        error={fieldErrors.programCode}
        value={programCode}
        onChange={(e) => setProgramCode(e.target.value.trim())}
        placeholder="widow-allowance"
        maxLength={60}
      />
      <TextField
        label={`${t('programNameLabel')} (English)`}
        error={fieldErrors.programName}
        value={programName}
        onChange={(e) => setProgramName(e.target.value)}
        maxLength={160}
      />
      <TextField
        label={`${t('programNameLabel')} (বাংলা)`}
        error={fieldErrors.programNameBn}
        value={programNameBn}
        onChange={(e) => setProgramNameBn(e.target.value)}
        maxLength={160}
      />
      <TextField
        label={t('amountLabel')}
        error={fieldErrors.amount}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        normaliseDigits
        prefix="৳"
      />
      <Select
        label={t('periodLabel')}
        placeholder={t('periodLabel')}
        options={ENTITLEMENT_PERIODS.map((p) => ({ value: p, label: t(`period.${p}` as never) }))}
        value={period}
        onChange={setPeriod}
      />

      <Button
        variant="primary"
        size="lg"
        disabled={!canSubmit}
        loading={submit.isPending}
        loadingLabel={tc('loading')}
        onClick={() => submit.mutate()}
        leadingIcon={<UserPlus size={20} className="icon" />}
      >
        {t('enrol')}
      </Button>
    </Card>
  );
}
