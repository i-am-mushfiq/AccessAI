import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Card — BDS §7.2 elevation.1, §8.3 radius.lg, §5.5 padding.
 *
 * Every elevated surface ALSO carries a 1 dp border. Shadows are nearly
 * invisible in sunlight and on scratched screen protectors, so shadow is a
 * bonus cue and never the only one. `data-elevated` lets the sunlight theme
 * promote the border to 2 dp and drop the shadow entirely.
 */

export interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly padding?: 'none' | 'compact' | 'default' | 'hero';
  readonly as?: ElementType;
  readonly selected?: boolean;
  readonly tone?: 'default' | 'brand' | 'sunken';
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  compact: 'p-4',
  // 20 dp is the default because it gives Bangla descenders room to breathe.
  default: 'p-5',
  hero: 'p-6',
};

const TONE: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'bg-surface',
  brand: 'bg-surface-brand text-text-on-brand-deep',
  sunken: 'bg-surface-sunken',
};

export function Card({
  children,
  className,
  padding = 'default',
  as: Component = 'div',
  selected = false,
  tone = 'default',
}: CardProps) {
  return (
    <Component
      data-elevated=""
      className={cn(
        'rounded-lg border border-stroke-subtle',
        selected ? 'border-1.5 border-stroke-brand shadow-elev-2' : 'shadow-elev-1',
        TONE[tone],
        PADDING[padding],
        className,
      )}
    >
      {children}
    </Component>
  );
}

/** Section wrapper: heading + 24 dp separation, per BDS §5.5 grouping. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  headingLevel = 'h2',
}: {
  readonly title?: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      {title ? (
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <Heading className={cn(headingLevel === 'h2' ? 'type-heading-md' : 'type-heading-sm', 'text-text-primary')}>
              {title}
            </Heading>
            {description ? <p className="type-body-md mt-1 text-text-secondary measure">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A list row. §5.5: 64 dp single-line / 72 dp two-line minimum, which exceeds
 * the 48 dp target floor so a shaky tap cannot hit the neighbouring row.
 *
 * ONE tappable per row. A row needing a second action gets its own 48 dp
 * target with ≥8 dp separation and its own accessible label.
 */
export function ListRow({
  leading,
  title,
  secondary,
  trailing,
  onClick,
  href,
  as,
  className,
  ariaLabel,
}: {
  readonly leading?: ReactNode;
  readonly title: ReactNode;
  readonly secondary?: ReactNode;
  readonly trailing?: ReactNode;
  readonly onClick?: () => void;
  readonly href?: string;
  readonly as?: ElementType;
  readonly className?: string;
  readonly ariaLabel?: string;
}) {
  const interactive = Boolean(onClick || href);
  const Component: ElementType = as ?? (href ? 'a' : onClick ? 'button' : 'div');

  return (
    <Component
      {...(href ? { href } : {})}
      {...(onClick ? { onClick, type: Component === 'button' ? 'button' : undefined } : {})}
      aria-label={ariaLabel}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-start',
        secondary ? 'min-h-18' : 'min-h-16',
        interactive &&
          cn(
            'rounded-md transition-colors duration-fast ease-standard',
            'hover:bg-surface-sunken active:bg-ramp-neutral-100',
            'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
          ),
        className,
      )}
    >
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="type-body-lg block text-text-primary">{title}</span>
        {secondary ? <span className="type-body-md block text-text-secondary clamp-2">{secondary}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </Component>
  );
}
