import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileForm, suggestFarmingActivity } from '@/components/profile/ProfileForm';
import { catalog, LOCALE_INDEX, project } from '@/messages/catalog';

const { patch, refresh, show, dictate } = vi.hoisted(() => ({
  patch: vi.fn(() => Promise.resolve({ completeness: 80, profile: {} as Record<string, unknown> })),
  refresh: vi.fn(),
  show: vi.fn(),
  dictate: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/api/client', () => ({
  api: { patch },
  ApiError: class extends Error {},
}));

vi.mock('@/components/providers/ToastProvider', () => ({
  useToast: () => ({ show }),
}));

vi.mock('@/components/providers/VoiceProvider', () => ({
  useVoice: () => ({ dictate, state: 'idle', canListen: false }),
}));

function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={project(catalog, LOCALE_INDEX.en)}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        {children}
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function renderProfile(
  gender: string,
  isPregnant = true,
  profileOverrides: Record<string, unknown> = {},
) {
  return render(
    <Providers>
      <ProfileForm
        initialCompleteness={50}
        user={{ name: 'Test user', email: null, district: null }}
        profile={{ gender, isPregnant, ...profileOverrides }}
      />
    </Providers>,
  );
}

describe('ProfileForm pregnancy field', () => {
  it('does not render pregnancy questions for male users', () => {
    const { container } = renderProfile('male');

    expect(screen.queryByRole('group', { name: /Are you pregnant\?/ })).not.toBeInTheDocument();
    expect(container.querySelector('input[name="isPregnant"]')).toBeNull();
  });

  it('does not submit stale pregnancy state from an existing male profile', async () => {
    patch.mockClear();
    renderProfile('male');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const lastCall = patch.mock.calls.at(-1) as [string, Record<string, unknown>] | undefined;
    expect(lastCall?.[1]).toMatchObject({ gender: 'male', isPregnant: null });
  });

  it('keeps the pregnancy field for female users', () => {
    renderProfile('female');

    const pregnancyGroup = screen.getByRole('group', { name: /Are you pregnant\?/ });
    expect(pregnancyGroup).toBeInTheDocument();
    expect(pregnancyGroup.querySelector('input[name="isPregnant"][value="yes"]')).not.toBeNull();
  });

  it('clears local pregnancy state immediately when gender changes to male', async () => {
    patch.mockClear();
    renderProfile('female');

    fireEvent.click(screen.getByRole('radio', { name: 'Male' }));
    expect(screen.queryByRole('group', { name: /Are you pregnant\?/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const lastCall = patch.mock.calls.at(-1) as [string, Record<string, unknown>] | undefined;
    expect(lastCall?.[1]).toMatchObject({ gender: 'male', isPregnant: null });
  });

  it('reconciles all local fields from the canonical PATCH response', async () => {
    patch.mockClear();
    refresh.mockClear();
    show.mockClear();
    patch.mockResolvedValueOnce({
      completeness: 88,
      profile: {
        gender: 'male',
        occupation: 'teacher',
        hasFarmingActivity: false,
        farmSizeDecimals: null,
        crops: null,
        livestock: null,
        isPregnant: null,
        monthlyIncome: 1234,
      },
    });

    renderProfile('female', true, { hasFarmingActivity: true, farmSizeDecimals: 20, crops: ['rice'] });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('group', { name: /Are you pregnant\?/ })).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Are you connected to farming or agriculture\?/ })).toBeInTheDocument();
    });
    expect(screen.queryByRole('textbox', { name: /Farm size \(decimals\)/ })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Monthly income/ })).toHaveValue('1234');
    expect(screen.queryByText('You have changes that are not saved.')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: /Are you connected to farming or agriculture\?/ }))
        .getByRole('radio', { name: 'No' }),
    ).toBeChecked();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith({
      tone: 'success',
      message: 'Your profile was updated successfully.',
    });
  });
});

describe('ProfileForm farming fields', () => {
  it('keeps farming unanswered until the citizen answers', () => {
    renderProfile('female', true, { hasFarmingActivity: null });

    expect(screen.getByRole('group', { name: /Are you connected to farming or agriculture\?/ })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Farm size \(decimals\)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Crops you grow/ })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Land you own \(decimals\)/ })).toBeInTheDocument();
  });

  it('shows farm-specific fields only after yes is selected', () => {
    renderProfile('female', true, { hasFarmingActivity: true });

    expect(screen.getByRole('textbox', { name: /Farm size \(decimals\)/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Crops you grow/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Livestock you keep/ })).toBeInTheDocument();
  });

  it('hides and clears farm-specific fields when no is selected', async () => {
    patch.mockClear();
    renderProfile('female', true, {
      hasFarmingActivity: true,
      farmSizeDecimals: 20,
      crops: ['rice'],
      livestock: ['cattle'],
      landOwnershipDecimals: 12,
    });

    const farmingGroup = screen.getByRole('group', { name: /Are you connected to farming or agriculture\?/ });
    fireEvent.click(within(farmingGroup).getByRole('radio', { name: 'No' }));

    expect(screen.queryByRole('textbox', { name: /Farm size \(decimals\)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Crops you grow/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Livestock you keep/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const lastCall = patch.mock.calls.at(-1) as [string, Record<string, unknown>] | undefined;
    expect(lastCall?.[1]).toMatchObject({
      hasFarmingActivity: false,
      farmSizeDecimals: null,
      crops: null,
      livestock: null,
      landOwnershipDecimals: 12,
    });
  });

  it('suggests farming when farmer is selected without overriding an answer', () => {
    expect(suggestFarmingActivity('farmer', undefined)).toBe(true);
    expect(suggestFarmingActivity('farmer', false)).toBe(false);
    expect(suggestFarmingActivity('teacher', undefined)).toBeUndefined();
  });
});
