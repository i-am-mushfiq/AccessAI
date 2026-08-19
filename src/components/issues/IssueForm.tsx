'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { MapPin, Send } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { TextField } from '@/components/primitives/TextField';
import { Textarea } from '@/components/primitives/Textarea';
import { Select } from '@/components/primitives/Select';
import { useToast } from '@/components/providers/ToastProvider';
import { ISSUE_CATEGORIES } from '@/lib/domain/enums';
import type { IssueCategory } from '@/lib/domain/enums';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function IssueForm() {
  const t = useTranslations('issues');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const router = useRouter();

  const [category, setCategory] = useState<IssueCategory | undefined>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError(t('locationDenied'));
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocationError(t('locationDenied'));
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const onPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPhotoDataUrl(dataUrl);
  };

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ issue: { id: string } }>('/issues', {
        category,
        title,
        description,
        lat: coords?.lat,
        lng: coords?.lng,
        photoDataUrl,
      }),
    onSuccess: (result) => {
      toast.show({ tone: 'success', message: t('submitted') });
      router.push(`/issues/${result.issue.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.isValidation && error.fields) {
        setFieldErrors(error.fields);
        return;
      }
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
    },
  });

  const canSubmit = Boolean(category) && title.trim().length >= 4 && description.trim().length >= 8 && coords !== null;

  return (
    <Card padding="default" className="flex flex-col gap-4">
      <Select
        label={t('categoryLabel')}
        placeholder={t('categoryLabel')}
        options={ISSUE_CATEGORIES.map((c) => ({ value: c, label: t(`category.${c}`) }))}
        value={category}
        onChange={setCategory}
      />

      <TextField
        label={t('titleLabel')}
        helper={t('titleHelper')}
        error={fieldErrors.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={160}
      />

      <Textarea
        label={t('descriptionLabel')}
        helper={t('descriptionHelper')}
        error={fieldErrors.description}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={5}
        maxLength={2000}
      />

      <div className="flex flex-col gap-2">
        <label className="type-label-lg text-text-primary" htmlFor="issue-photo">
          {t('photoLabel')} <span className="type-body-md font-normal text-text-secondary">{t('photoOptional')}</span>
        </label>
        <input id="issue-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void onPhotoChange(e)} />
        {photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoDataUrl} alt="" className="h-32 w-32 rounded-md object-cover" />
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="type-label-lg text-text-primary">{t('locationLabel')}</span>
        <Button
          variant="secondary"
          size="md"
          loading={locating}
          loadingLabel={tc('loading')}
          onClick={useCurrentLocation}
          leadingIcon={<MapPin size={20} className="icon" />}
        >
          {t('useCurrentLocation')}
        </Button>
        {coords ? (
          <p className="type-body-md tabular text-text-success">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
        ) : null}
        {locationError ? <p className="type-body-md text-text-error">{locationError}</p> : null}
      </div>

      <Button
        variant="primary"
        size="lg"
        disabled={!canSubmit}
        loading={submit.isPending}
        loadingLabel={tc('loading')}
        onClick={() => submit.mutate()}
        leadingIcon={<Send size={20} className="icon" />}
      >
        {t('submitReport')}
      </Button>
    </Card>
  );
}
