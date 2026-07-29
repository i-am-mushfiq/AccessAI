'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * The label / control / helper scaffold shared by every form control.
 *
 * Two rules from BDS §10.2.1 are structural here rather than a convention:
 *
 *  1. The label is ALWAYS above and ALWAYS visible. Placeholder-as-label
 *     destroys the label the moment typing starts, forcing recall, and fails at
 *     3.2:1 placeholder contrast. There is no `floatingLabel` option.
 *
 *  2. The helper slot is ALWAYS RENDERED — even when empty — with its height
 *     reserved. An error appearing must not shift the layout, because shift
 *     causes mis-taps and forces the citizen to re-read the screen.
 *
 * Required fields are unmarked; only OPTIONAL fields carry a marker, because
 * marking the exception is shorter than marking the rule, and an asterisk is
 * not self-explanatory.
 */

export interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  /** Rendered as "(না দিলেও চলবে)" style text, supplied by the caller's locale. */
  readonly optionalLabel?: string;
  readonly helper?: ReactNode;
  readonly error?: string;
  readonly success?: string;
  /** Explains WHY a non-obvious field is needed, before it is asked (§10.2.1). */
  readonly reason?: string;
  readonly children: ReactNode;
  readonly className?: string;
  /** Rendered to the right of the label, e.g. a character counter. */
  readonly labelAdornment?: ReactNode;
}

export function FieldShell({
  id,
  label,
  optionalLabel,
  helper,
  error,
  success,
  reason,
  children,
  className,
  labelAdornment,
}: FieldShellProps) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="type-label-lg text-text-primary">
          {label}
          {optionalLabel ? (
            <span className="type-body-md ms-2 font-normal text-text-secondary">{optionalLabel}</span>
          ) : null}
        </label>
        {labelAdornment}
      </div>

      {reason ? (
        <p className="type-body-md text-text-secondary">{reason}</p>
      ) : null}

      {children}

      {/* Reserved slot. min-h keeps the vertical rhythm stable whether or not a
          message is present, so validation never moves the submit button. */}
      <div className="min-h-6">
        {error ? (
          <p id={errorId} className="type-body-md flex items-start gap-2 font-semibold text-text-error">
            <AlertCircle size={20} className="icon mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : success ? (
          <p className="type-body-md flex items-start gap-2 text-text-success">
            <CheckCircle2 size={20} className="icon mt-0.5 shrink-0" aria-hidden="true" />
            <span>{success}</span>
          </p>
        ) : helper ? (
          <p id={helperId} className="type-body-md text-text-secondary">
            {helper}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Shared ids so controls can wire `aria-describedby` consistently. */
export function fieldDescribedBy(id: string, hasError: boolean, hasHelper: boolean): string | undefined {
  const parts: string[] = [];
  if (hasError) parts.push(`${id}-error`);
  else if (hasHelper) parts.push(`${id}-helper`);
  return parts.length ? parts.join(' ') : undefined;
}

/** Border + fill treatment shared by inputs, selects, and textareas. */
export function controlSurfaceClasses(state: { error?: boolean; success?: boolean; disabled?: boolean }): string {
  return cn(
    'w-full rounded-md bg-surface text-text-primary',
    // Every input carries a VISIBLE functional border. Underline-only and
    // borderless "filled" fields fail in sunlight, on scratched screen
    // protectors, and for anyone who does not yet recognise a field by shape.
    'border-[length:var(--bds-border-width-functional)] border-stroke',
    'placeholder:text-text-placeholder',
    'transition-colors duration-fast ease-standard',
    'focus:border-2 focus:border-stroke-focus focus:outline-none',
    'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
    state.error && 'border-stroke-error',
    state.success && 'border-stroke-success',
    state.disabled && 'bg-surface-disabled text-text-disabled border-stroke-disabled cursor-not-allowed',
  );
}
