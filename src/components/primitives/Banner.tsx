import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Banner — status messaging.
 *
 * BDS §9.7: each status has a DISTINCT SILHOUETTE, not just a distinct colour.
 * The differing outer shape is what carries meaning for the ~8% of Bangladeshi
 * men with red–green colour vision deficiency:
 *
 *   success = tick in a circle      warning = exclamation in a TRIANGLE
 *   error   = cross in a circle     info    = "i" in a circle
 *   pending = clock in a circle
 *
 * Every banner also carries a WORD (the `statusWord` prop). Colour is never the
 * only channel. And per the green-on-green rule (§3.2), a success message is a
 * TINTED surface with a tick — never a solid green block, which would read as
 * something tappable.
 */

export type BannerTone = 'success' | 'warning' | 'error' | 'info' | 'pending';

const TONE_STYLES: Record<BannerTone, { surface: string; text: string; border: string; Icon: typeof Info }> = {
  success: {
    surface: 'bg-surface-success',
    text: 'text-text-success',
    border: 'border-stroke-success',
    Icon: CheckCircle2,
  },
  warning: {
    surface: 'bg-surface-warning',
    text: 'text-text-warning',
    border: 'border-stroke-warning',
    Icon: AlertTriangle,
  },
  error: {
    surface: 'bg-surface-error',
    text: 'text-text-error',
    border: 'border-stroke-error',
    Icon: XCircle,
  },
  info: {
    surface: 'bg-surface-info',
    text: 'text-text-link',
    border: 'border-stroke-info',
    Icon: Info,
  },
  pending: {
    surface: 'bg-surface-warning',
    text: 'text-text-warning',
    border: 'border-stroke-warning',
    Icon: Clock,
  },
};

export interface BannerProps {
  readonly tone: BannerTone;
  /** The word that names the status — never rely on colour alone. */
  readonly statusWord: string;
  readonly title?: string;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
  /** Errors and warnings announce assertively; info and success politely. */
  readonly live?: boolean;
}

export function Banner({ tone, statusWord, title, children, actions, className, live = false }: BannerProps) {
  const style = TONE_STYLES[tone];
  const Icon = style.Icon;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={live ? (tone === 'error' || tone === 'warning' ? 'assertive' : 'polite') : undefined}
      data-elevated=""
      className={cn('rounded-lg border p-4', style.surface, style.border, className)}
    >
      <div className="flex items-start gap-3">
        <Icon size={24} className={cn('icon mt-0.5 shrink-0', style.text)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {/* The status word is visible text, not an aria-label. */}
          <p className={cn('type-label-lg', style.text)}>
            {statusWord}
            {title ? <span className="text-text-primary">{` — ${title}`}</span> : null}
          </p>
          {children ? <div className="type-body-lg mt-1 text-text-primary measure">{children}</div> : null}
          {actions ? <div className="mt-3 flex flex-col gap-3 sm:flex-row">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The "why is this here?" education panel (§3.4 surface.info) — used to explain
 * a request before asking for sensitive data, per BDS §80.
 */
export function InfoPanel({
  title,
  children,
  className,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div data-elevated="" className={cn('rounded-lg border border-stroke-info bg-surface-info p-4', className)}>
      <p className="type-label-lg flex items-center gap-2 text-text-link">
        <Info size={20} className="icon shrink-0" aria-hidden="true" />
        {title}
      </p>
      <div className="type-body-lg mt-2 text-text-primary measure">{children}</div>
    </div>
  );
}
