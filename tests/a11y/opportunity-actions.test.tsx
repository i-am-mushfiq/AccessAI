import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpportunityActions } from '@/components/opportunity/OpportunityActions';
import { catalog, LOCALE_INDEX, project } from '@/messages/catalog';

const { post, show, push } = vi.hoisted(() => ({
  post: vi.fn(),
  show: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { readonly href: string; readonly children: ReactNode }) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/api/client', () => ({ api: { post, patch: vi.fn(), delete: vi.fn() }, ApiError: class extends Error {} }));
vi.mock('@/components/providers/ToastProvider', () => ({ useToast: () => ({ show }) }));
vi.mock('@/components/providers/VoiceProvider', () => ({ useVoiceActions: () => undefined }));

function Providers({ children, locale = 'en' }: { readonly children: ReactNode; readonly locale?: 'bn' | 'en' }) {
  return (
    <NextIntlClientProvider locale={locale} messages={project(catalog, LOCALE_INDEX[locale])}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        {children}
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function renderActions(locale: 'bn' | 'en' = 'en') {
  return render(
    <Providers locale={locale}>
      <OpportunityActions opportunityId="opp-1" slug="sample-programme" saved={null} applyUrl={null} officialUrl={null} hasSteps />
    </Providers>,
  );
}

describe('OpportunityActions action-plan creation', () => {
  beforeEach(() => {
    post.mockReset();
    show.mockReset();
    push.mockReset();
    post.mockResolvedValue({ plan: { id: 'plan-1' }, tasks: [], created: true, timelineEventIds: ['event-1'] });
  });

  it('shows localized success and exposes a canonical timeline focus action', async () => {
    renderActions('bn');
    fireEvent.click(screen.getByRole('button', { name: 'কাজের পরিকল্পনা তৈরি করুন' }));

    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'success',
      message: 'আপনার কাজের পরিকল্পনা তৈরি হয়েছে।',
      action: expect.objectContaining({ label: 'সময়সূচি দেখুন' }),
    })));
    expect(screen.getByRole('link', { name: 'সময়সূচি দেখুন' })).toHaveAttribute('href', '/timeline?focus=plan-1');

    const toast = show.mock.calls[0]?.[0] as { action: { onAction: () => void } };
    toast.action.onAction();
    expect(push).toHaveBeenCalledWith('/timeline?focus=plan-1');
  });

  it('prevents a duplicate click while the request is pending', async () => {
    let resolve: ((value: unknown) => void) | undefined;
    post.mockReturnValueOnce(new Promise((complete) => { resolve = complete; }));
    renderActions();
    const button = screen.getByRole('button', { name: 'Create an action plan' });

    fireEvent.click(button);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    expect(post).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve?.({ plan: { id: 'plan-2' }, tasks: [], created: true, timelineEventIds: [] });
    });
  });

  it('shows the existing localized error path when creation fails', async () => {
    post.mockRejectedValueOnce(new Error('failed'));
    renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Create an action plan' }));

    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'error' })));
  });
});
