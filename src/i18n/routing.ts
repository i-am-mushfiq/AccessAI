import { defineRouting } from 'next-intl/routing';

/**
 * BDS: `bn-BD` is the DEFAULT locale, `en-BD` is secondary.
 * Mixed Bangla–English strings are a first-class case, not an edge case.
 */
export const routing = defineRouting({
  locales: ['bn', 'en'],
  defaultLocale: 'bn',
  localePrefix: 'always',
  localeDetection: true,
});

export type AppLocale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  bn: 'বাংলা',
  en: 'English',
};

/** BCP-47 tags used for `lang`, Intl formatting, and ICU number grouping. */
export const LOCALE_TAGS: Record<AppLocale, string> = {
  bn: 'bn-BD',
  en: 'en-BD',
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (routing.locales as readonly string[]).includes(value);
}
