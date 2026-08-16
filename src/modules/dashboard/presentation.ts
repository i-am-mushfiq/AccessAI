export const DASHBOARD_SECTION_ORDER = [
  'recommendations',
  'urgency',
  'profile_completeness',
  'quick_actions',
  'saved',
] as const;

export type DashboardRecommendationState = 'matches' | 'improve_profile' | 'no_match';

export function recommendationState(itemCount: number, suggestedFieldCount: number): DashboardRecommendationState {
  if (itemCount > 0) return 'matches';
  return suggestedFieldCount > 0 ? 'improve_profile' : 'no_match';
}

export function hasDashboardUrgency(todayTaskCount: number, upcomingCount: number): boolean {
  return todayTaskCount > 0 || upcomingCount > 0;
}
