import { cn } from '@/lib/utils/cn';

/**
 * The single circular loader (BDS §9.5). Multiple simultaneous spinners are
 * banned, as is a spinner with no accompanying words on any operation the
 * citizen is waiting on.
 */
export function Spinner({
  size = 20,
  className,
  label,
}: {
  readonly size?: number;
  readonly className?: string;
  readonly label?: string;
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin-slow"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
