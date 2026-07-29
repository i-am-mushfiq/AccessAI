'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Clock, ShieldCheck, ShieldAlert, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { EligibilityOutcome, VerificationStatus } from '@/lib/domain/enums';

/**
 * Chips, status pills, and badges — BDS §8.3 (pill radius) and §9.7.
 *
 * Pills read as "removable / toggleable", which is why they are reserved for
 * filters and statuses and never used for a CTA (§8.4).
 *
 * Minimum type size is 15 sp (`type-label-md`) — never smaller, even here.
 */

/* ------------------------------------------------------- filter chip */

export function FilterChip({
  label,
  selected,
  onToggle,
  count,
  disabled = false,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onToggle: () => void;
  readonly count?: number;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        // 48 dp target via min-height, even though the pill looks smaller.
        'inline-flex min-h-12 shrink-0 items-center gap-2 rounded-pill px-4',
        'type-label-md transition-colors duration-fast ease-standard',
        'border-[length:var(--bds-border-width-functional)]',
        'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
        selected
          ? 'border-stroke-brand bg-surface-brand-subtle text-text-brand'
          : 'border-stroke bg-surface text-text-primary hover:bg-surface-sunken active:bg-ramp-neutral-100',
        disabled && 'cursor-not-allowed border-stroke-disabled bg-surface-disabled text-text-disabled',
      )}
    >
      {selected ? <CheckCircle2 size={18} className="icon shrink-0" aria-hidden="true" /> : null}
      <span>{label}</span>
      {typeof count === 'number' ? (
        <span className="tabular text-text-secondary" aria-hidden="true">
          {count}
        </span>
      ) : null}
    </button>
  );
}

/* --------------------------------------------------------- static badge */

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-text-secondary',
  brand: 'bg-ramp-green-100 text-text-brand',
  success: 'bg-ramp-success-100 text-text-success',
  warning: 'bg-ramp-warning-100 text-text-warning',
  error: 'bg-ramp-error-100 text-text-error',
  info: 'bg-ramp-info-100 text-text-link',
};

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  readonly children: ReactNode;
  readonly tone?: BadgeTone;
  readonly icon?: ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-3 py-1 type-label-md',
        BADGE_TONES[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/* ---------------------------------------------- eligibility status pill */

const OUTCOME_CONFIG: Record<
  EligibilityOutcome,
  { tone: BadgeTone; Icon: typeof CheckCircle2 }
> = {
  eligible: { tone: 'success', Icon: CheckCircle2 },
  partially_eligible: { tone: 'warning', Icon: AlertTriangle },
  not_eligible: { tone: 'error', Icon: XCircle },
  // "Unknown" gets its own silhouette so it never reads as a soft "no".
  unknown: { tone: 'info', Icon: HelpCircle },
};

export function EligibilityPill({
  outcome,
  label,
  className,
}: {
  readonly outcome: EligibilityOutcome;
  /** Localised word — the pill must never be colour-only. */
  readonly label: string;
  readonly className?: string;
}) {
  const { tone, Icon } = OUTCOME_CONFIG[outcome];
  return (
    <Badge tone={tone} icon={<Icon size={18} className="icon" />} className={className}>
      {label}
    </Badge>
  );
}

/* ------------------------------------------------ verification status */

const VERIFICATION_CONFIG: Record<
  VerificationStatus,
  { tone: BadgeTone; Icon: typeof ShieldCheck }
> = {
  verified: { tone: 'success', Icon: ShieldCheck },
  pending_review: { tone: 'warning', Icon: Clock },
  // A distinct flask icon: this is authored sample data, not a government fact.
  unverified_sample: { tone: 'warning', Icon: FlaskConical },
  outdated: { tone: 'warning', Icon: AlertTriangle },
  disputed: { tone: 'error', Icon: ShieldAlert },
};

/**
 * Surfaces the trust state of a knowledge-base record.
 *
 * This is not decoration. PRD §33 forbids presenting unsupported claims, and
 * the seeded corpus is authored sample data (PRD Part 7 is absent), so every
 * record that has not been human-verified says so wherever it appears.
 */
export function VerificationBadge({
  status,
  label,
  className,
}: {
  readonly status: VerificationStatus;
  readonly label: string;
  readonly className?: string;
}) {
  const { tone, Icon } = VERIFICATION_CONFIG[status];
  return (
    <Badge tone={tone} icon={<Icon size={18} className="icon" />} className={className}>
      {label}
    </Badge>
  );
}

/* ----------------------------------------------------- confidence meter */

/**
 * Confidence is shown as a number AND a word AND a bar — never a bare
 * percentage, which citizens cannot calibrate against anything.
 */
export function ConfidenceMeter({
  value,
  label,
  bandLabel,
  className,
}: {
  readonly value: number;
  readonly label: string;
  readonly bandLabel: string;
  readonly className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tone = clamped >= 80 ? 'success' : clamped >= 55 ? 'warning' : 'error';
  const barColour =
    tone === 'success' ? 'bg-ramp-success-600' : tone === 'warning' ? 'bg-ramp-warning-500' : 'bg-ramp-error-600';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="type-label-md text-text-secondary">{label}</span>
        <span className="type-label-md tabular text-text-primary">
          {clamped}% · {bandLabel}
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${clamped}% — ${bandLabel}`}
        className="h-2 w-full overflow-hidden rounded-xs bg-surface-sunken"
      >
        <div className={cn('h-full rounded-pill transition-all duration-moderate ease-standard', barColour)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
