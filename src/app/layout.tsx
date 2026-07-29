import type { ReactNode } from 'react';

/**
 * Root layout.
 *
 * Deliberately minimal: `<html>` and `<body>` are emitted by the locale layout,
 * because the `lang` attribute must carry the active locale and `lang` is what
 * drives every Bangla typography rule in globals.css (the `:lang(bn)` selectors
 * for line-height, size uplift, and italic suppression).
 */
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
