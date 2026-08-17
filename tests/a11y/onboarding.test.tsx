import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { catalog, LOCALE_INDEX, project } from '@/messages/catalog';

const { patch, post, replace } = vi.hoisted(() => ({
  patch: vi.fn(() => Promise.resolve({ profile: {}, completeness: 20 })),
  post: vi.fn(() => Promise.resolve({ onboardingCompletedAt: new Date().toISOString() })),
  replace: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api/client', () => ({ api: { patch, post }, ApiError: class extends Error {} }));

function Providers({ children, locale = 'en' }: { readonly children: ReactNode; readonly locale?: 'bn' | 'en' }) {
  return <NextIntlClientProvider locale={locale} messages={project(catalog, LOCALE_INDEX[locale])}>{children}</NextIntlClientProvider>;
}

describe('onboarding flow', () => {
  beforeEach(() => {
    patch.mockClear();
    post.mockClear();
    replace.mockClear();
  });

  it('saves minimum profile data, marks completion, and opens deterministic results', async () => {
    render(<Providers><OnboardingFlow initial={{ district: 'dhaka', occupation: 'farmer' }} /></Providers>);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show my possible benefits' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/users/profile', expect.objectContaining({ district: 'dhaka', occupation: 'farmer', lifeEvents: [] })));
    expect(post).toHaveBeenCalledWith('/users/onboarding/complete');
    expect(replace).toHaveBeenCalledWith('/onboarding?results=1');
  });

  it('keeps the localized first-run copy and accessible progress visible', () => {
    render(<Providers locale="bn"><OnboardingFlow initial={{ district: 'dhaka', occupation: 'farmer' }} /></Providers>);

    expect(screen.getByRole('heading', { name: 'আপনার জন্য কী আছে, দেখে নিন' })).toBeInTheDocument();
    expect(screen.getByText('ধাপ 1 / 3')).toBeInTheDocument();
  });

  it('does not advance without district and occupation', () => {
    render(<Providers><OnboardingFlow initial={{}} /></Providers>);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please choose your district and occupation first.');
    expect(screen.getByText('Step 1 / 3')).toBeInTheDocument();
  });
});
