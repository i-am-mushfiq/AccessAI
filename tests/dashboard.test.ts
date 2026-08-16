import { describe, expect, it } from 'vitest';
import { DASHBOARD_SECTION_ORDER, hasDashboardUrgency, recommendationState } from '@/modules/dashboard/presentation';
import { catalog, LOCALE_INDEX, project } from '@/messages/catalog';

describe('dashboard information hierarchy', () => {
  it('keeps personalised value before generic navigation', () => {
    expect(DASHBOARD_SECTION_ORDER).toEqual([
      'recommendations',
      'urgency',
      'profile_completeness',
      'quick_actions',
      'saved',
    ]);
  });

  it('distinguishes matches, incomplete profiles, and complete profiles with no match', () => {
    expect(recommendationState(2, 0)).toBe('matches');
    expect(recommendationState(0, 3)).toBe('improve_profile');
    expect(recommendationState(0, 0)).toBe('no_match');
  });

  it('shows urgency only when a real task or deadline exists', () => {
    expect(hasDashboardUrgency(0, 0)).toBe(false);
    expect(hasDashboardUrgency(1, 0)).toBe(true);
    expect(hasDashboardUrgency(0, 1)).toBe(true);
  });

  it('keeps the dashboard hierarchy localized in Bengali and English', () => {
    const bn = project(catalog, LOCALE_INDEX.bn) as { dashboard: { recommendedTitle: string; savedTitle: string } };
    const en = project(catalog, LOCALE_INDEX.en) as { dashboard: { recommendedTitle: string; savedTitle: string } };
    expect(bn.dashboard.recommendedTitle).toBe('আপনার জন্য সুপারিশ');
    expect(en.dashboard.recommendedTitle).toBe('Recommended for you');
    expect(bn.dashboard.savedTitle).toBe('সেভ করা কর্মসূচি');
    expect(en.dashboard.savedTitle).toBe('Saved programmes');
  });
});
