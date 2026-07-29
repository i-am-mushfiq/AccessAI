'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api/client';
import { OpportunityCard, type OpportunityCardData } from './OpportunityCard';
import { useToast } from '@/components/providers/ToastProvider';

/**
 * Client wrapper that adds save/unsave with optimistic feedback and undo.
 *
 * Optimistic because the citizen tapping "save" gets an instant visual response
 * on a slow connection; reverted on failure with an explanatory toast rather
 * than silently, since a bookmark that appears and then vanishes without
 * explanation is worse than a slow one.
 *
 * BDS §1.1 law 5 requires destructive actions to be undoable, so unsaving
 * offers an undo in the toast rather than a confirmation dialog — the action is
 * cheap to reverse, and a dialog on every unsave would be friction.
 */
export function OpportunityListClient({
  initialItems,
  compact = false,
}: {
  readonly initialItems: readonly OpportunityCardData[];
  readonly compact?: boolean;
}) {
  const t = useTranslations('saved');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<OpportunityCardData[]>([...initialItems]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const setSaved = (id: string, saved: OpportunityCardData['saved']) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, saved } : item)));
  };

  const save = useMutation({
    mutationFn: (id: string) =>
      api.post<{ saved: { id: string; status: string } }>('/saved', { opportunityId: id }),
    onSuccess: (data, id) => {
      setSaved(id, { id: data.saved.id, status: data.saved.status });
      void queryClient.invalidateQueries({ queryKey: ['saved'] });
      toast.show({ tone: 'success', message: tc('saved') });
    },
    onError: (error, id) => {
      setSaved(id, null);
      toast.show({
        tone: 'error',
        message: error instanceof ApiError ? error.message : te('genericBody'),
      });
    },
  });

  const remove = useMutation({
    mutationFn: (savedId: string) => api.delete(`/saved/${savedId}`),
    onSuccess: (_data, savedId) => {
      const item = items.find((i) => i.saved?.id === savedId);
      void queryClient.invalidateQueries({ queryKey: ['saved'] });
      toast.show({
        tone: 'info',
        message: t('removed'),
        undo: item
          ? {
              label: tc('undo'),
              onUndo: () => {
                setSaved(item.id, { id: 'pending', status: 'interested' });
                save.mutate(item.id);
              },
            }
          : undefined,
      });
    },
    onError: (error, savedId) => {
      const item = items.find((i) => i.id === pendingId);
      if (item) setSaved(item.id, { id: savedId, status: 'interested' });
      toast.show({
        tone: 'error',
        message: error instanceof ApiError ? error.message : te('genericBody'),
      });
    },
  });

  const handleSave = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setPendingId(id);

    if (item.saved) {
      const savedId = item.saved.id;
      setSaved(id, null); // optimistic
      remove.mutate(savedId, { onSettled: () => setPendingId(null) });
    } else {
      setSaved(id, { id: 'pending', status: 'interested' }); // optimistic
      save.mutate(id, { onSettled: () => setPendingId(null) });
    }
  };

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <OpportunityCard
            item={item}
            onSave={handleSave}
            saving={pendingId === item.id}
            compact={compact}
          />
        </li>
      ))}
    </ul>
  );
}
