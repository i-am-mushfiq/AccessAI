/* AccessAI's small, dependency-free web push worker. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() ?? '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'AccessAI', {
      body: data.body ?? '',
      tag: data.tag ?? 'accessai-notification',
      data: { actionUrl: data.actionUrl ?? '/bn/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const candidate = event.notification.data?.actionUrl;
  const target = typeof candidate === 'string' && /^\/(?:bn|en)\/(?:opportunities\/[^/]+|timeline(?:\?.*)?|notifications(?:\?.*)?)$/.test(candidate)
    ? candidate
    : '/bn/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          void client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
