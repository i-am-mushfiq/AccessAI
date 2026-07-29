'use client';

import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, LOCALE_LABELS, type AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';

/**
 * Language switcher.
 *
 * Presented as two visible options rather than a dropdown, because with exactly
 * two choices BDS §10.2.6 requires both to be visible — and because a citizen
 * who cannot read the current language cannot be expected to find the control
 * that changes it behind a closed menu.
 *
 * Each option is labelled in its OWN language ("বাংলা", "English"), never
 * translated, so it is legible regardless of which locale is active.
 */
export function LocaleSwitcher({
  className,
  compact = false,
}: {
  readonly className?: string;
  readonly compact?: boolean;
}) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (next: AppLocale) => {
    if (next === locale) return;
    // `replace` rather than `push`: the previous language is not a place the
    // citizen wants in their back history.
    router.replace(pathname, { locale: next });
  };

  if (compact) {
    const other = routing.locales.find((l) => l !== locale)!;
    return (
      <button
        type="button"
        onClick={() => switchTo(other)}
        aria-label={`${LOCALE_LABELS[other]}`}
        className={cn(
          'inline-flex h-12 items-center gap-1.5 rounded-pill px-3 type-label-md',
          'text-text-primary hover:bg-surface-sunken active:bg-ramp-neutral-100',
          'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
          className,
        )}
      >
        <Languages size={20} className="icon" aria-hidden="true" />
        <span>{LOCALE_LABELS[other]}</span>
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn('flex gap-1 rounded-pill bg-surface-sunken p-1', className)}
    >
      {routing.locales.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => switchTo(option)}
            // `lang` on each option so the label renders with its own font and
            // typographic rules even when the page locale differs.
            lang={option}
            className={cn(
              'min-h-12 flex-1 rounded-pill px-3 type-label-md',
              'transition-colors duration-fast ease-standard',
              'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
              active ? 'bg-surface text-text-brand shadow-elev-1' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {LOCALE_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
