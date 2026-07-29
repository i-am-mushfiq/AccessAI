'use client';

import { cn } from '@/lib/utils/cn';
import { formatMoney, amountInWords, formatNumber } from '@/lib/format/numerals';
import { usePreferences } from '@/components/providers/PreferencesProvider';

/**
 * Money display — BDS §2.2 rule 3 and §4.3.
 *
 * The only sanctioned way to render an amount. Centralised so that "never
 * abbreviate", "always two decimals", "tabular figures", and South-Asian
 * grouping cannot be forgotten at a call site.
 *
 * `withWords` renders the amount in Bangla/English words underneath — BDS
 * §10.2.3 calls this the highest-value error-prevention control in the system,
 * because it makes a 10× misreading impossible to miss.
 */

export function Money({
  amount,
  decimals = 2,
  className,
  withWords = false,
  size = 'body',
  ariaLabel,
}: {
  readonly amount: number | null | undefined;
  readonly decimals?: 0 | 2;
  readonly className?: string;
  readonly withWords?: boolean;
  readonly size?: 'body' | 'hero' | 'label';
  readonly ariaLabel?: string;
}) {
  const { locale, numerals } = usePreferences();

  const formatted = formatMoney(amount, { numerals, decimals });
  const typeClass = size === 'hero' ? 'type-display-lg' : size === 'label' ? 'type-label-lg' : 'type-body-lg';

  if (amount === null || amount === undefined) {
    return (
      <span className={cn(typeClass, 'tabular text-text-secondary', className)} aria-label={ariaLabel}>
        {formatted}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex flex-col', className)}>
      <span
        data-numeric=""
        className={cn(typeClass, 'type-money tabular text-text-primary')}
        aria-label={ariaLabel ?? `${formatted} — ${amountInWords(amount, locale)}`}
      >
        {formatted}
      </span>
      {withWords ? (
        <span className="type-body-md text-text-secondary" aria-hidden="true">
          {amountInWords(amount, locale)}
        </span>
      ) : null}
    </span>
  );
}

/** A plain localised integer (counts, days, people). */
export function Num({
  value,
  decimals = 0,
  className,
}: {
  readonly value: number | null | undefined;
  readonly decimals?: number;
  readonly className?: string;
}) {
  const { numerals } = usePreferences();
  if (value === null || value === undefined) return <span className={className}>—</span>;
  return (
    <span data-numeric="" className={cn('tabular', className)}>
      {formatNumber(value, { numerals, decimals })}
    </span>
  );
}
