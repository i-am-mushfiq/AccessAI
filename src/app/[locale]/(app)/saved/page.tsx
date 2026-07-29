import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import { getFullSession } from '@/lib/http/session';
import { listSaved, savedCounts, listActionPlans } from '@/modules/citizen/citizen.service';
import { Link } from '@/i18n/navigation';
import { Section } from '@/components/primitives/Card';
import { EmptyState } from '@/components/primitives/States';
import { SavedBoard } from '@/components/saved/SavedBoard';
import { ActionPlanList } from '@/components/saved/ActionPlanList';

/**
 * Saved programmes and action plans — PRD §66 and §Feature 18.
 *
 * The tracker and the plans live on one screen because they are two views of the
 * same commitment: the status says where the citizen is, the plan says what to do
 * next. Splitting them would make "what should I do today?" a two-tap question.
 */
export default async function SavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('saved');
  const tp = await getTranslations('plan');

  const [saved, counts, plans] = await Promise.all([
    listSaved(session.userId),
    savedCounts(session.userId),
    listActionPlans(session.userId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
      </header>

      {saved.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={64} className="icon" strokeWidth={1.5} />}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          action={
            <Link
              href="/opportunities"
              className="inline-flex min-h-14 w-full items-center justify-center rounded-md bg-ramp-green-600 px-6 type-label-lg text-text-on-brand hover:bg-ramp-green-700 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
            >
              {t('exploreButton')}
            </Link>
          }
        />
      ) : (
        <SavedBoard
          items={saved.map((entry) => ({
            savedId: entry.saved.id,
            status: entry.saved.status,
            note: entry.saved.note,
            updatedAt: entry.saved.updatedAt.toISOString(),
            opportunity: {
              id: entry.opportunity.id,
              slug: entry.opportunity.slug,
              title: entry.opportunity.title,
              titleBn: entry.opportunity.titleBn,
              category: entry.opportunity.category,
              deadline: entry.opportunity.deadline ? entry.opportunity.deadline.toISOString() : null,
              benefitAmount: entry.opportunity.benefitAmount,
              verificationStatus: entry.opportunity.verificationStatus,
            },
            organization: { name: entry.organization.name, nameBn: entry.organization.nameBn },
          }))}
          counts={counts}
        />
      )}

      <Section title={tp('title')}>
        {plans.length === 0 ? (
          <EmptyState title={tp('emptyTitle')} description={tp('emptyBody')} />
        ) : (
          <ActionPlanList
            plans={plans.map((entry) => ({
              id: entry.plan.id,
              title: entry.plan.title,
              titleBn: entry.plan.titleBn,
              status: entry.plan.status,
              opportunitySlug: entry.opportunity.slug,
              tasks: entry.tasks.map((task) => ({
                id: task.id,
                title: task.title,
                titleBn: task.titleBn,
                description: task.description,
                descriptionBn: task.descriptionBn,
                dueDate: task.dueDate ? task.dueDate.toISOString() : null,
                priority: task.priority,
                status: task.status,
                estimatedMinutes: task.estimatedMinutes,
                notes: task.notes,
              })),
            }))}
          />
        )}
      </Section>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'saved' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
