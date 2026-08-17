import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from '@/lib/notifications/push';
import { pushSubscriptionSchema, updateSettingsSchema } from '@/lib/validation/schemas';
import { isPushEligibleNotificationType, safeInternalActionUrl } from '@/modules/notifications/push.service';

describe('web push utilities', () => {
  it('decodes URL-safe VAPID key bytes', () => {
    expect([...urlBase64ToUint8Array('AAH_')]).toEqual([0, 1, 255]);
  });

  it('does not accept a client-supplied user id in a subscription payload', () => {
    const parsed = pushSubscriptionSchema.parse({
      userId: 'another-user',
      endpoint: 'https://push.example.test/subscription',
      keys: { p256dh: 'p'.repeat(32), auth: 'a'.repeat(16) },
    });
    expect(parsed).not.toHaveProperty('userId');
  });

  it('rejects malformed or non-HTTPS subscriptions', () => {
    expect(() => pushSubscriptionSchema.parse({
      endpoint: 'http://push.example.test/subscription',
      keys: { p256dh: 'short', auth: 'short' },
    })).toThrow();
  });

  it('keeps push scoped to deadline and timeline reminders', () => {
    expect(isPushEligibleNotificationType('deadline_reminder')).toBe(true);
    expect(isPushEligibleNotificationType('timeline_reminder')).toBe(true);
    expect(isPushEligibleNotificationType('application_reminder')).toBe(false);
    expect(isPushEligibleNotificationType('system')).toBe(false);
  });

  it('honours push opt-out through the existing settings contract', () => {
    expect(updateSettingsSchema.parse({ notifyPush: false }).notifyPush).toBe(false);
  });

  it('allows only safe internal click destinations', () => {
    expect(safeInternalActionUrl('/opportunities/grant-1', 'bn')).toBe('/bn/opportunities/grant-1');
    expect(safeInternalActionUrl('/timeline?focus=plan-1', 'en')).toBe('/en/timeline?focus=plan-1');
    expect(safeInternalActionUrl('https://evil.example/phish', 'bn')).toBe('/bn/notifications');
    expect(safeInternalActionUrl('//evil.example/phish', 'bn')).toBe('/bn/notifications');
  });
});
