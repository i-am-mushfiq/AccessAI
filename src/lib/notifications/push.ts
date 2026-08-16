/** Convert a VAPID public key to the byte sequence expected by PushManager. */
export function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = globalThis.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
