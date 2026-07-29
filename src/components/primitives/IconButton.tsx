'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * IconButton — BDS §10.1.7
 *
 * The ICON is 24 dp; the TARGET is always 48 dp. An accessible name is
 * mandatory and must describe the ACTION, not the picture: "go back", never
 * "arrow".
 *
 * §9.1 permits only four unlabelled icons, in their conventional position:
 * back, close, search-in-field, and row-trailing "more". This component must
 * never be used for a primary or destructive action, or for anything a
 * first-time user has to discover.
 */

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  readonly icon: ReactNode;
  /** Describes the ACTION. Required — an unnamed icon button announces "button". */
  readonly label: string;
  readonly variant?: 'plain' | 'filled' | 'on-brand';
  readonly size?: 'md' | 'lg';
}

const VARIANTS: Record<NonNullable<IconButtonProps['variant']>, string> = {
  plain: 'bg-transparent text-text-primary hover:bg-surface-sunken active:bg-ramp-neutral-200',
  filled: 'bg-surface-sunken text-text-primary hover:bg-ramp-neutral-200 active:bg-ramp-neutral-300',
  'on-brand': 'bg-transparent text-text-on-brand hover:bg-white/10 active:bg-white/20',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'plain', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill',
        'transition-colors duration-fast ease-standard',
        'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-transparent',
        size === 'lg' ? 'h-14 w-14' : 'h-12 w-12',
        VARIANTS[variant],
        className,
      )}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
});
