'use client';

import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { controlSurfaceClasses } from './FieldShell';
import { monthName } from '@/lib/format/dates';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { localiseDigits } from '@/lib/format/numerals';

/**
 * Date of birth — BDS §10.2.7
 *
 * THREE SEPARATE FIELDS: day / month / year. Not a calendar.
 *
 * This is the most common date-picker error in the industry: a month-grid
 * calendar requires roughly 40 back-taps to reach 1975. Calendars are for
 * NEARBY dates; a birth date is not nearby.
 *
 * The derived age is echoed back for confirmation, which catches year typos
 * that are otherwise invisible — entering 2005 instead of 1955 looks perfectly
 * plausible in three separate boxes until you see "age 21".
 */

export interface DateOfBirthValue {
  readonly day: number | null;
  readonly month: number | null; // 0-indexed
  readonly year: number | null;
}

export const EMPTY_DOB: DateOfBirthValue = { day: null, month: null, year: null };

export function toDate(value: DateOfBirthValue): Date | null {
  if (value.day === null || value.month === null || value.year === null) return null;
  const date = new Date(value.year, value.month, value.day);
  // Rejects 31 February and similar: the Date constructor rolls over, so the
  // round-trip check is the validation.
  if (date.getDate() !== value.day || date.getMonth() !== value.month || date.getFullYear() !== value.year) {
    return null;
  }
  return date;
}

export function ageFrom(value: DateOfBirthValue, now = new Date()): number | null {
  const date = toDate(value);
  if (!date) return null;
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

export function DateOfBirthField({
  label,
  value,
  onChange,
  error,
  helper,
  optionalLabel,
  ageConfirmationLabel,
  dayLabel,
  monthLabel,
  yearLabel,
  minYear,
  maxYear,
}: {
  readonly label: string;
  readonly value: DateOfBirthValue;
  readonly onChange: (value: DateOfBirthValue) => void;
  readonly error?: string;
  readonly helper?: string;
  readonly optionalLabel?: string;
  /** e.g. "আপনার বয়স {age} বছর — ঠিক আছে?" with `{age}` substituted. */
  readonly ageConfirmationLabel: (age: number) => string;
  readonly dayLabel: string;
  readonly monthLabel: string;
  readonly yearLabel: string;
  readonly minYear?: number;
  readonly maxYear?: number;
}) {
  const groupId = useId();
  const { locale, numerals } = usePreferences();
  const currentYear = new Date().getFullYear();

  // Years descend from the present: an older citizen reaches their birth year
  // sooner, and nobody is born in the future.
  const years = useMemo(() => {
    const top = maxYear ?? currentYear;
    const bottom = minYear ?? currentYear - 110;
    return Array.from({ length: top - bottom + 1 }, (_, i) => top - i);
  }, [currentYear, maxYear, minYear]);

  const daysInMonth = useMemo(() => {
    if (value.month === null) return 31;
    const year = value.year ?? 2024; // a leap year, so 29 Feb stays selectable
    return new Date(year, value.month + 1, 0).getDate();
  }, [value.month, value.year]);

  const age = ageFrom(value);
  const selectClasses = cn(controlSurfaceClasses({ error: Boolean(error) }), 'min-h-14 px-3 type-body-lg');

  return (
    <fieldset aria-describedby={error ? `${groupId}-error` : helper ? `${groupId}-helper` : undefined}>
      <legend className="type-label-lg mb-3 text-text-primary">
        {label}
        {optionalLabel ? (
          <span className="type-body-md ms-2 font-normal text-text-secondary">{optionalLabel}</span>
        ) : null}
      </legend>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="type-body-md text-text-secondary">{dayLabel}</span>
          <select
            value={value.day ?? ''}
            onChange={(e) => onChange({ ...value, day: e.target.value ? Number(e.target.value) : null })}
            className={selectClasses}
            aria-invalid={error ? true : undefined}
          >
            <option value="">—</option>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {localiseDigits(String(d), numerals)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="type-body-md text-text-secondary">{monthLabel}</span>
          <select
            value={value.month ?? ''}
            onChange={(e) => onChange({ ...value, month: e.target.value !== '' ? Number(e.target.value) : null })}
            className={selectClasses}
            aria-invalid={error ? true : undefined}
          >
            <option value="">—</option>
            {Array.from({ length: 12 }, (_, i) => i).map((m) => (
              <option key={m} value={m}>
                {monthName(m, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="type-body-md text-text-secondary">{yearLabel}</span>
          <select
            value={value.year ?? ''}
            onChange={(e) => onChange({ ...value, year: e.target.value ? Number(e.target.value) : null })}
            className={selectClasses}
            aria-invalid={error ? true : undefined}
          >
            <option value="">—</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {localiseDigits(String(y), numerals)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="min-h-6 pt-2">
        {error ? (
          <p id={`${groupId}-error`} className="type-body-md font-semibold text-text-error">
            {error}
          </p>
        ) : age !== null ? (
          // The age echo is the whole point of this component.
          <p className="type-body-md text-text-primary" aria-live="polite">
            {ageConfirmationLabel(age)}
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
