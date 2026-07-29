'use client';

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { FieldShell, controlSurfaceClasses, fieldDescribedBy } from './FieldShell';
import { toLatinDigits } from '@/lib/format/numerals';

/**
 * TextField — BDS §10.2.2
 *
 * Behaviours that are policy, not preference:
 *  • Validation fires on BLUR, never per keystroke. Per-keystroke validation
 *    shows an error on the first character of every field, which reads as
 *    constant failure. Live FORMATTING (grouping, masks) is still fine.
 *  • The value is NEVER cleared on error — re-entry is the top abandonment
 *    trigger.
 *  • Paste and autofill are always permitted (WCAG 2.2 §3.3.8).
 *  • Numeric modes accept Bangla digits and normalise silently.
 */

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'children'> {
  readonly label: string;
  readonly optionalLabel?: string;
  readonly helper?: ReactNode;
  readonly error?: string;
  readonly success?: string;
  readonly reason?: string;
  readonly leadingIcon?: ReactNode;
  readonly trailingSlot?: ReactNode;
  /** Static, non-editable prefix such as `৳` or `+৮৮০`. */
  readonly prefix?: string;
  readonly clearable?: boolean;
  readonly onClear?: () => void;
  readonly clearLabel?: string;
  /** 64 dp instead of 56 dp — first-run and eKYC flows (§10.2.2). */
  readonly emphasis?: boolean;
  /** Normalise Bengali digits to Latin on change. */
  readonly normaliseDigits?: boolean;
  readonly containerClassName?: string;
  readonly maxLengthCounterFrom?: number;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    optionalLabel,
    helper,
    error,
    success,
    reason,
    leadingIcon,
    trailingSlot,
    prefix,
    clearable = false,
    onClear,
    clearLabel = 'লেখা মুছুন',
    emphasis = false,
    normaliseDigits = false,
    containerClassName,
    maxLength,
    maxLengthCounterFrom = 0.8,
    id: providedId,
    value,
    onChange,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const [internalValue, setInternalValue] = useState('');
  const currentValue = value !== undefined ? String(value) : internalValue;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (normaliseDigits) {
      const normalised = toLatinDigits(event.target.value);
      if (normalised !== event.target.value) {
        event.target.value = normalised;
      }
    }
    if (value === undefined) setInternalValue(event.target.value);
    onChange?.(event);
  };

  // Counter appears only from 80% of the limit, and never as the only cue.
  const showCounter =
    typeof maxLength === 'number' && currentValue.length >= Math.floor(maxLength * maxLengthCounterFrom);

  const hasClear = clearable && currentValue.length > 0;

  return (
    <FieldShell
      id={id}
      label={label}
      optionalLabel={optionalLabel}
      helper={helper}
      error={error}
      success={success}
      reason={reason}
      className={containerClassName}
      labelAdornment={
        showCounter ? (
          <span className="type-caption tabular text-text-secondary" aria-hidden="true">
            {currentValue.length}/{maxLength}
          </span>
        ) : null
      }
    >
      <div className="relative flex items-stretch">
        {leadingIcon ? (
          <span
            className="pointer-events-none absolute inset-y-0 start-0 flex w-12 items-center justify-center text-text-secondary"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        ) : null}

        {prefix ? (
          <span
            className={cn(
              'pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 type-body-lg text-text-primary',
              emphasis && 'type-display-sm',
            )}
            aria-hidden="true"
          >
            {prefix}
          </span>
        ) : null}

        <input
          {...rest}
          ref={ref}
          id={id}
          value={value}
          onChange={handleChange}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(id, Boolean(error), Boolean(helper))}
          className={cn(
            controlSurfaceClasses({ error: Boolean(error), success: Boolean(success), disabled: rest.disabled }),
            'type-body-lg px-4 py-3.5',
            emphasis ? 'min-h-16' : 'min-h-14',
            leadingIcon && 'ps-12',
            prefix && (emphasis ? 'ps-10' : 'ps-9'),
            (hasClear || error || trailingSlot) && 'pe-14',
          )}
        />

        {/* Error icon inside the trailing slot — one of four redundant cues
            (border, icon, bold red text, live announcement). */}
        {error && !hasClear && !trailingSlot ? (
          <span
            className="pointer-events-none absolute inset-y-0 end-0 flex w-12 items-center justify-center text-text-error"
            aria-hidden="true"
          >
            <AlertCircle size={20} className="icon" />
          </span>
        ) : null}

        {hasClear ? (
          <button
            type="button"
            onClick={() => {
              if (value === undefined) setInternalValue('');
              onClear?.();
            }}
            aria-label={clearLabel}
            className={cn(
              'absolute inset-y-0 end-0 my-auto flex h-12 w-12 items-center justify-center rounded-pill',
              'text-text-secondary hover:bg-surface-sunken active:bg-ramp-neutral-200',
              'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
            )}
          >
            <X size={20} className="icon" aria-hidden="true" />
          </button>
        ) : null}

        {trailingSlot ? (
          <span className="absolute inset-y-0 end-0 flex items-center pe-1">{trailingSlot}</span>
        ) : null}
      </div>

      {/* Errors are announced politely so a screen-reader user is not
          interrupted mid-word, but still learns WHY the field is invalid. */}
      <span aria-live="polite" className="sr-only">
        {error ?? ''}
      </span>
    </FieldShell>
  );
});
