'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api/client';
import { SwitchRow } from '@/components/primitives/Choice';
import { useToast } from '@/components/providers/ToastProvider';
import { urlBase64ToUint8Array } from '@/lib/notifications/push';

function subscriptionBody(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('The browser returned an incomplete push subscription.');
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent,
  };
}

export function PushNotificationToggle({
  checked,
  configured,
  publicKey,
  onChange,
  onText,
  offText,
}: {
  readonly checked: boolean;
  readonly configured: boolean;
  readonly publicKey: string | null;
  readonly onChange: (value: boolean) => void;
  readonly onText: string;
  readonly offText: string;
}) {
  const t = useTranslations('settings');
  const te = useTranslations('errors');
  const toast = useToast();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const canUse =
      window.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(canUse);
    if (canUse) setPermission(Notification.permission);
  }, []);

  const toggle = async (next: boolean) => {
    if (pending) return;
    setPending(true);
    try {
      if (!next) {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await api.delete('/notifications/push', { endpoint: subscription.endpoint });
          await subscription.unsubscribe();
        } else {
          await api.patch('/users/settings', { notifyPush: false });
        }
        onChange(false);
        return;
      }

      if (!configured || !publicKey) return;
      const requested = await Notification.requestPermission();
      setPermission(requested);
      if (requested !== 'granted') {
        toast.show({ tone: 'error', message: t('pushPermissionDenied') });
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // DOM lib versions disagree about SharedArrayBuffer in Uint8Array;
          // the browser API accepts this byte sequence as a BufferSource.
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        }));
      await api.post('/notifications/push', subscriptionBody(subscription));
      onChange(true);
    } catch {
      toast.show({ tone: 'error', message: te('genericBody') });
    } finally {
      setPending(false);
    }
  };

  const description = !configured
    ? t('pushUnavailable')
    : supported === false
      ? t('pushUnsupported')
      : permission === 'denied'
        ? t('pushPermissionDenied')
        : undefined;

  return (
    <SwitchRow
      checked={checked}
      onChange={(value) => void toggle(value)}
      label={t('notifyChannelPush')}
      description={description}
      disabled={!configured || !publicKey || supported !== true}
      pending={pending}
      onText={onText}
      offText={offText}
    />
  );
}
