'use client';

import { forwardRef, useId, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { FieldShell, controlSurfaceClasses, fieldDescribedBy } from './FieldShell';

/**
 * Textarea — BDS §10.2.9
 *
 * "Prefer not to use it." Free-text entry in Bangla on a phone keyboard is slow
 * and error-prone, and many citizens are far more comfortable with recognition
 * than composition. Wherever the data can be enumerated, use selectable chips
 * instead (see `ChipPicker` below).
 *
 * Where a textarea is unavoidable, voice input is offered — the strongest
 * single accommodation for citizens with limited literacy.
 */

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  readonly label: string;
  readonly optionalLabel?: string;
  readonly helper?: ReactNode;
  readonly error?: string;
  readonly reason?: string;
  readonly voiceSlot?: ReactNode;
  readonly containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, optionalLabel, helper, error, reason, voiceSlot, containerClassName, rows = 3, maxLength, value, id: providedId, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const length = typeof value === 'string' ? value.length : 0;
  const showCounter = typeof maxLength === 'number' && length >= Math.floor(maxLength * 0.8);

  return (
    <FieldShell
      id={id}
      label={label}
      optionalLabel={optionalLabel}
      helper={helper}
      error={error}
      reason={reason}
      className={containerClassName}
      labelAdornment={
        showCounter ? (
          <span className="type-caption tabular text-text-secondary" aria-hidden="true">
            {length}/{maxLength}
          </span>
        ) : null
      }
    >
      <div className="relative">
        <textarea
          {...rest}
          ref={ref}
          id={id}
          rows={rows}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldDescribedBy(id, Boolean(error), Boolean(helper))}
          className={cn(
            controlSurfaceClasses({ error: Boolean(error), disabled: rest.disabled }),
            'type-body-lg min-h-24 resize-y px-4 py-3',
            voiceSlot && 'pe-16',
          )}
        />
        {voiceSlot ? <span className="absolute end-2 top-2">{voiceSlot}</span> : null}
      </div>
    </FieldShell>
  );
});

/**
 * The preferred alternative to free text: pick from enumerated options.
 * Multi-select chips with a 48 dp target each.
 */
export function ChipPicker<T extends string>({
  label,
  options,
  selected,
  onChange,
  helper,
  optionalLabel,
  max,
}: {
  readonly label: string;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly selected: readonly T[];
  readonly onChange: (values: T[]) => void;
  readonly helper?: string;
  readonly optionalLabel?: string;
  readonly max?: number;
}) {
  const groupId = useId();
  const atLimit = typeof max === 'number' && selected.length >= max;

  return (
    <fieldset>
      <legend className="type-label-lg mb-3 text-text-primary">
        {label}
        {optionalLabel ? (
          <span className="type-body-md ms-2 font-normal text-text-secondary">{optionalLabel}</span>
        ) : null}
      </legend>
      <div className="flex flex-wrap gap-2" id={groupId}>
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          const disabled = !isSelected && atLimit;
          return (
            <button
              key={option.value}
              type="button"
              role="switch"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() =>
                onChange(
                  isSelected ? selected.filter((v) => v !== option.value) : [...selected, option.value],
                )
              }
              className={cn(
                'inline-flex min-h-12 items-center rounded-pill px-4 type-label-md',
                'border-[length:var(--bds-border-width-functional)] transition-colors duration-fast ease-standard',
                'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
                isSelected
                  ? 'border-stroke-brand bg-surface-brand-subtle text-text-brand'
                  : 'border-stroke bg-surface text-text-primary hover:bg-surface-sunken',
                disabled && 'cursor-not-allowed border-stroke-disabled text-text-disabled',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-6 pt-2">
        {helper ? <p className="type-body-md text-text-secondary">{helper}</p> : null}
      </div>
    </fieldset>
  );
}
