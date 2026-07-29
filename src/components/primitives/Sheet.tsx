'use client';

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { IconButton } from './IconButton';
import { Button } from './Button';

/**
 * Sheet (bottom) and Dialog (centred) — BDS §7.2 elevation.4, §8.3 radius.
 *
 * The scrim is 0.56 rather than the common 0.32 on purpose: a stronger scrim
 * makes it unambiguous that the background is inert, preventing the "tapping a
 * disabled screen" confusion that reads as an app freeze.
 *
 * The sheet's bottom corners are square — the flat edge signals "attached to
 * the screen edge" rather than floating.
 */

interface OverlayBaseProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly closeLabel?: string;
  /** Set false for destructive confirmations that must be answered. */
  readonly dismissible?: boolean;
  readonly className?: string;
}

function useOverlayBehaviour(open: boolean, onClose: () => void, dismissible: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    // Move focus into the panel so keyboard and screen-reader users are not
    // left behind the scrim.
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? panelRef.current)?.focus();
    }, 30);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus();
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // Contain Tab within the panel.
      const focusables = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [dismissible, onClose],
  );

  return { panelRef, handleKeyDown };
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = 'বন্ধ করুন',
  dismissible = true,
  className,
}: OverlayBaseProps) {
  const titleId = useId();
  const descId = useId();
  const { panelRef, handleKeyDown } = useOverlayBehaviour(open, onClose, dismissible);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-modal flex items-end justify-center" onKeyDown={handleKeyDown}>
          <motion.div
            className="scrim absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.24, ease: [0, 0, 0, 1] }}
            className={cn(
              'relative flex max-h-[90vh] w-full flex-col',
              'rounded-t-xl bg-surface-raised shadow-elev-4',
              'lg:max-w-form lg:rounded-b-xl lg:mb-6',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stroke-subtle px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="type-heading-md text-text-primary">
                  {title}
                </h2>
                {description ? (
                  <p id={descId} className="type-body-md mt-1 text-text-secondary">
                    {description}
                  </p>
                ) : null}
              </div>
              {dismissible ? <IconButton label={closeLabel} onClick={onClose} icon={<X size={24} className="icon" />} /> : null}
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

            {footer ? (
              <div className="border-t border-stroke-subtle px-5 py-4 pb-safe">{footer}</div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = 'বন্ধ করুন',
  dismissible = true,
  className,
}: OverlayBaseProps) {
  const titleId = useId();
  const descId = useId();
  const { panelRef, handleKeyDown } = useOverlayBehaviour(open, onClose, dismissible);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
          <motion.div
            className="scrim absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className={cn(
              'relative flex max-h-[85vh] w-full max-w-dialog flex-col',
              'rounded-lg bg-surface-raised shadow-elev-4 lg:rounded-xl',
              className,
            )}
          >
            <div className="px-5 pt-5">
              <h2 id={titleId} className="type-heading-md text-text-primary">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="type-body-lg mt-2 text-text-secondary">
                  {description}
                </p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer ? <div className="px-5 pb-5">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Destructive confirmation. BDS §10.1.6 deliberately INVERTS the normal
 * hierarchy: the safe option is visually dominant and sits on top, because the
 * default gesture bias should favour safety.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirming = false,
  confirmingLabel,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly confirming?: boolean;
  readonly confirmingLabel?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      dismissible={!confirming}
      footer={
        <div className="flex flex-col gap-3">
          {/* Safe option first and visually stronger. */}
          <Button variant="secondary" onClick={onClose} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={confirming} loadingLabel={confirmingLabel}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <span className="sr-only">{description}</span>
    </Dialog>
  );
}
