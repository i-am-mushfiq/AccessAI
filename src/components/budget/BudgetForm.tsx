'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { TextField } from '@/components/primitives/TextField';
import { Textarea } from '@/components/primitives/Textarea';
import { useToast } from '@/components/providers/ToastProvider';

export function BudgetForm() {
  const t = useTranslations('budget');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const router = useRouter();

  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [allocationDate, setAllocationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ allocation: { id: string } }>('/budget/allocations', {
        projectName,
        description,
        amount: Number(amount),
        allocationDate,
      }),
    onSuccess: (result) => {
      toast.show({ tone: 'success', message: t('posted') });
      router.push(`/budget/${result.allocation.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isValidation && error.fields) {
        setFieldErrors(error.fields);
        return;
      }
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
    },
  });

  const canSubmit = projectName.trim().length >= 3 && description.trim().length >= 8 && Number(amount) > 0;

  return (
    <Card padding="default" className="flex flex-col gap-4">
      <TextField
        label={t('projectNameLabel')}
        error={fieldErrors.projectName}
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        maxLength={200}
      />
      <Textarea
        label={t('descriptionLabel')}
        error={fieldErrors.description}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        maxLength={2000}
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
      <TextField
        label={t('dateLabel')}
        type="date"
        error={fieldErrors.allocationDate}
        value={allocationDate}
        onChange={(e) => setAllocationDate(e.target.value)}
      />

      <Button
        variant="primary"
        size="lg"
        disabled={!canSubmit}
        loading={submit.isPending}
        loadingLabel={tc('loading')}
        onClick={() => submit.mutate()}
        leadingIcon={<Send size={20} className="icon" />}
      >
        {t('submitAllocation')}
      </Button>
    </Card>
  );
}
