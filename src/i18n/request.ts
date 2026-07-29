import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // `.ts` rather than `.json`: both locales are projected from one bilingual
    // catalogue so a string cannot exist in one language and not the other.
    messages: (await import(`../messages/${locale}.ts`)).default,
    timeZone: 'Asia/Dhaka',
    onError(error) {
      // A missing string must be loud in development and silent in production;
      // never render a raw ICU key to a citizen.
      if (process.env.NODE_ENV === 'development') {
        console.error('[i18n]', error.message);
      }
    },
    getMessageFallback({ key, namespace }) {
      const path = [namespace, key].filter(Boolean).join('.');
      return process.env.NODE_ENV === 'development' ? `⟨${path}⟩` : '';
    },
  };
});
