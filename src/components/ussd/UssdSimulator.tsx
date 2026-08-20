'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { PhoneCall, PhoneOff, Send } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { TextField } from '@/components/primitives/TextField';
import { useToast } from '@/components/providers/ToastProvider';

interface UssdTurn {
  readonly role: 'phone' | 'screen';
  readonly text: string;
}

interface SimulateResponse {
  readonly kind: 'CON' | 'END';
  readonly text: string;
}

/**
 * SJ-23/48 — a real feature-phone screen, not a mockup: every "Send" here
 * calls the exact same `handleUssdCallback()` the real telecom callback
 * calls (via POST /api/v1/ussd/simulate, which adds no capability the real
 * callback lacks — see that route's doc comment). What still cannot be
 * shown is a message arriving over an actual USSD radio channel; this
 * closes the gap between "the logic works" and "an audience can watch
 * someone dial it", which is the part curl/Postman could never do.
 */
export function UssdSimulator({ defaultPhone }: { readonly defaultPhone: string }) {
  const t = useTranslations('ussdDemo');
  const te = useTranslations('errors');
  const toast = useToast();

  const [phone, setPhone] = useState(defaultPhone);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<string[]>([]);
  const [turns, setTurns] = useState<UssdTurn[]>([]);
  const [input, setInput] = useState('');
  const [callActive, setCallActive] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    screenRef.current?.scrollTo({ top: screenRef.current.scrollHeight });
  }, [turns]);

  const send = useMutation({
    mutationFn: (text: string) =>
      api.post<SimulateResponse>('/ussd/simulate', {
        sessionId,
        phoneNumber: phone,
        text,
      }),
    onSuccess: (result) => {
      setTurns((prev) => [...prev, { role: 'screen', text: result.text }]);
      if (result.kind === 'END') {
        setCallActive(false);
        setCallEnded(true);
      }
    },
    onError: (error) => {
      toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
      setCallActive(false);
    },
  });

  const startCall = () => {
    const id = `sim-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    setSessionId(id);
    setAccumulated([]);
    setTurns([]);
    setInput('');
    setCallActive(true);
    setCallEnded(false);
    // A real dial-in opens with no input at all — the aggregator's very
    // first callback for a session always carries empty `text`.
    void api
      .post<SimulateResponse>('/ussd/simulate', { sessionId: id, phoneNumber: phone, text: '' })
      .then((result) => setTurns([{ role: 'screen', text: result.text }]))
      .catch((error) => {
        toast.show({ tone: 'error', message: error instanceof ApiError ? error.message : te('genericBody') });
        setCallActive(false);
      });
  };

  const sendInput = () => {
    if (!input.trim()) return;
    const next = [...accumulated, input.trim()];
    setAccumulated(next);
    setTurns((prev) => [...prev, { role: 'phone', text: input.trim() }]);
    setInput('');
    send.mutate(next.join('*'));
  };

  const hangUp = () => {
    setCallActive(false);
    setCallEnded(true);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <TextField
        label={t('phoneLabel')}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={callActive}
        inputMode="numeric"
        normaliseDigits
        maxLength={11}
        containerClassName="w-full max-w-xs"
      />

      {/* the "phone" */}
      <div className="w-full max-w-xs rounded-[2rem] border-4 border-stroke-strong bg-surface-sunken p-3 shadow-elev-2">
        <div
          ref={screenRef}
          className="h-64 overflow-y-auto rounded-lg bg-[#0b1f14] p-3 font-mono text-[13px] leading-relaxed text-[#8fe3b0]"
          aria-live="polite"
        >
          {turns.length === 0 ? (
            <p className="text-[#5a8a6d]">{t('dialToStart')}</p>
          ) : (
            turns.map((turn, i) => (
              <p key={i} className={turn.role === 'phone' ? 'text-[#c9f5d9]' : 'whitespace-pre-wrap text-[#8fe3b0]'}>
                {turn.role === 'phone' ? `> ${turn.text}` : turn.text}
              </p>
            ))
          )}
          {send.isPending ? <p className="text-[#5a8a6d]">…</p> : null}
        </div>

        {callActive ? (
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendInput();
              }}
              placeholder={t('inputPlaceholder')}
              className="min-h-12 flex-1 rounded-md border border-stroke bg-surface px-3 type-body-md text-text-primary"
              aria-label={t('inputPlaceholder')}
            />
            <Button variant="primary" size="md" onClick={sendInput} disabled={send.isPending} leadingIcon={<Send size={18} className="icon" />}>
              {t('send')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        {callActive ? (
          <Button variant="danger-subtle" size="md" onClick={hangUp} leadingIcon={<PhoneOff size={18} className="icon" />}>
            {t('hangUp')}
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={startCall} leadingIcon={<PhoneCall size={20} className="icon" />}>
            {callEnded ? t('callAgain') : t('startCall')}
          </Button>
        )}
      </div>

      <Card padding="compact" className="max-w-xs">
        <p className="type-caption text-text-tertiary">{t('explainer')}</p>
      </Card>
    </div>
  );
}
