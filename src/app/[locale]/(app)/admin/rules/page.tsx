import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { desc, eq, and } from 'drizzle-orm';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/db/client';
import { eligibilityRules, opportunities } from '@/lib/db/schema';
import { getFullSession, isStaff } from '@/lib/http/session';
import { collectFields } from '@/lib/domain/rules';
import { fieldLabel } from '@/modules/eligibility/engine';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Chip';
import { Banner } from '@/components/primitives/Banner';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format/dates';

/**
 * Rule inspector — PRD §Feature 20 ("Update Rules") and §77 ("Rule Management").
 *
 * Read-only in this build: rules are PUBLISHED through
 * `POST /api/v1/admin/rules`, which validates the grammar and smoke-tests the
 * rule against synthetic profiles before accepting it. A free-text JSON editor
 * in the browser would let an author save a rule that compiles but can never
 * match anyone, which is the failure mode the smoke test exists to catch.
 * See docs/DEVIATIONS.md §9.
 */
export default async function AdminRulesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const bn = locale === 'bn';

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');
  const tc = await getTranslations('common');

  const rows = await db
    .select({
      rule: eligibilityRules,
      opportunityTitle: opportunities.title,
      opportunityTitleBn: opportunities.titleBn,
      opportunitySlug: opportunities.slug,
    })
    .from(eligibilityRules)
    .innerJoin(opportunities, eq(eligibilityRules.opportunityId, opportunities.id))
    .where(and(eq(eligibilityRules.active, true)))
    .orderBy(desc(eligibilityRules.updatedAt))
    .limit(200);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('rules')}</h1>
      </header>

      <AdminNav />

      <Banner tone="info" statusWord={tc('appName')}>
        {bn
          ? 'নিয়ম সরাসরি এখানে সম্পাদনা করা যায় না। নতুন সংস্করণ API-এর মাধ্যমে প্রকাশ করা হয়, যেখানে ব্যাকরণ যাচাই ও কৃত্রিম প্রোফাইল দিয়ে পরীক্ষা করা হয়।'
          : 'Rules are not edited here. A new version is published through the API, where the grammar is validated and the rule is smoke-tested against synthetic profiles first.'}
      </Banner>

      <ul className="flex flex-col gap-3">
        {rows.map(({ rule, opportunityTitle, opportunityTitleBn, opportunitySlug }) => {
          const fields = [...collectFields(rule.ruleJson.root)];
          const declared = new Set(rule.ruleJson.requiredFields);
          const undeclared = fields.filter((f) => !declared.has(f));

          return (
            <li key={rule.id}>
              <Card padding="default" className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="type-body-lg text-text-primary">
                      <Link
                        href={`/opportunities/${opportunitySlug}`}
                        className="hover:text-text-brand focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                      >
                        {bn ? opportunityTitleBn : opportunityTitle}
                      </Link>
                    </p>
                    <p className="type-caption mt-0.5 text-text-tertiary">
                      v{rule.version} · {formatDate(rule.updatedAt, locale as 'bn' | 'en')}
                      {rule.authoredBy ? ` · ${rule.authoredBy}` : ''}
                    </p>
                  </div>
                  <Badge tone={rule.reviewedBy ? 'success' : 'warning'}>
                    {rule.reviewedBy
                      ? bn ? 'পর্যালোচিত' : 'reviewed'
                      : bn ? 'পর্যালোচনা হয়নি' : 'unreviewed'}
                  </Badge>
                </div>

                <div>
                  <p className="type-label-md mb-2 text-text-secondary">
                    {bn ? 'যেসব তথ্য দেখে সিদ্ধান্ত হয়' : 'Fields this rule reads'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {fields.map((field) => (
                      <Badge key={field} tone={declared.has(field) ? 'brand' : 'warning'}>
                        {fieldLabel(field)[bn ? 'bn' : 'en']}
                      </Badge>
                    ))}
                  </div>
                </div>

                {undeclared.length > 0 ? (
                  <p className="type-body-md flex items-start gap-2 rounded-md bg-surface-warning p-3 text-text-warning">
                    <AlertTriangle size={20} className="icon mt-0.5 shrink-0" aria-hidden="true" />
                    {bn
                      ? `এই তথ্যগুলো পরীক্ষা করা হয় কিন্তু "অবশ্যই দরকার" তালিকায় নেই: ${undeclared.map((f) => fieldLabel(f).bn).join(', ')}। ফলে সিস্টেম এগুলো নিয়ে প্রশ্ন করবে না।`
                      : `Tested but not declared as required: ${undeclared.map((f) => fieldLabel(f).en).join(', ')}. The system will not ask about these.`}
                  </p>
                ) : (
                  <p className="type-body-md flex items-center gap-2 text-text-success">
                    <CheckCircle2 size={20} className="icon shrink-0" aria-hidden="true" />
                    {t('noWarnings')}
                  </p>
                )}

                {rule.ruleJson.notes ? (
                  <p className="type-body-md rounded-md bg-surface-sunken p-3 text-text-secondary">
                    {bn ? rule.ruleJson.notes.bn : rule.ruleJson.notes.en}
                  </p>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const dynamic = 'force-dynamic';
