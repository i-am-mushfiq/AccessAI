'use client';

import { useMemo, useState, useId } from 'react';
import { ChevronDown, Check, Search, Phone } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Sheet } from './Sheet';
import { FieldShell, controlSurfaceClasses } from './FieldShell';
import { RadioGroup } from './Choice';
import { toLatinDigits } from '@/lib/format/numerals';

/**
 * Select — BDS §10.2.6
 *
 * The pattern is chosen BY OPTION COUNT, and that is a rule rather than a
 * preference, so this component decides it rather than the caller:
 *
 *   2       → two radio rows (both choices visible, zero interaction to find)
 *   3–5     → visible radio list, NO dropdown (a closed dropdown hides the
 *             entire choice set from someone who does not know it opens)
 *   6–15    → bottom sheet, 56 dp rows, tick on the selected item
 *   16+     → searchable bottom sheet with pinned popular items first
 *
 * The native `<select>` is never used above 6 options: the OEM-rendered
 * Android picker is inconsistent, small-targeted, and unstyleable.
 */

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Extra search surfaces: Bangla name, Banglish spellings, synonyms. */
  readonly keywords?: readonly string[];
  readonly description?: string;
  readonly disabled?: boolean;
  /** Pinned to the top of a searchable list. */
  readonly popular?: boolean;
}

export interface SelectProps<T extends string> {
  readonly label: string;
  readonly options: readonly SelectOption<T>[];
  readonly value: T | undefined;
  readonly onChange: (value: T) => void;
  readonly placeholder: string;
  readonly error?: string;
  readonly helper?: string;
  readonly reason?: string;
  readonly optionalLabel?: string;
  readonly disabled?: boolean;
  readonly name?: string;
  readonly containerClassName?: string;
  /** Sheet-mode copy. */
  readonly searchPlaceholder?: string;
  readonly noResultsText?: string;
  readonly helpCtaText?: string;
  readonly popularHeading?: string;
  readonly allHeading?: string;
}

export function Select<T extends string>(props: SelectProps<T>) {
  const { options } = props;

  // 2–5 options are always fully visible. No dropdown, no sheet.
  if (options.length <= 5) {
    return (
      <div className={props.containerClassName}>
      <RadioGroup
        name={props.name ?? props.label}
        legend={props.label}
        options={options.map((o) => ({
          value: o.value,
          label: o.label,
          description: o.description,
          disabled: o.disabled,
        }))}
        value={props.value}
        onChange={props.onChange}
        error={props.error}
        helper={props.helper}
        optionalLabel={props.optionalLabel}
        columns={options.length === 2 ? 2 : 1}
        disabled={props.disabled}
      />
      </div>
    );
  }

  return <SheetSelect {...props} searchable={options.length >= 16} />;
}

function SheetSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
  helper,
  reason,
  optionalLabel,
  disabled = false,
  containerClassName,
  searchable,
  searchPlaceholder = 'খুঁজুন',
  noResultsText = 'কিছু পাওয়া যায়নি',
  helpCtaText,
  popularHeading,
  allHeading,
}: SelectProps<T> & { readonly searchable: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  const { popular, filtered, isSearching } = useMemo(() => {
    const raw = query.trim().toLowerCase();
    const needle = toLatinDigits(raw);
    if (!needle) {
      return {
        popular: options.filter((o) => o.popular),
        filtered: options,
        isSearching: false,
      };
    }
    const matches = options.filter((o) => {
      const haystack = [o.label, ...(o.keywords ?? [])].join(' ').toLowerCase();
      return haystack.includes(needle) || haystack.includes(raw);
    });
    return { popular: [], filtered: matches, isSearching: true };
  }, [options, query]);

  // Never a bare "no results": offer the nearest alphabetical neighbours so the
  // citizen always has something to act on.
  const fallbackSuggestions = useMemo(() => {
    if (!isSearching || filtered.length > 0) return [];
    const needle = query.trim().toLowerCase().slice(0, 2);
    if (!needle) return [];
    return options.filter((o) => o.label.toLowerCase().startsWith(needle[0]!)).slice(0, 5);
  }, [filtered.length, isSearching, options, query]);

  return (
    <>
      <FieldShell
        id={id}
        label={label}
        optionalLabel={optionalLabel}
        helper={helper}
        error={error}
        reason={reason}
        className={containerClassName}
      >
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          className={cn(
            controlSurfaceClasses({ error: Boolean(error), disabled }),
            'flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-start',
            'hover:bg-surface-sunken active:bg-ramp-neutral-100',
          )}
        >
          {/* Once chosen, the trigger shows the VALUE, not a placeholder. */}
          <span className={cn('type-body-lg min-w-0 flex-1', selected ? 'text-text-primary' : 'text-text-placeholder')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={20} className="icon shrink-0 text-text-secondary" aria-hidden="true" />
        </button>
      </FieldShell>

      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        {searchable ? (
          <div className="sticky -top-4 z-raised -mx-5 mb-3 bg-surface-raised px-5 pb-3 pt-1">
            <div className="relative">
              <span
                className="pointer-events-none absolute inset-y-0 start-0 flex w-12 items-center justify-center text-text-secondary"
                aria-hidden="true"
              >
                <Search size={20} className="icon" />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                className={cn(
                  controlSurfaceClasses({}),
                  'type-body-lg min-h-14 ps-12 pe-4',
                )}
              />
            </div>
          </div>
        ) : null}

        <ul role="listbox" aria-label={label} className="flex flex-col gap-1 pb-2">
          {popular.length > 0 && popularHeading ? (
            <li aria-hidden="true" className="type-label-md px-1 pb-1 pt-2 text-text-secondary">
              {popularHeading}
            </li>
          ) : null}
          {popular.map((option) => (
            <OptionRow
              key={`popular-${option.value}`}
              option={option}
              selected={option.value === value}
              onSelect={() => {
                onChange(option.value);
                setOpen(false);
                setQuery('');
              }}
            />
          ))}

          {popular.length > 0 && allHeading ? (
            <li aria-hidden="true" className="type-label-md px-1 pb-1 pt-4 text-text-secondary">
              {allHeading}
            </li>
          ) : null}

          {filtered.map((option) => (
            <OptionRow
              key={option.value}
              option={option}
              selected={option.value === value}
              onSelect={() => {
                onChange(option.value);
                setOpen(false);
                setQuery('');
              }}
            />
          ))}

          {filtered.length === 0 ? (
            <li className="px-1 py-6">
              <p className="type-body-lg text-text-primary">{noResultsText}</p>
              {fallbackSuggestions.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1">
                  {fallbackSuggestions.map((option) => (
                    <OptionRow
                      key={`fallback-${option.value}`}
                      option={option}
                      selected={option.value === value}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                        setQuery('');
                      }}
                    />
                  ))}
                </ul>
              ) : null}
              {helpCtaText ? (
                <a
                  href="tel:333"
                  className="type-label-lg mt-4 inline-flex min-h-12 items-center gap-2 text-text-link underline"
                >
                  <Phone size={20} className="icon" aria-hidden="true" />
                  {helpCtaText}
                </a>
              ) : null}
            </li>
          ) : null}
        </ul>
      </Sheet>
    </>
  );
}

function OptionRow<T extends string>({
  option,
  selected,
  onSelect,
}: {
  readonly option: SelectOption<T>;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        disabled={option.disabled}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-md px-4 py-3 text-start',
          'transition-colors duration-fast ease-standard',
          'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
          selected ? 'bg-surface-brand-subtle' : 'hover:bg-surface-sunken active:bg-ramp-neutral-100',
          option.disabled && 'cursor-not-allowed text-text-disabled',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="type-body-lg block text-text-primary">{option.label}</span>
          {option.description ? (
            <span className="type-body-md block text-text-secondary">{option.description}</span>
          ) : null}
        </span>
        {selected ? (
          <Check size={24} className="icon shrink-0 text-ramp-green-600" aria-hidden="true" />
        ) : null}
      </button>
    </li>
  );
}
