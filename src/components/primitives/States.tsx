'use client';

import type { ReactNode } from 'react';
import { RefreshCw, Flag, Inbox, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from './Button';
import { Spinner } from './Spinner';

/**
 * Loading, empty, and error states — BDS §73, §74, §75.
 *
 * "No blank pages." Every async operation renders a skeleton or a worded
 * loader; every empty list explains what to do next; every error offers an
 * ACTION rather than only an apology.
 */

/* ------------------------------------------------------------ skeleton */

export function Skeleton({ className }: { readonly className?: string }) {
  return <span aria-hidden="true" className={cn('skeleton block rounded-md', className)} />;
}

/** Card-shaped placeholder used while opportunity lists load. */
export function SkeletonCard() {
  return (
    <div
      data-elevated=""
      className="rounded-lg border border-stroke-subtle bg-surface p-5 shadow-elev-1"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-7 w-20 rounded-pill" />
      </div>
      <Skeleton className="mt-3 h-5 w-full" />
      <Skeleton className="mt-2 h-5 w-4/5" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 w-12 rounded-pill" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { readonly count?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * Worded loader. A spinner alone leaves the citizen unsure whether their tap
 * registered, so the sentence is required, not optional.
 */
export function LoadingState({
  message,
  reassurance,
  className,
}: {
  readonly message: string;
  /** Shown after ~8 s of waiting (BDS §10.1.5 escalation). */
  readonly reassurance?: string;
  readonly className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center gap-3 px-4 py-12 text-center', className)}
    >
      <Spinner size={32} className="text-ramp-green-600" />
      <p className="type-body-lg text-text-primary">{message}</p>
      {reassurance ? <p className="type-body-md text-text-secondary measure">{reassurance}</p> : null}
    </div>
  );
}

/* --------------------------------------------------------- empty state */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly icon?: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-4 px-4 py-12 text-center', className)}>
      <span aria-hidden="true" className="text-ramp-neutral-400">
        {icon ?? <Inbox size={64} className="icon" strokeWidth={1.5} />}
      </span>
      <div>
        <p className="type-heading-sm text-text-primary">{title}</p>
        {description ? <p className="type-body-lg mt-2 text-text-secondary measure">{description}</p> : null}
      </div>
      {/* Never a dead end: an empty state always offers the next step. */}
      {action ? <div className="w-full max-w-form">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------- error state */

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  onReport,
  reportLabel,
  offline = false,
  className,
}: {
  readonly title: string;
  readonly description?: string;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly onReport?: () => void;
  readonly reportLabel?: string;
  readonly offline?: boolean;
  readonly className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-4 px-4 py-12 text-center', className)}
    >
      <span aria-hidden="true" className="text-ramp-error-500">
        {offline ? <WifiOff size={64} className="icon" strokeWidth={1.5} /> : <Flag size={64} className="icon" strokeWidth={1.5} />}
      </span>
      <div>
        <p className="type-heading-sm text-text-primary">{title}</p>
        {description ? <p className="type-body-lg mt-2 text-text-secondary measure">{description}</p> : null}
      </div>
      <div className="flex w-full max-w-form flex-col gap-3">
        {onRetry && retryLabel ? (
          <Button onClick={onRetry} leadingIcon={<RefreshCw size={20} className="icon" />}>
            {retryLabel}
          </Button>
        ) : null}
        {onReport && reportLabel ? (
          <Button variant="tertiary" onClick={onReport}>
            {reportLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ progress steps */

/**
 * Numbered circles, never abstract dots — BDS §9.5 maps this directly onto the
 * USSD numbered-menu mental model citizens already have.
 */
export function ProgressSteps({
  current,
  total,
  label,
  stepLabels,
  className,
}: {
  readonly current: number;
  readonly total: number;
  /** e.g. "ধাপ ২ / ৪" — always visible, never implied by the dots alone. */
  readonly label: string;
  readonly stepLabels?: readonly string[];
  readonly className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="type-label-md tabular text-text-secondary">{label}</p>
      <ol className="flex items-center gap-2" role="list">
        {Array.from({ length: total }, (_, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          return (
            <li key={step} className="flex flex-1 items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-pill type-label-md tabular',
                  done && 'bg-ramp-green-600 text-text-on-brand',
                  active && 'bg-ramp-green-600 text-text-on-brand ring-2 ring-ramp-green-300',
                  !done && !active && 'border-1.5 border-stroke bg-surface text-text-secondary',
                )}
              >
                {step}
              </span>
              {step < total ? (
                <span
                  aria-hidden="true"
                  className={cn('h-0.5 flex-1 rounded-pill', done ? 'bg-ramp-green-600' : 'bg-stroke-subtle')}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {stepLabels?.[current - 1] ? (
        <p className="type-body-md text-text-secondary">{stepLabels[current - 1]}</p>
      ) : null}
    </div>
  );
}
