'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, Undo2, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Toasts — BDS §7.2 elevation.5, radius `sm` (deliberately less rounded than a
 * card so it reads as transient).
 *
 * `undo` is a first-class field, not an afterthought: BDS §1.1 law 5 requires
 * every destructive action to be undoable or double-confirmed, and an undo
 * affordance in the toast is how the reversible half of that is delivered.
 *
 * Toasts are announced via a live region but are NEVER the only place a result
 * appears — a citizen who misses a 5-second toast must still be able to see
 * what happened on the screen itself.
 */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastInput {
  readonly tone: ToastTone;
  readonly message: string;
  readonly undo?: { readonly label: string; readonly onUndo: () => void };
  readonly action?: { readonly label: string; readonly onAction: () => void };
  readonly durationMs?: number;
}

interface ToastRecord extends ToastInput {
  readonly id: string;
}

const ToastContext = createContext<{ show: (toast: ToastInput) => void } | null>(null);

const TONE_CONFIG: Record<ToastTone, { Icon: typeof Info; className: string }> = {
  success: { Icon: CheckCircle2, className: 'text-text-success' },
  error: { Icon: XCircle, className: 'text-text-error' },
  warning: { Icon: AlertTriangle, className: 'text-text-warning' },
  info: { Icon: Info, className: 'text-text-link' },
};

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      // An undoable toast lingers: 5 s is not enough time for an unhurried
      // citizen to notice, read, and decide to reverse an action.
      const duration = input.durationMs ?? (input.undo || input.action ? 9000 : 5000);
      setToasts((current) => [...current.slice(-2), { ...input, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Bottom-anchored above the nav so it never covers the primary action. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-toast flex flex-col items-center gap-2 px-4 pb-24 lg:pb-6"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const { Icon, className } = TONE_CONFIG[toast.tone];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                className={cn(
                  'pointer-events-auto flex w-full max-w-form items-start gap-3',
                  'rounded-sm border border-stroke-subtle bg-surface-raised p-4 shadow-elev-5',
                )}
              >
                <Icon size={24} className={cn('icon mt-0.5 shrink-0', className)} aria-hidden="true" />
                <p className="type-body-lg min-w-0 flex-1 text-text-primary">{toast.message}</p>

                {toast.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onAction();
                      dismiss(toast.id);
                    }}
                    className={cn(
                      'type-label-lg -my-1 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-md px-3',
                      'text-text-brand hover:bg-surface-brand-subtle active:bg-ramp-green-100',
                      'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
                    )}
                  >
                    {toast.action.label}
                    <ArrowRight size={20} className="icon" aria-hidden="true" />
                  </button>
                ) : toast.undo ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.undo?.onUndo();
                      dismiss(toast.id);
                    }}
                    className={cn(
                      'type-label-lg -my-1 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-md px-3',
                      'text-text-brand hover:bg-surface-brand-subtle active:bg-ramp-green-100',
                      'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
                    )}
                  >
                    <Undo2 size={20} className="icon" aria-hidden="true" />
                    {toast.undo.label}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    aria-label="Dismiss"
                    className="-my-1 -me-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill text-text-secondary hover:bg-surface-sunken"
                  >
                    <X size={20} className="icon" aria-hidden="true" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Screen-reader channel, separate from the visual stack. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {toasts.map((t) => (
          <p key={t.id}>{t.message}</p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return { show: () => undefined };
  }
  return context;
}
