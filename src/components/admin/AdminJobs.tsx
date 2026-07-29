'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Chip';
import { useToast } from '@/components/providers/ToastProvider';
import { formatTimeAgo } from '@/lib/format/dates';
import { Num } from '@/components/primitives/Money';

const JOBS = [
  'reindex_search',
  'rebuild_embeddings',
  'detect_staleness',
  'scheduled_notifications',
  'aggregate_analytics',
] as const;

const JOB_LABELS: Record<string, { bn: string; en: string }> = {
  reindex_search: { bn: 'অনুসন্ধান ইনডেক্স নতুন করে তৈরি', en: 'Rebuild search index' },
  rebuild_embeddings: { bn: 'ভেক্টর এমবেডিং তৈরি', en: 'Generate vector embeddings' },
  detect_staleness: { bn: 'পুরনো তথ্য চিহ্নিত করুন', en: 'Flag stale records' },
  scheduled_notifications: { bn: 'শেষ তারিখের মনে করানো পাঠান', en: 'Send deadline reminders' },
  aggregate_analytics: { bn: 'পরিসংখ্যান হিসাব করুন', en: 'Roll up analytics' },
};

const JOB_DESCRIPTIONS: Record<string, { bn: string; en: string }> = {
  reindex_search: {
    bn: 'কর্মসূচির লেখা বদলালে এটি চালান, নইলে পুরনো শব্দ দিয়েই খোঁজা হবে।',
    en: 'Run after editing programme text, otherwise search still matches the old wording.',
  },
  rebuild_embeddings: {
    bn: 'এমবেডিং প্রোভাইডার সেট না থাকলে কিছুই হবে না — এটি সৎভাবে জানানো হবে।',
    en: 'Does nothing unless an embedding provider is configured — it will say so.',
  },
  detect_staleness: {
    bn: 'যাচাইয়ের সময় পেরিয়ে গেলে "পুরনো" চিহ্ন দেয়, আর মেয়াদ শেষ কর্মসূচি বন্ধ করে।',
    en: 'Marks records past their review interval as outdated and closes expired programmes.',
  },
  scheduled_notifications: {
    bn: 'সাত দিনের মধ্যে শেষ হওয়া কর্মসূচির জন্য নাগরিকদের মনে করিয়ে দেয়।',
    en: 'Reminds citizens about saved programmes closing within seven days.',
  },
  aggregate_analytics: { bn: 'আজকের পরিসংখ্যান সংরক্ষণ করে।', en: "Stores today's analytics rollup." },
};

export interface JobRunView {
  readonly id: string;
  readonly job: string;
  readonly status: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly processed: number;
  readonly detail: Record<string, unknown> | null;
}

/**
 * PRD §64 exposes "reindex" and "rebuild-embeddings" as admin actions; §45 lists
 * the background jobs. Both are surfaced here as manually-runnable operations
 * with their outcome recorded, since there is no BullMQ worker in this prototype
 * (docs/DEVIATIONS.md §8).
 */
export function AdminJobs({ runs }: { readonly runs: readonly JobRunView[] }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: (job: string) => api.post<{ result: { processed: number } }>('/admin/jobs', { job }),
    onSuccess: (data, job) => {
      toast.show({
        tone: 'success',
        message: `${JOB_LABELS[job]?.[locale] ?? job}: ${data.result.processed}`,
      });
      router.refresh();
    },
    onError: (error) =>
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') }),
    onSettled: () => setRunning(null),
  });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {JOBS.map((job) => (
          <li key={job}>
            <Card padding="default" className="flex flex-col gap-3">
              <div>
                <p className="type-body-lg text-text-primary">{JOB_LABELS[job]![locale]}</p>
                <p className="type-body-md mt-1 text-text-secondary measure">
                  {JOB_DESCRIPTIONS[job]![locale]}
                </p>
              </div>
              <Button
                variant="secondary"
                size="md"
                fullWidth={false}
                loading={running === job}
                loadingLabel={t('running')}
                onClick={() => {
                  setRunning(job);
                  run.mutate(job);
                }}
                leadingIcon={<Play size={20} className="icon" />}
              >
                {t('runJob')}
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      {runs.length > 0 ? (
        <Card padding="none">
          <ul className="divide-y divide-stroke-subtle">
            {runs.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden="true" className="shrink-0">
                  {entry.status === 'succeeded' ? (
                    <CheckCircle2 size={20} className="icon text-ramp-success-600" />
                  ) : entry.status === 'failed' ? (
                    <XCircle size={20} className="icon text-ramp-error-600" />
                  ) : (
                    <Loader2 size={20} className="icon animate-spin-slow text-text-secondary" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-body-md block text-text-primary">
                    {JOB_LABELS[entry.job]?.[locale] ?? entry.job}
                  </span>
                  <span className="type-caption block text-text-secondary">
                    {formatTimeAgo(new Date(entry.startedAt), locale)}
                    {entry.detail && typeof entry.detail === 'object' && 'skipped' in entry.detail
                      ? ` · ${String((entry.detail as { reason?: string }).reason ?? tc('none'))}`
                      : ''}
                  </span>
                </span>
                <Badge tone={entry.status === 'succeeded' ? 'success' : entry.status === 'failed' ? 'error' : 'neutral'}>
                  <Num value={entry.processed} />
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
