'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, ClipboardList, ExternalLink, Flag } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Sheet } from '@/components/primitives/Sheet';
import { RadioGroup } from '@/components/primitives/Choice';
import { Textarea } from '@/components/primitives/Textarea';
import { useToast } from '@/components/providers/ToastProvider';
import { SAVED_STATUSES, type SavedStatus } from '@/lib/domain/enums';

/**
 * The action block on a programme page.
 *
 * "Create an action plan" is the single primary action, because PRD Principle 6
 * requires every recommendation to end in a next step, and a plan is that step.
 * Save, apply, and report are secondary and visually subordinate — exactly one
 * primary action per screen (BDS §1.1 law 10).
 */
export function OpportunityActions({
  opportunityId,
  slug,
  saved,
  applyUrl,
  officialUrl,
  hasSteps,
}: {
  readonly opportunityId: string;
  readonly slug: string;
  readonly saved: { readonly id: string; readonly status: string } | null;
  readonly applyUrl: string | null;
  readonly officialUrl: string | null;
  readonly hasSteps: boolean;
}) {
  const t = useTranslations('opportunities');
  const ts = useTranslations('saved');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const tch = useTranslations('chat');
  const toast = useToast();
  const router = useRouter();

  const [current, setCurrent] = useState(saved);
  const [statusSheet, setStatusSheet] = useState(false);
  const [reportSheet, setReportSheet] = useState(false);
  const [status, setStatus] = useState<SavedStatus>((saved?.status as SavedStatus) ?? 'interested');
  const [comment, setComment] = useState('');

  const save = useMutation({
    mutationFn: () => api.post<{ saved: { id: string; status: string } }>('/saved', { opportunityId }),
    onSuccess: (data) => {
      setCurrent(data.saved);
      toast.show({ tone: 'success', message: tc('saved') });
    },
    onError: (error) =>
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const unsave = useMutation({
    mutationFn: (savedId: string) => api.delete(`/saved/${savedId}`),
    onSuccess: () => {
      setCurrent(null);
      toast.show({
        tone: 'info',
        message: ts('removed'),
        undo: { label: tc('undo'), onUndo: () => save.mutate() },
      });
    },
    onError: (error) =>
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const updateStatus = useMutation({
    mutationFn: (next: SavedStatus) => api.patch(`/saved/${current!.id}`, { status: next }),
    onSuccess: (_data, next) => {
      setCurrent((c) => (c ? { ...c, status: next } : c));
      setStatusSheet(false);
      toast.show({ tone: 'success', message: tc('saved') });
    },
    onError: (error) =>
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const createPlan = useMutation({
    mutationFn: () => api.post<{ plan: { id: string } }>('/action-plans', { opportunityId }),
    onSuccess: () => {
      toast.show({ tone: 'success', message: tc('saved') });
      router.push('/saved');
    },
    onError: (error) =>
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const report = useMutation({
    mutationFn: () =>
      api.post('/feedback', { opportunityId, kind: 'incorrect_information', comment: comment.trim() || null }),
    onSuccess: () => {
      setReportSheet(false);
      setComment('');
      toast.show({ tone: 'success', message: tch('feedbackThanks') });
    },
    onError: (error) =>
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
  });

  const statusLabels: Record<SavedStatus, string> = {
    interested: ts('statusInterested'),
    preparing: ts('statusPreparing'),
    documents_ready: ts('statusDocumentsReady'),
    applied: ts('statusApplied'),
    under_review: ts('statusUnderReview'),
    approved: ts('statusApproved'),
    rejected: ts('statusRejected'),
    completed: ts('statusCompleted'),
  };

  return (
    <>
      <Card padding="default" className="flex flex-col gap-3">
        <Button
          size="xl"
          loading={createPlan.isPending}
          loadingLabel={t('creatingPlan')}
          disabled={!hasSteps}
          disabledReason={
            hasSteps ? undefined : tc('unknown')
          }
          onClick={() => createPlan.mutate()}
          leadingIcon={<ClipboardList size={24} className="icon" />}
        >
          {t('createPlan')}
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            loading={save.isPending || unsave.isPending}
            loadingLabel={tc('loading')}
            onClick={() => (current ? unsave.mutate(current.id) : save.mutate())}
            leadingIcon={
              current ? <BookmarkCheck size={24} className="icon" /> : <Bookmark size={24} className="icon" />
            }
          >
            {current ? tc('saved') : tc('save')}
          </Button>

          {current ? (
            <Button variant="secondary" onClick={() => setStatusSheet(true)}>
              {ts('changeStatus')}: {statusLabels[(current.status as SavedStatus) ?? 'interested']}
            </Button>
          ) : null}
        </div>

        {applyUrl || officialUrl ? (
          <a
            href={applyUrl ?? officialUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border-1.5 border-stroke px-6 type-label-lg text-text-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
          >
            <ExternalLink size={20} className="icon" aria-hidden="true" />
            {t('officialSite')}
          </a>
        ) : null}

        <Button variant="tertiary" size="md" onClick={() => setReportSheet(true)} leadingIcon={<Flag size={20} className="icon" />}>
          {tch('reportIncorrect')}
        </Button>
      </Card>

      {/* ------------------------------------------------- status sheet */}
      <Sheet
        open={statusSheet}
        onClose={() => setStatusSheet(false)}
        title={ts('changeStatus')}
        closeLabel={tc('close')}
        footer={
          <Button loading={updateStatus.isPending} loadingLabel={tc('loading')} onClick={() => updateStatus.mutate(status)}>
            {tc('save')}
          </Button>
        }
      >
        <RadioGroup
          name="saved-status"
          legend={ts('changeStatus')}
          value={status}
          onChange={setStatus}
          options={SAVED_STATUSES.map((s) => ({ value: s, label: statusLabels[s] }))}
        />
      </Sheet>

      {/* ------------------------------------------------- report sheet */}
      <Sheet
        open={reportSheet}
        onClose={() => setReportSheet(false)}
        title={tch('reportIncorrect')}
        description={tch('feedbackThanks')}
        closeLabel={tc('close')}
        footer={
          <Button loading={report.isPending} loadingLabel={tc('loading')} onClick={() => report.mutate()}>
            {tc('submit')}
          </Button>
        }
      >
        <Textarea
          label={tch('reportIncorrect')}
          optionalLabel={tc('optional')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={4}
        />
        <p className="type-caption text-text-secondary">{slug}</p>
      </Sheet>
    </>
  );
}
