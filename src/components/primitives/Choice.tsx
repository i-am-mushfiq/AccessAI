'use client';

import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Radio, Checkbox, and Switch rows — BDS §10.2.8
 *
 * The single most valuable micro-decision in the system: THE ENTIRE ROW IS THE
 * TARGET, label included. That drops the required pointing precision to near
 * zero, which matters most for citizens with tremor or large fingers.
 *
 * Checkbox vs Switch is SEMANTIC, not stylistic:
 *   Switch   = takes effect NOW (with instant feedback and undo)
 *   Checkbox = takes effect ON SUBMIT
 * Mixing them breaks the citizen's model of when things happen, so the two
 * components are deliberately not interchangeable props of one control.
 *
 * A selected row is distinguished by fill + border + control state — never by
 * the control state alone.
 */

const ROW_BASE = cn(
  'flex w-full items-start gap-3 rounded-md px-4 py-3 text-start',
  'min-h-14 cursor-pointer transition-colors duration-fast ease-standard',
  'border-[length:var(--bds-border-width-functional)]',
  'focus-within:outline-3 focus-within:outline-stroke-focus focus-within:outline-offset-2',
);

const ROW_UNSELECTED = 'border-stroke bg-surface hover:bg-surface-sunken active:bg-ramp-neutral-100';
const ROW_SELECTED = 'border-stroke-brand bg-surface-brand-subtle';
const ROW_DISABLED = 'cursor-not-allowed border-stroke-disabled bg-surface-disabled';

export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
}

/* --------------------------------------------------------------- radio */

export interface RadioGroupProps<T extends string> {
  readonly name: string;
  readonly legend: string;
  readonly options: readonly ChoiceOption<T>[];
  readonly value: T | undefined;
  readonly onChange: (value: T) => void;
  readonly error?: string;
  readonly helper?: string;
  readonly optionalLabel?: string;
  /** Two options render side-by-side; three or more always stack. */
  readonly columns?: 1 | 2;
  readonly disabled?: boolean;
}

export function RadioGroup<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  helper,
  optionalLabel,
  columns = 1,
  disabled = false,
}: RadioGroupProps<T>) {
  const groupId = useId();

  return (
    <fieldset
      className="min-w-0"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${groupId}-error` : helper ? `${groupId}-helper` : undefined}
    >
      <legend className="type-label-lg mb-3 text-text-primary">
        {legend}
        {optionalLabel ? (
          <span className="type-body-md ms-2 font-normal text-text-secondary">{optionalLabel}</span>
        ) : null}
      </legend>

      <div className={cn('grid gap-3', columns === 2 && options.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
        {options.map((option) => {
          const selected = value === option.value;
          const optionDisabled = disabled || option.disabled === true;
          return (
            <label
              key={option.value}
              className={cn(
                ROW_BASE,
                optionDisabled ? ROW_DISABLED : selected ? ROW_SELECTED : ROW_UNSELECTED,
                'items-center',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={optionDisabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border-2',
                  selected ? 'border-ramp-green-600' : 'border-stroke',
                  optionDisabled && 'border-stroke-disabled',
                )}
              >
                {selected ? <span className="h-3 w-3 rounded-pill bg-ramp-green-600" /> : null}
              </span>

              {option.icon ? (
                <span aria-hidden="true" className="shrink-0 text-text-secondary">
                  {option.icon}
                </span>
              ) : null}

              <span className="min-w-0 flex-1">
                <span className={cn('type-body-lg block', optionDisabled ? 'text-text-disabled' : 'text-text-primary')}>
                  {option.label}
                </span>
                {option.description ? (
                  <span className="type-body-md block text-text-secondary">{option.description}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      <div className="min-h-6 pt-2">
        {error ? (
          <p id={`${groupId}-error`} className="type-body-md font-semibold text-text-error">
            {error}
          </p>
        ) : helper ? (
          <p id={`${groupId}-helper`} className="type-body-md text-text-secondary">
            {helper}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------ checkbox */

export interface CheckboxRowProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  readonly description?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  /** Consent boxes are NEVER pre-checked (§10.2.8). */
  readonly name?: string;
}

export function CheckboxRow({
  checked,
  onChange,
  label,
  description,
  error,
  disabled = false,
  name,
}: CheckboxRowProps) {
  const id = useId();
  return (
    <div>
      <label
        className={cn(ROW_BASE, disabled ? ROW_DISABLED : checked ? ROW_SELECTED : ROW_UNSELECTED)}
        htmlFor={id}
      >
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border-2',
            checked ? 'border-ramp-green-600 bg-ramp-green-600' : 'border-stroke bg-surface',
            disabled && 'border-stroke-disabled bg-surface-disabled',
          )}
        >
          {checked ? <Check size={18} strokeWidth={3} className="text-text-on-brand" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('type-body-lg block', disabled ? 'text-text-disabled' : 'text-text-primary')}>
            {label}
          </span>
          {description ? <span className="type-body-md block text-text-secondary">{description}</span> : null}
        </span>
      </label>
      <div className="min-h-6 pt-1">
        {error ? (
          <p id={`${id}-error`} className="type-body-md font-semibold text-text-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- switch */

export interface SwitchRowProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  readonly description?: string;
  /** MANDATORY text state beside the switch (§10.2.8) — e.g. "চালু" / "বন্ধ". */
  readonly onText: string;
  readonly offText: string;
  readonly disabled?: boolean;
  /** True while a network call is in flight; reverts visibly on failure. */
  readonly pending?: boolean;
}

export function SwitchRow({
  checked,
  onChange,
  label,
  description,
  onText,
  offText,
  disabled = false,
  pending = false,
}: SwitchRowProps) {
  const id = useId();
  return (
    <div
      className={cn(
        'flex min-h-14 items-center gap-4 rounded-md px-4 py-3',
        'transition-colors duration-fast ease-standard',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-surface-sunken',
      )}
      onClick={() => {
        if (!disabled && !pending) onChange(!checked);
      }}
    >
      <span className="min-w-0 flex-1">
        <label htmlFor={id} className={cn('type-body-lg block', disabled ? 'text-text-disabled' : 'text-text-primary')}>
          {label}
        </label>
        {description ? <span className="type-body-md block text-text-secondary">{description}</span> : null}
      </span>

      {/* The word carries the state; the switch position reinforces it. */}
      <span
        className={cn('type-label-md shrink-0 tabular', checked ? 'text-text-success' : 'text-text-secondary')}
        aria-hidden="true"
      >
        {checked ? onText : offText}
      </span>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled || pending}
        onClick={(e) => {
          e.stopPropagation();
          if (!pending) onChange(!checked);
        }}
        className={cn(
          'relative h-8 w-13 shrink-0 rounded-pill transition-colors duration-fast ease-standard',
          'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
          checked ? 'bg-ramp-green-600' : 'bg-ramp-neutral-400',
          (disabled || pending) && 'cursor-not-allowed opacity-60',
        )}
        style={{ width: 52 }}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1 h-6 w-6 rounded-pill bg-white shadow-elev-1 transition-transform duration-fast ease-standard',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}
