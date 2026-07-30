'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Check, Clock, ChevronDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Chip';
import { useToast } from '@/components/providers/ToastProvider';
import { useVoiceActions } from '@/components/providers/VoiceProvider';
import { formatRelativeDay, formatDate } from '@/lib/format/dates';
import { Num } from '@/components/primitives/Money';
import type { TaskStatus, TaskPriority } from '@/lib/domain/enums';

/**
 * Action plans — PRD §Feature 7 and §64.
 *
 * Tasks are grouped by day and completing one is a single tap on a 56 dp row.
 * The whole row toggles, not a small checkbox, per BDS §10.2.8 — the precision
 * required to hit a 24 dp box is exactly what fails for older citizens.
 *
 * Progress is stated as a fraction AND a bar, because a bar alone cannot be read
 * aloud usefully and a percentage alone hides how much is actually left.
 */

export interface PlanTask {
  readonly id: string;
  readonly title: string;
  readonly titleBn: string;
  readonly description: string | null;
  readonly descriptionBn: string | null;
  readonly dueDate: string | null;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly estimatedMinutes: number | null;
  readonly notes: string | null;
}

export interface Plan {
  readonly id: string;
  readonly title: string;
  readonly titleBn: string;
  readonly status: string;
  readonly opportunitySlug: string;
  readonly tasks: readonly PlanTask[];
}

export function ActionPlanList({ plans }: { readonly plans: readonly Plan[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {plans.map((plan) => (
        <li key={plan.id}>
          <PlanCard plan={plan} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Resolves "কাজটা শেষ" to a specific task.
 *
 * Marking work done by voice needs a target, and the only defensible one is the
 * NEXT outstanding task — the one the citizen is looking at. Guessing among
 * several would silently tick off the wrong step, and the tracker is the record
 * they rely on when they get to the office. If nothing is outstanding, the
 * command reports that instead of doing nothing.
 */
function nextPendingTask(tasks: readonly PlanTask[]): PlanTask | null {
  return tasks.find((task) => task.status !== 'done' && task.status !== 'skipped') ?? null;
}

function PlanCard({ plan }: { readonly plan: Plan }) {
  const t = useTranslations('plan');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as 'bn' | 'en';
  const toast = useToast();

  const [tasks, setTasks] = useState<PlanTask[]>([...plan.tasks]);
  const [expanded, setExpanded] = useState(true);

  const done = tasks.filter((task) => task.status === 'done').length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  const toggle = useMutation({
    mutationFn: (input: { taskId: string; status: TaskStatus }) =>
      api.patch(`/action-plans/tasks/${input.taskId}`, { status: input.status }),
    onMutate: (input) => {
      const previous = tasks.find((task) => task.id === input.taskId)?.status;
      setTasks((current) =>
        current.map((task) => (task.id === input.taskId ? { ...task, status: input.status } : task)),
      );
      return { previous };
    },
    onError: (error, input, context) => {
      if (context?.previous) {
        setTasks((current) =>
          current.map((task) => (task.id === input.taskId ? { ...task, status: context.previous! } : task)),
        );
      }
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
    },
    onSuccess: (_data, input) => {
      if (input.status === 'done' && done + 1 === total) {
        toast.show({ tone: 'success', message: t('allDone') });
      }
    },
  });

  useVoiceActions({
    'action.taskDone': () => {
      const target = nextPendingTask(tasks);
      if (!target) {
        toast.show({ tone: 'info', message: t('allDone') });
        return;
      }
      toggle.mutate({ taskId: target.id, status: 'done' });
      // Say WHICH task was ticked. Without it a citizen who cannot read the list
      // has no way to know whether the right one moved.
      toast.show({
        tone: 'success',
        message: locale === 'bn' ? target.titleBn : target.title,
      });
    },
  });

  const priorityLabels: Record<TaskPriority, string> = {
    high: t('priorityHigh'),
    medium: t('priorityMedium'),
    low: t('priorityLow'),
  };

  return (
    <Card padding="default" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="type-heading-sm text-text-primary">
            <Link
              href={`/opportunities/${plan.opportunitySlug}`}
              className="hover:text-text-brand focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
            >
              {locale === 'bn' ? plan.titleBn : plan.title}
            </Link>
          </h3>
          <p className="type-body-md mt-1 tabular text-text-secondary">
            {t('progressLabel', { done, total })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? tc('close') : tc('viewDetails')}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill text-text-secondary hover:bg-surface-sunken focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
        >
          <ChevronDown
            size={24}
            className={cn('icon transition-transform duration-fast', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('progressLabel', { done, total })}
        className="h-2 w-full overflow-hidden rounded-xs bg-surface-sunken"
      >
        <div
          className="h-full rounded-pill bg-ramp-success-600 transition-all duration-moderate ease-standard"
          style={{ width: `${percent}%` }}
        />
      </div>

      {plan.status === 'completed' ? (
        <p className="type-body-lg rounded-md bg-surface-success px-3 py-2 text-text-success">{t('allDone')}</p>
      ) : null}

      {expanded ? (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => {
            const isDone = task.status === 'done';
            const due = task.dueDate ? new Date(task.dueDate) : null;
            return (
              <li key={task.id}>
                {/* Whole row is the target. */}
                <button
                  type="button"
                  onClick={() => toggle.mutate({ taskId: task.id, status: isDone ? 'pending' : 'done' })}
                  aria-pressed={isDone}
                  className={cn(
                    'flex min-h-16 w-full items-start gap-3 rounded-md px-4 py-3 text-start',
                    'border-[length:var(--bds-border-width-functional)] transition-colors duration-fast',
                    'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
                    isDone
                      ? 'border-stroke-success bg-surface-success'
                      : 'border-stroke bg-surface hover:bg-surface-sunken',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border-2',
                      isDone ? 'border-ramp-success-600 bg-ramp-success-600' : 'border-stroke bg-surface',
                    )}
                  >
                    {isDone ? <Check size={18} strokeWidth={3} className="text-white" /> : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'type-body-lg block',
                        isDone ? 'text-text-secondary line-through' : 'text-text-primary',
                      )}
                    >
                      {locale === 'bn' ? task.titleBn : task.title}
                    </span>
                    {task.description || task.descriptionBn ? (
                      <span className="type-body-md block text-text-secondary">
                        {locale === 'bn' ? task.descriptionBn : task.description}
                      </span>
                    ) : null}
                    {task.notes ? (
                      <span className="type-body-md mt-1 block rounded-md bg-surface-warning px-2 py-1 text-text-warning">
                        {task.notes}
                      </span>
                    ) : null}

                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      {due ? (
                        <Badge tone="neutral">
                          {formatRelativeDay(due, locale)} · {formatDate(due, locale, { style: 'short' })}
                        </Badge>
                      ) : null}
                      {task.priority === 'high' && !isDone ? (
                        <Badge tone="warning">{priorityLabels.high}</Badge>
                      ) : null}
                      {task.estimatedMinutes ? (
                        <span className="type-caption flex items-center gap-1 tabular text-text-secondary">
                          <Clock size={14} className="icon" aria-hidden="true" />
                          {t('estimatedTime')} <Num value={task.estimatedMinutes} /> {t('minutes')}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
