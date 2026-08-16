import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { TimelineView, type TimelineEntry } from '@/components/timeline/TimelineView';
import { catalog, LOCALE_INDEX, project } from '@/messages/catalog';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { readonly href: string; readonly children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock('@/components/voice/ReadAloud', () => ({ ReadAloud: () => null }));

const events: readonly TimelineEntry[] = [
  {
    id: 'event-1', type: 'task', title: 'Collect document', titleBn: 'কাগজ সংগ্রহ করুন',
    description: null, descriptionBn: null, eventDate: new Date(Date.now() + 86_400_000).toISOString(),
    completed: false, opportunitySlug: null, planId: 'plan-1',
  },
];

function renderTimeline(focusPlanId?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={project(catalog, LOCALE_INDEX.en)}>
      <TimelineView events={events} focusPlanId={focusPlanId} />
    </NextIntlClientProvider>,
  );
}

describe('timeline plan focus', () => {
  it('renders a focusable highlighted plan event for a valid focus', async () => {
    renderTimeline('plan-1');
    const event = await screen.findByText('Collect document');
    const focused = event.closest('[id^="timeline-event-"]');
    expect(focused).toHaveAttribute('id', 'timeline-event-event-1');
    expect(focused).toHaveAttribute('aria-current', 'location');
    expect(focused).toHaveClass('ring-2');
  });

  it('safely renders normal timeline content for an invalid focus', async () => {
    renderTimeline('missing-plan');
    const event = await screen.findByText('Collect document');
    const normal = event.closest('[id^="timeline-event-"]');
    expect(normal).toHaveAttribute('id', 'timeline-event-event-1');
    expect(normal).not.toHaveAttribute('aria-current', 'location');
  });
});
