'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { toLatinDigits } from '@/lib/format/numerals';

/**
 * OtpInput — BDS §10.2.5
 *
 * "The single most failure-prone screen in Bangladeshi fintech." Every rule
 * below exists because its absence is a documented cause of entry failure:
 *
 *  • Digits stay VISIBLE. Masking an SMS code adds no security (it is already
 *    in the SMS) and guarantees typos.
 *  • Pasting the whole code works and distributes digits across the boxes.
 *  • Backspace moves back AND clears; auto-advance goes forward only.
 *  • Bangla digits are accepted and normalised silently.
 *  • On error the boxes KEEP their digits — never wiped.
 *  • Auto-submit holds 400 ms with the completed code visible, so the citizen
 *    sees what was submitted instead of the screen jumping out from under them.
 *  • The group announces itself as "6-digit code, box 1 of 6" rather than six
 *    anonymous one-character fields.
 *  • Web OTP API is used where available so the code never has to be
 *    memorised across an app switch.
 */

export interface OtpInputProps {
  readonly length?: number;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onComplete?: (value: string) => void;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly label: string;
  /** Announced as "box {n} of {total}". */
  readonly boxLabel: (index: number, total: number) => string;
  readonly autoFocus?: boolean;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  disabled = false,
  label,
  boxLabel,
  autoFocus = true,
}: OtpInputProps) {
  const groupId = useId();
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [completedAt, setCompletedAt] = useState<number | null>(null);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (autoFocus && !disabled) inputsRef.current[0]?.focus();
  }, [autoFocus, disabled]);

  /* Web OTP API — fills the code without an app switch, on supporting browsers.
     `OTPCredential` is not in TypeScript's DOM lib, so the call is made through
     a narrowly-typed local shape rather than disabling checking wholesale. */
  useEffect(() => {
    if (typeof window === 'undefined' || !('OTPCredential' in window)) return;
    const controller = new AbortController();

    const credentials = navigator.credentials as unknown as {
      get(options: { otp: { transport: string[] }; signal: AbortSignal }): Promise<{ code?: string } | null>;
    };

    credentials
      .get({ otp: { transport: ['sms'] }, signal: controller.signal })
      .then((credential) => {
        const code = credential?.code ? toLatinDigits(credential.code).replace(/\D/g, '') : '';
        if (code) onChange(code.slice(0, length));
      })
      .catch(() => {
        /* Dismissed, unsupported, or no SMS arrived — manual entry stands. */
      });

    return () => controller.abort();
  }, [length, onChange]);

  const commit = useCallback(
    (next: string) => {
      onChange(next);
      if (next.length === length && !next.includes(' ')) {
        setCompletedAt(Date.now());
      }
    },
    [length, onChange],
  );

  // Hold briefly so the completed code is legible before the screen advances.
  useEffect(() => {
    if (completedAt === null) return;
    const timer = setTimeout(() => {
      onComplete?.(value);
      setCompletedAt(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [completedAt, onComplete, value]);

  const setDigit = (index: number, digit: string) => {
    const chars = Array.from({ length }, (_, i) => value[i] ?? '');
    chars[index] = digit;
    commit(chars.join('').replace(/\s+$/, ''));
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = toLatinDigits(raw).replace(/\D/g, '');
    if (!cleaned) {
      setDigit(index, '');
      return;
    }
    // More than one digit means a paste (or a fast typist) — distribute.
    if (cleaned.length > 1) {
      const chars = Array.from({ length }, (_, i) => value[i] ?? '');
      for (let i = 0; i < cleaned.length && index + i < length; i += 1) {
        chars[index + i] = cleaned[i]!;
      }
      const next = chars.join('');
      commit(next);
      const focusTarget = Math.min(index + cleaned.length, length - 1);
      inputsRef.current[focusTarget]?.focus();
      return;
    }
    setDigit(index, cleaned);
    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) {
        setDigit(index, '');
        return;
      }
      // Empty box: step back and clear the previous one.
      if (index > 0) {
        setDigit(index - 1, '');
        inputsRef.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = toLatinDigits(event.clipboardData.getData('text')).replace(/\D/g, '');
    if (pasted) commit(pasted.slice(0, length));
  };

  return (
    <div role="group" aria-labelledby={`${groupId}-label`} aria-describedby={error ? `${groupId}-error` : undefined}>
      <span id={`${groupId}-label`} className="type-label-lg mb-3 block text-text-primary">
        {label}
      </span>

      <div className="flex gap-2" dir="ltr">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputsRef.current[index] = node;
            }}
            // `text` + numeric inputMode: `type=number` would allow `e`/`-`
            // and show the banned spinner arrows.
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            // Deliberately NOT a password field: the code is already in the SMS.
            value={digit}
            disabled={disabled}
            maxLength={length}
            aria-label={boxLabel(index + 1, length)}
            aria-invalid={error ? true : undefined}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={cn(
              'type-mono-md h-16 w-12 rounded-md text-center tabular',
              'border-[length:var(--bds-border-width-functional)] bg-surface text-text-primary',
              'transition-colors duration-fast ease-standard',
              'focus:border-2 focus:border-stroke-focus focus:outline-none',
              'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
              error ? 'border-stroke-error' : 'border-stroke',
              disabled && 'cursor-not-allowed bg-surface-disabled text-text-disabled',
            )}
            style={{ fontSize: 'calc(1.5rem * var(--bds-text-scale))' }}
          />
        ))}
      </div>

      <div className="min-h-6 pt-2">
        {error ? (
          <p id={`${groupId}-error`} className="type-body-md font-semibold text-text-error">
            {error}
          </p>
        ) : null}
      </div>

      <span aria-live="polite" className="sr-only">
        {error ?? ''}
      </span>
    </div>
  );
}
