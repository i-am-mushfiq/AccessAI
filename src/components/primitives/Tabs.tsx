'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Segmented tabs — BDS §8.3 (pill radius, because a segmented control is a
 * toggle rather than a CTA) and §1.1 law 12 (cap the choices).
 *
 * Active state carries THREE redundant cues, as bottom-nav does in §9.4: fill,
 * text colour, and `aria-selected` — never fill alone.
 */

export interface TabItem<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly count?: number;
  readonly icon?: ReactNode;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  variant = 'segmented',
}: {
  readonly items: readonly TabItem<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly className?: string;
  readonly variant?: 'segmented' | 'underline';
}) {
  const id = useId();

  if (variant === 'underline') {
    return (
      <div
        role="tablist"
        aria-label={label}
        className={cn('no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-stroke-subtle px-4', className)}
      >
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              role="tab"
              type="button"
              id={`${id}-${item.value}`}
              aria-selected={selected}
              onClick={() => onChange(item.value)}
              className={cn(
                'relative inline-flex min-h-12 shrink-0 items-center gap-2 px-4 type-label-lg',
                'transition-colors duration-fast ease-standard',
                'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
                selected ? 'text-text-brand' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {item.icon ? (
                <span aria-hidden="true" className="shrink-0">
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
              {typeof item.count === 'number' ? (
                <span className="tabular text-text-secondary" aria-hidden="true">
                  {item.count}
                </span>
              ) : null}
              {/* 3 dp indicator — the third cue alongside fill and colour. */}
              {selected ? (
                <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-0.75 rounded-pill bg-ramp-green-600" style={{ height: 3 }} />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex gap-1 rounded-pill bg-surface-sunken p-1', className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-pill px-3 type-label-md',
              'transition-colors duration-fast ease-standard',
              'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
              selected
                ? 'bg-surface text-text-brand shadow-elev-1'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {item.icon ? (
              <span aria-hidden="true" className="shrink-0">
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
            {typeof item.count === 'number' ? (
              <span className="tabular" aria-hidden="true">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
