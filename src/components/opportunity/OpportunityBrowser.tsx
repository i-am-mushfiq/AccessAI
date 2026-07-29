'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search, SlidersHorizontal, Inbox } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { TextField } from '@/components/primitives/TextField';
import { FilterChip } from '@/components/primitives/Chip';
import { Button } from '@/components/primitives/Button';
import { Sheet } from '@/components/primitives/Sheet';
import { RadioGroup } from '@/components/primitives/Choice';
import { EmptyState, SkeletonList } from '@/components/primitives/States';
import { OpportunityListClient } from './OpportunityListClient';
import { Num } from '@/components/primitives/Money';
import type { OpportunityCardData } from './OpportunityCard';
import type { EligibilityOutcome, OpportunityCategory } from '@/lib/domain/enums';

/**
 * Search, filter, and sort controls over the programme list.
 *
 * Filters write to the URL, so the view is shareable and the browser back button
 * behaves as the citizen expects. Sorting lives in a bottom sheet rather than a
 * dropdown, per BDS §10.2.6, since there are four options and a native select on
 * Android is unstyleable and small-targeted.
 */

const CATEGORY_LABELS: Record<string, { bn: string; en: string }> = {
  scholarship: { bn: 'বৃত্তি', en: 'Scholarships' },
  healthcare: { bn: 'চিকিৎসা', en: 'Healthcare' },
  social_welfare: { bn: 'ভাতা', en: 'Allowances' },
  agriculture: { bn: 'কৃষি', en: 'Agriculture' },
  business: { bn: 'ব্যবসা', en: 'Business' },
  legal_aid: { bn: 'আইনি সহায়তা', en: 'Legal aid' },
  employment: { bn: 'কাজ', en: 'Employment' },
  financial: { bn: 'ব্যাংক ও ঋণ', en: 'Finance' },
  training: { bn: 'প্রশিক্ষণ', en: 'Training' },
  disaster: { bn: 'দুর্যোগ', en: 'Disaster' },
  research: { bn: 'গবেষণা', en: 'Research' },
};

export function OpportunityBrowser({
  items,
  total,
  categoryCounts,
  activeCategories,
  activeOutcomes,
  activeSearch,
  activeSort,
  personalised,
}: {
  readonly items: readonly OpportunityCardData[];
  readonly total: number;
  readonly categoryCounts: Record<string, number>;
  readonly activeCategories: readonly OpportunityCategory[];
  readonly activeOutcomes: readonly EligibilityOutcome[];
  readonly activeSearch: string;
  readonly activeSort: 'relevance' | 'deadline' | 'newest' | 'amount';
  readonly personalised: boolean;
}) {
  const t = useTranslations('opportunities');
  const te = useTranslations('eligibility');
  const tc = useTranslations('common');
  const locale = useLocale() as 'bn' | 'en';
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState(activeSearch);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState(activeSort);

  const apply = (next: {
    categories?: readonly string[];
    outcomes?: readonly string[];
    q?: string;
    sort?: string;
  }) => {
    const url = new URLSearchParams();
    for (const category of next.categories ?? activeCategories) url.append('category', category);
    for (const outcome of next.outcomes ?? activeOutcomes) url.append('outcome', outcome);
    const q = next.q ?? search;
    if (q.trim()) url.set('q', q.trim());
    const sortValue = next.sort ?? sort;
    if (sortValue !== 'relevance') url.set('sort', sortValue);

    startTransition(() => {
      router.replace(`${pathname}?${url.toString()}`);
    });
  };

  const toggleCategory = (category: string) => {
    const next = activeCategories.includes(category as OpportunityCategory)
      ? activeCategories.filter((c) => c !== category)
      : [...activeCategories, category as OpportunityCategory];
    apply({ categories: next });
  };

  const toggleOutcome = (outcome: EligibilityOutcome) => {
    const next = activeOutcomes.includes(outcome)
      ? activeOutcomes.filter((o) => o !== outcome)
      : [...activeOutcomes, outcome];
    apply({ outcomes: next });
  };

  const outcomeLabels: Record<EligibilityOutcome, string> = {
    eligible: te('eligible'),
    partially_eligible: te('partiallyEligible'),
    unknown: te('unknown'),
    not_eligible: te('notEligible'),
  };

  return (
    <div className="flex flex-col gap-4">
      {/* -------------------------------------------------------- search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: search });
        }}
        className="flex items-end gap-2"
      >
        <TextField
          label={t('searchPlaceholder')}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          leadingIcon={<Search size={20} className="icon" />}
          clearable
          onClear={() => {
            setSearch('');
            apply({ q: '' });
          }}
          clearLabel={tc('close')}
          containerClassName="flex-1"
        />
        <Button type="submit" size="lg" fullWidth={false} className="mb-6" loading={pending} loadingLabel={tc('loading')}>
          {tc('search')}
        </Button>
      </form>

      {/* ------------------------------------------------------ filters */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar md:-mx-5 md:px-5">
        <Button
          variant="secondary"
          size="sm"
          fullWidth={false}
          onClick={() => setSheetOpen(true)}
          leadingIcon={<SlidersHorizontal size={18} className="icon" />}
        >
          {t('sortRelevance') === activeSort ? tc('sort') : tc('sort')}
        </Button>

        {personalised
          ? (['eligible', 'partially_eligible', 'unknown'] as const).map((outcome) => (
              <FilterChip
                key={outcome}
                label={outcomeLabels[outcome]}
                selected={activeOutcomes.includes(outcome)}
                onToggle={() => toggleOutcome(outcome)}
              />
            ))
          : null}

        {Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([category, count]) => (
            <FilterChip
              key={category}
              label={CATEGORY_LABELS[category] ? CATEGORY_LABELS[category]![locale] : category}
              count={count}
              selected={activeCategories.includes(category as OpportunityCategory)}
              onToggle={() => toggleCategory(category)}
            />
          ))}
      </div>

      <p className="type-body-md tabular text-text-secondary" aria-live="polite">
        {t('resultsCount', { count: total })}
      </p>

      {/* -------------------------------------------------------- results */}
      {pending ? (
        <SkeletonList count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Inbox size={64} className="icon" strokeWidth={1.5} />}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                startTransition(() => router.replace(pathname));
              }}
            >
              {tc('all')}
            </Button>
          }
        />
      ) : (
        <OpportunityListClient initialItems={items} />
      )}

      {/* ---------------------------------------------------- sort sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={tc('sort')}
        closeLabel={tc('close')}
        footer={
          <Button
            onClick={() => {
              setSheetOpen(false);
              apply({ sort });
            }}
          >
            {tc('submit')}
          </Button>
        }
      >
        <RadioGroup
          name="sort"
          legend={tc('sort')}
          value={sort}
          onChange={(value) => setSort(value)}
          options={[
            { value: 'relevance', label: t('sortRelevance') },
            { value: 'deadline', label: t('sortDeadline') },
            { value: 'newest', label: t('sortNewest') },
            { value: 'amount', label: t('sortAmount') },
          ]}
        />
      </Sheet>

      <p className="sr-only" aria-live="polite">
        <Num value={total} />
      </p>
    </div>
  );
}
