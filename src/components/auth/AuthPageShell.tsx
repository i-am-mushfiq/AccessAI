import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { VoiceProvider } from '@/components/providers/VoiceProvider';

/**
 * Chrome for the authentication screens.
 *
 * Single-column, capped at `maxWidth.form` (480px) per BDS §5.2 — forms are
 * never widened on a large screen, because re-learning a wider layout costs more
 * than the whitespace saves.
 *
 * The language switcher is present here specifically: a citizen who has landed
 * on the wrong language must be able to change it BEFORE being asked to read
 * instructions and type a PIN.
 *
 * The voice layer is mounted here too, with `authenticated={false}`. Sign-in is
 * the one screen where nobody has a session, so it is the one screen where a
 * citizen who cannot type eleven digits has no way in — the microphone has to
 * work here or accessible authentication is a claim rather than a feature. What
 * is mounted is only the state machine: no floating microphone and no command
 * sheet, because there are no commands to run on a login form. The one control
 * that uses it is the dictation button beside the number and code fields.
 */
export async function AuthPageShell({ children }: { readonly children: ReactNode }) {
  const tc = await getTranslations('common');

  return (
    <VoiceProvider authenticated={false}>
      <div className="flex min-h-screen flex-col bg-canvas-plain">
        <header className="flex h-appbar items-center justify-between gap-3 px-4 pt-safe">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center gap-2 rounded-md px-2 type-label-lg text-text-primary hover:bg-surface-sunken focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
          >
            <ArrowLeft size={24} className="icon" aria-hidden="true" />
            {tc('back')}
          </Link>
          <LocaleSwitcher compact />
        </header>

        <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 pt-4">
          {children}
        </main>
      </div>
    </VoiceProvider>
  );
}
