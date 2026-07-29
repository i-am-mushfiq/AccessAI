'use client';

import { forwardRef, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Spinner } from './Spinner';

/**
 * Button — BDS §10.1
 *
 * Decisions that are easy to get wrong and are therefore enforced here:
 *  • Height is a MINIMUM, never fixed: a long Bangla label grows to two lines
 *    rather than truncating (§10.1.8). `min-h` + `whitespace-normal`.
 *  • `lg` (56 dp) is the default, not `md`. `xl` (64 dp) for commit actions.
 *  • Pressed state is mandatory; hover is optional and must not shift layout.
 *  • Loading replaces the label with a present-tense SENTENCE, locks the width,
 *    swallows taps, and announces politely. A wordless spinner is banned.
 *  • Tertiary has no border — a low-contrast bordered "ghost" button is the
 *    most reliably unrecognised pattern for low-literacy users.
 *  • Primary is never pill-shaped (§8.4): pills read as chips/filters.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'danger-subtle';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly fullWidth?: boolean;
  readonly loading?: boolean;
  /**
   * Shown in place of the label while loading. REQUIRED when `loading` can be
   * true — the type system cannot express that, so the fallback is an explicit
   * generic sentence rather than a bare spinner.
   */
  readonly loadingLabel?: string;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  /**
   * Why the button is unavailable. Rendered as an accessible description so a
   * disabled control is never a silent dead end (§10.1.4). Prefer keeping the
   * button ENABLED and revealing validation errors on tap.
   */
  readonly disabledReason?: string;
  readonly children: ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // Targets are padded to ≥48 dp even at `sm` (§6.3).
  sm: 'min-h-10 px-4 type-label-md gap-2 my-1',
  md: 'min-h-12 px-5 type-label-lg gap-2',
  lg: 'min-h-14 px-6 type-label-lg gap-2',
  xl: 'min-h-16 px-6 type-label-lg gap-3',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-ramp-green-600 text-text-on-brand border-0',
    'hover:bg-ramp-green-700 active:bg-ramp-green-800',
    'disabled:bg-surface-disabled disabled:text-text-disabled disabled:border-1 disabled:border-stroke-disabled',
  ),
  secondary: cn(
    'bg-surface text-text-brand border-1.5 border-stroke',
    'hover:bg-surface-brand-subtle active:bg-ramp-green-100',
    'disabled:bg-surface-disabled disabled:text-text-disabled disabled:border-stroke-disabled',
  ),
  tertiary: cn(
    'bg-transparent text-text-brand border-0',
    'hover:bg-surface-brand-subtle active:bg-ramp-green-100',
    'disabled:bg-transparent disabled:text-text-disabled',
  ),
  danger: cn(
    'bg-ramp-error-600 text-text-on-brand border-0',
    'hover:bg-ramp-error-700 active:bg-ramp-error-800',
    'disabled:bg-surface-disabled disabled:text-text-disabled disabled:border-1 disabled:border-stroke-disabled',
  ),
  'danger-subtle': cn(
    'bg-surface text-text-error border-1.5 border-stroke-error',
    'hover:bg-surface-error active:bg-ramp-error-100',
    'disabled:bg-surface-disabled disabled:text-text-disabled disabled:border-stroke-disabled',
  ),
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'lg',
    fullWidth = true,
    loading = false,
    loadingLabel,
    leadingIcon,
    trailingIcon,
    disabledReason,
    disabled,
    className,
    children,
    onClick,
    type = 'button',
    ...rest
  },
  ref,
) {
  const innerRef = useRef<HTMLButtonElement | null>(null);
  const lockedWidth = useRef<number | null>(null);

  const isDisabled = disabled === true;

  const setRefs = (node: HTMLButtonElement | null) => {
    innerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as { current: HTMLButtonElement | null }).current = node;
  };

  // Capture the resting width before the label is swapped, so entering the
  // loading state cannot reflow the footer under the citizen's thumb.
  if (!loading && innerRef.current) {
    lockedWidth.current = innerRef.current.offsetWidth;
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Taps are swallowed while loading — never allow a double submission from
    // an impatient second tap (§10.1.5).
    if (loading) {
      event.preventDefault();
      return;
    }
    // A light haptic tick confirms the press outdoors, where the pressed
    // colour change may be hard to see.
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        /* vibration unsupported or blocked — visual feedback still applies */
      }
    }
    onClick?.(event);
  };

  const describedBy = isDisabled && disabledReason ? `${rest.id ?? 'btn'}-disabled-reason` : undefined;

  return (
    <>
      <button
        {...rest}
        ref={setRefs}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        aria-describedby={describedBy}
        onClick={handleClick}
        style={
          loading && lockedWidth.current && !fullWidth
            ? { width: `${lockedWidth.current}px`, ...rest.style }
            : rest.style
        }
        className={cn(
          'relative inline-flex items-center justify-center rounded-md',
          // Height-flexible: the label wraps instead of being clipped.
          'whitespace-normal text-center',
          'transition-colors duration-fast ease-standard',
          'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
          'disabled:cursor-not-allowed',
          // Hover only where a real pointer exists; ~97% of sessions are touch
          // and Android WebViews fire hover on tap, causing visible flicker.
          '[@media(hover:none)]:hover:bg-[unset]',
          SIZE_CLASSES[size],
          VARIANT_CLASSES[variant],
          fullWidth ? 'w-full' : 'min-w-24',
          loading && 'cursor-progress',
          className,
        )}
      >
        {loading ? (
          <>
            <Spinner size={size === 'sm' ? 16 : 20} />
            <span>{loadingLabel ?? 'অনুগ্রহ করে অপেক্ষা করুন…'}</span>
          </>
        ) : (
          <>
            {leadingIcon ? (
              <span aria-hidden="true" className="shrink-0">
                {leadingIcon}
              </span>
            ) : null}
            <span>{children}</span>
            {trailingIcon ? (
              <span aria-hidden="true" className="shrink-0">
                {trailingIcon}
              </span>
            ) : null}
          </>
        )}
      </button>

      {/* A disabled control must never be an unexplained dead end. */}
      {describedBy ? (
        <span id={describedBy} className="sr-only">
          {disabledReason}
        </span>
      ) : null}

      {/* Politely announce the state change for screen-reader users. */}
      <span aria-live="polite" className="sr-only">
        {loading ? (loadingLabel ?? '') : ''}
      </span>
    </>
  );
});
