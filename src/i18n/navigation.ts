import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation primitives. Components MUST import `Link` from here
 * rather than `next/link` so the active locale is preserved on every hop.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
