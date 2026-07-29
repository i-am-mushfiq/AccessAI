import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import {
  Building2, CalendarClock, FileText, ListOrdered, ExternalLink, MapPin,
  CheckCircle2, XCircle, HelpCircle, Info, AlertTriangle, Clock,
} from 'lucide-react';
import { db } from '@/lib/db/client';
import { documents } from '@/lib/db/schema';
import { getFullSession } from '@/lib/http/session';
import { getOpportunityBySlug, getRelated, recordView } from '@/modules/opportunities/opportunity.service';
import { toEligibilityProfile } from '@/modules/eligibility/profile-mapper';
import { retrieve } from '@/modules/knowledge/retrieval';
import { fieldLabel } from '@/modules/eligibility/engine';
import { Link } from '@/i18n/navigation';
import { Card, Section } from '@/components/primitives/Card';
import { Banner, InfoPanel } from '@/components/primitives/Banner';
import { EligibilityPill, VerificationBadge, ConfidenceMeter, Badge } from '@/components/primitives/Chip';
import { Money } from '@/components/primitives/Money';
import { formatDate, deadlineUrgency, daysUntil } from '@/lib/format/dates';
import { OpportunityActions } from '@/components/opportunity/OpportunityActions';
import { districtLabel } from '@/lib/domain/geography';
import type { EligibilityOutcome } from '@/lib/domain/enums';

/**
 * Programme detail — PRD §63, plus the Trust Dashboard from §Feature 19.
 *
 * Everything §63 lists is present, and the eligibility section shows the FULL
 * per-condition trace from the rule engine rather than a summary: PRD Principle 2
 * requires every recommendation to explain why, and §Feature 6 forbids black-box
 * output. Each condition names what the citizen supplied and what the programme
 * requires, so a "not eligible" is arguable rather than final.
 */
export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const bn = locale === 'bn';

  const [t, te, tt, tc, tp] = await Promise.all([
    getTranslations('opportunities'),
    getTranslations('eligibility'),
    getTranslations('trust'),
    getTranslations('common'),
    getTranslations('plan'),
  ]);

  const session = await getFullSession();
  const profile = session ? toEligibilityProfile({ user: session.user, profile: session.profile }) : {};

  const retrieved = await retrieve(slug.replace(/-/g, ' '), { limit: 8, perOpportunityLimit: 8 });
  const item = await getOpportunityBySlug(slug, profile, session?.userId ?? null, retrieved);
  if (!item) notFound();

  const [related, sourceDocs] = await Promise.all([
    getRelated(item.opportunity.id, 4),
    db
      .select({
        id: documents.id,
        title: documents.title,
        sourceUrl: documents.sourceUrl,
        publisher: documents.publisher,
        retrievedAt: documents.retrievedAt,
        licenseNote: documents.licenseNote,
        verificationStatus: documents.verificationStatus,
      })
      .from(documents)
      .where(eq(documents.opportunityId, item.opportunity.id)),
  ]);

  void recordView(item.opportunity.id).catch(() => undefined);

  const o = item.opportunity;
  const title = bn ? o.titleBn : o.title;
  const deadline = o.deadline;
  const urgency = deadlineUrgency(deadline);
  const days = deadline ? daysUntil(deadline) : null;

  const outcomeLabel: Record<EligibilityOutcome, string> = {
    eligible: te('eligible'),
    partially_eligible: te('partiallyEligible'),
    not_eligible: te('notEligible'),
    unknown: te('unknown'),
  };

  const verificationLabel =
    o.verificationStatus === 'verified'
      ? tt('verified')
      : o.verificationStatus === 'unverified_sample'
        ? tt('unverifiedSample')
        : o.verificationStatus === 'pending_review'
          ? tt('pendingReview')
          : o.verificationStatus === 'outdated'
            ? tt('outdated')
            : tt('disputed');

  return (
    <article className="flex flex-col gap-8 pb-8">
      {/* ------------------------------------------------------- header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{o.category.replace(/_/g, ' ')}</Badge>
          <VerificationBadge status={o.verificationStatus} label={verificationLabel} />
        </div>

        <h1 className="type-heading-lg text-text-primary">{title}</h1>

        <p className="type-body-lg flex items-center gap-2 text-text-secondary">
          <Building2 size={20} className="icon shrink-0" aria-hidden="true" />
          <span>
            {t('issuedBy')}: {bn ? item.organization.nameBn : item.organization.name}
          </span>
        </p>

        <p className="type-body-lg text-text-primary measure">{bn ? o.summaryBn : o.summary}</p>

        {/* Unverified data gets a full banner on the detail page, not just a
            badge — this is the screen a citizen acts from. */}
        {o.verificationStatus === 'unverified_sample' ? (
          <Banner tone="warning" statusWord={tt('unverifiedSample')}>
            {tt('unverifiedExplain')}
          </Banner>
        ) : null}
      </header>

      {/* -------------------------------------------------- key facts */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="compact">
          <dt className="type-caption text-text-secondary">{tc('amount')}</dt>
          <dd className="mt-1">
            <Money amount={o.benefitAmount} size="label" withWords={o.benefitAmount !== null} />
            {o.benefitPeriod ? (
              <span className="type-body-md block text-text-secondary">
                {o.benefitPeriod === 'monthly'
                  ? tc('perMonth')
                  : o.benefitPeriod === 'one_time'
                    ? tc('oneTime')
                    : o.benefitPeriod === 'yearly'
                      ? tc('perYear')
                      : o.benefitPeriod.replace(/_/g, ' ')}
              </span>
            ) : null}
          </dd>
        </Card>

        <Card padding="compact">
          <dt className="type-caption text-text-secondary">{tc('deadline')}</dt>
          <dd
            className={
              urgency === 'critical' || urgency === 'expired'
                ? 'type-label-lg mt-1 tabular text-text-error'
                : urgency === 'soon'
                  ? 'type-label-lg mt-1 tabular text-text-warning'
                  : 'type-label-lg mt-1 tabular text-text-primary'
            }
          >
            <span className="flex items-center gap-1.5">
              <CalendarClock size={20} className="icon shrink-0" aria-hidden="true" />
              {deadline ? formatDate(deadline, locale as 'bn' | 'en') : tc('noDeadline')}
            </span>
            {days !== null ? (
              <span className="type-body-md block text-text-secondary">
                {days >= 0 ? `${days} ${tc('daysLeft')}` : tc('expired')}
              </span>
            ) : null}
          </dd>
        </Card>

        <Card padding="compact">
          <dt className="type-caption text-text-secondary">{t('processingTime')}</dt>
          <dd className="type-label-lg mt-1 text-text-primary">
            {o.processingTimeDays ?? tc('unknown')}
          </dd>
        </Card>
      </dl>

      {/* --------------------------------------------------- eligibility */}
      <Section title={t('detailEligibility')}>
        <Card padding="default" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <EligibilityPill
              outcome={item.evaluation.outcome}
              label={outcomeLabel[item.evaluation.outcome]}
            />
            <span className="type-caption text-text-secondary">
              {te('ruleVersion')} {item.evaluation.ruleVersion}
            </span>
          </div>

          {/* PRD Principle 4 made visible. */}
          <p className="type-body-md flex items-start gap-2 rounded-md bg-surface-info p-3 text-text-link">
            <Info size={20} className="icon mt-0.5 shrink-0" aria-hidden="true" />
            {te('decidedByRules')}
          </p>

          {!session ? (
            <Banner tone="info" statusWord={tc('signIn')}>
              {bn
                ? 'সাইন ইন করলে আপনার তথ্য দিয়ে যোগ্যতা যাচাই করে দেখাতে পারব।'
                : 'Sign in and we can check your eligibility using your own details.'}
            </Banner>
          ) : null}

          {/* ---- met ---- */}
          {item.evaluation.matched.length > 0 ? (
            <div>
              <h3 className="type-heading-sm mb-3 flex items-center gap-2 text-text-success">
                <CheckCircle2 size={20} className="icon shrink-0" aria-hidden="true" />
                {te('conditionsMet')}
              </h3>
              <ul className="flex flex-col gap-2">
                {item.evaluation.matched.map((condition) => (
                  <li key={condition.id} className="rounded-md bg-surface-success p-3">
                    <p className="type-body-lg text-text-primary">
                      {bn ? condition.reason.bn : condition.reason.en}
                    </p>
                    <p className="type-caption mt-1 text-text-secondary">
                      {fieldLabel(condition.field)[bn ? 'bn' : 'en']}
                      {condition.actual !== undefined ? ` · ${te('youProvided')}: ${String(condition.actual)}` : ''}
                      {condition.soft ? ` · ${te('softCondition')}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ---- failed ---- */}
          {item.evaluation.failed.length > 0 ? (
            <div>
              <h3 className="type-heading-sm mb-3 flex items-center gap-2 text-text-error">
                <XCircle size={20} className="icon shrink-0" aria-hidden="true" />
                {te('conditionsFailed')}
              </h3>
              <ul className="flex flex-col gap-2">
                {item.evaluation.failed.map((condition) => (
                  <li key={condition.id} className="rounded-md bg-surface-error p-3">
                    <p className="type-body-lg text-text-primary">
                      {bn ? condition.reason.bn : condition.reason.en}
                    </p>
                    <p className="type-caption mt-1 text-text-secondary">
                      {condition.actual !== undefined ? `${te('youProvided')}: ${String(condition.actual)}` : ''}
                      {condition.expected !== undefined
                        ? ` · ${te('programmeRequires')}: ${String(condition.expected)}`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ---- soft failures ---- */}
          {item.evaluation.softFailed.length > 0 ? (
            <div>
              <h3 className="type-heading-sm mb-2 flex items-center gap-2 text-text-warning">
                <AlertTriangle size={20} className="icon shrink-0" aria-hidden="true" />
                {te('softCondition')}
              </h3>
              <p className="type-body-md mb-2 text-text-secondary">{te('softConditionBody')}</p>
              <ul className="flex flex-col gap-2">
                {item.evaluation.softFailed.map((condition) => (
                  <li key={condition.id} className="rounded-md bg-surface-warning p-3">
                    <p className="type-body-lg text-text-primary">
                      {bn ? condition.reason.bn : condition.reason.en}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ---- unknown ---- */}
          {item.evaluation.unknown.length > 0 ? (
            <div>
              <h3 className="type-heading-sm mb-3 flex items-center gap-2 text-text-link">
                <HelpCircle size={20} className="icon shrink-0" aria-hidden="true" />
                {te('whatWeNeed')}
              </h3>
              <ul className="flex flex-col gap-2">
                {item.evaluation.unknown.map((condition) => (
                  <li key={condition.id} className="rounded-md bg-surface-info p-3">
                    <p className="type-body-lg text-text-primary">
                      {bn ? condition.reason.bn : condition.reason.en}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                href="/profile"
                className="mt-3 inline-flex min-h-14 items-center justify-center rounded-md border-1.5 border-stroke px-6 type-label-lg text-text-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
              >
                {te('answerToDecide')}
              </Link>
            </div>
          ) : null}

          {item.evaluation.ruleVersion === 0 ? (
            <Banner tone="warning" statusWord={tc('unknown')}>
              {bn
                ? 'এই কর্মসূচির যোগ্যতার নিয়ম এখনো লেখা হয়নি, তাই আমরা সিদ্ধান্ত জানাতে পারছি না।'
                : 'Eligibility rules have not been authored for this programme yet, so we cannot give a verdict.'}
            </Banner>
          ) : null}
        </Card>
      </Section>

      {/* ------------------------------------------------------ actions */}
      <OpportunityActions
        opportunityId={o.id}
        slug={o.slug}
        saved={item.saved}
        applyUrl={o.applyUrl}
        officialUrl={o.officialUrl}
        hasSteps={o.applicationProcess.length > 0}
      />

      {/* ----------------------------------------------------- benefits */}
      <Section title={t('detailBenefits')}>
        <Card padding="default">
          <p className="type-body-lg text-text-primary measure">{bn ? o.benefitsBn : o.benefits}</p>
        </Card>
      </Section>

      {/* -------------------------------------------------- description */}
      <Section title={t('detailOverview')}>
        <Card padding="default">
          <p className="type-body-lg whitespace-pre-line text-text-primary measure">
            {bn ? o.descriptionBn : o.description}
          </p>
          <dl className="mt-4 flex flex-col gap-2 border-t border-stroke-subtle pt-4">
            <div className="flex flex-wrap gap-2">
              <dt className="type-label-md text-text-secondary">{t('coverageDistricts')}:</dt>
              <dd className="type-body-md text-text-primary">
                {o.coverageDistricts.length === 0
                  ? t('coverageNationwide')
                  : o.coverageDistricts.map((d) => districtLabel(d, locale as 'bn' | 'en')).join(', ')}
              </dd>
            </div>
            {o.renewalMonths ? (
              <div className="flex flex-wrap gap-2">
                <dt className="type-label-md text-text-secondary">
                  {bn ? 'নবায়ন' : 'Renewal'}:
                </dt>
                <dd className="type-body-md tabular text-text-primary">
                  {bn ? `${o.renewalMonths} মাস পর` : `every ${o.renewalMonths} months`}
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </Section>

      {/* ---------------------------------------------------- documents */}
      <Section title={t('detailDocuments')}>
        {item.documents.length === 0 ? (
          <Card padding="default">
            <p className="type-body-lg text-text-secondary">{tc('unknown')}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {item.documents.map((doc) => (
              <li key={doc.id}>
                <Card padding="default" className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="type-body-lg flex items-start gap-2 text-text-primary">
                      <FileText size={20} className="icon mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
                      {bn ? doc.nameBn : doc.name}
                    </p>
                    <Badge tone={doc.required ? 'error' : 'neutral'}>
                      {doc.required ? t('requiredDoc') : t('optionalDoc')}
                    </Badge>
                  </div>

                  {doc.issuingAuthority ? (
                    <p className="type-body-md text-text-secondary">
                      {t('issuedBy')}: {bn ? doc.issuingAuthorityBn : doc.issuingAuthority}
                    </p>
                  ) : null}

                  {/* PRD Feature 8 explicitly asks for common mistakes. */}
                  {doc.commonMistake ? (
                    <p className="type-body-md rounded-md bg-surface-error px-3 py-2 text-text-error">
                      <strong>{t('commonMistake')}: </strong>
                      {bn ? doc.commonMistakeBn : doc.commonMistake}
                    </p>
                  ) : null}
                  {doc.tip ? (
                    <p className="type-body-md rounded-md bg-surface-info px-3 py-2 text-text-link">
                      <strong>{t('tip')}: </strong>
                      {bn ? doc.tipBn : doc.tip}
                    </p>
                  ) : null}
                  {doc.validityMonths ? (
                    <p className="type-caption flex items-center gap-1.5 text-text-secondary">
                      <Clock size={16} className="icon" aria-hidden="true" />
                      {bn
                        ? `${doc.validityMonths} মাসের মধ্যে ইস্যু করা হতে হবে`
                        : `Must be issued within ${doc.validityMonths} months`}
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ------------------------------------------------------ process */}
      <Section title={t('detailProcess')}>
        <Card padding="default">
          <ol className="flex flex-col gap-4">
            {o.applicationProcess.map((step) => (
              <li key={step.step} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-ramp-green-600 type-label-md tabular text-white"
                >
                  {step.step}
                </span>
                <span className="type-body-lg pt-1 text-text-primary measure">{bn ? step.bn : step.en}</span>
              </li>
            ))}
          </ol>
          {o.applicationProcess.length === 0 ? (
            <p className="type-body-lg flex items-center gap-2 text-text-secondary">
              <ListOrdered size={20} className="icon" aria-hidden="true" />
              {tc('unknown')}
            </p>
          ) : null}
        </Card>
      </Section>

      {/* ------------------------------------------------- trust panel */}
      <Section title={tt('whyThisConfidence')}>
        <Card padding="default" className="flex flex-col gap-4">
          <ConfidenceMeter
            value={item.confidence.score}
            label={tt('confidence')}
            bandLabel={
              item.confidence.band === 'high'
                ? tt('high')
                : item.confidence.band === 'medium'
                  ? tt('medium')
                  : tt('low')
            }
          />

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ['factorRetrieval', item.confidence.factors.retrievalQuality],
                ['factorRules', item.confidence.factors.ruleCompleteness],
                ['factorSources', item.confidence.factors.supportingSources],
                ['factorFreshness', item.confidence.factors.dataFreshness],
                ['factorMetadata', item.confidence.factors.metadataQuality],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-md bg-surface-sunken px-3 py-2">
                <dt className="type-body-md text-text-secondary">{tt(key)}</dt>
                <dd className="type-label-md tabular text-text-primary">{value}%</dd>
              </div>
            ))}
          </dl>

          {item.confidence.reasons.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {item.confidence.reasons.map((reason, index) => (
                <li key={index} className="type-body-md flex items-start gap-2 text-text-primary">
                  <Info size={18} className="icon mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
                  {bn ? reason.bn : reason.en}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="type-caption text-text-secondary">
            {tt('lastVerified')}:{' '}
            {o.lastVerifiedAt ? formatDate(o.lastVerifiedAt, locale as 'bn' | 'en') : tt('neverVerified')}
          </p>
        </Card>
      </Section>

      {/* ----------------------------------------------------- sources */}
      <Section title={t('detailSources')}>
        {sourceDocs.length === 0 && !o.sourceUrl ? (
          <Card padding="default">
            <p className="type-body-lg text-text-secondary">{tc('unknown')}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {o.sourceUrl ? (
              <li>
                <Card padding="compact">
                  <a
                    href={o.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-body-lg inline-flex min-h-12 items-center gap-2 text-text-link underline"
                  >
                    <ExternalLink size={20} className="icon shrink-0" aria-hidden="true" />
                    {o.sourceUrl}
                  </a>
                </Card>
              </li>
            ) : null}
            {sourceDocs.map((doc) => (
              <li key={doc.id}>
                <Card padding="compact" className="flex flex-col gap-1">
                  <p className="type-body-lg text-text-primary">{doc.title}</p>
                  {doc.publisher ? (
                    <p className="type-body-md text-text-secondary">{doc.publisher}</p>
                  ) : null}
                  {doc.licenseNote ? (
                    <p className="type-caption text-text-tertiary">{doc.licenseNote}</p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ---------------------------------------------------- related */}
      {related.length > 0 ? (
        <Section title={t('detailRelated')} description={bn ? 'একই পরিস্থিতিতে যেগুলো কাজে লাগে।' : 'Things that help in the same situation.'}>
          <ul className="flex flex-col gap-2">
            {related.map((rel) => (
              <li key={rel.id}>
                <Link
                  href={`/opportunities/${rel.slug}`}
                  className="flex min-h-16 items-center gap-3 rounded-md border border-stroke-subtle bg-surface px-4 py-3 hover:border-stroke-brand hover:bg-surface-brand-subtle focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
                >
                  <span className="type-body-lg min-w-0 flex-1 text-text-primary">
                    {bn ? rel.titleBn : rel.title}
                  </span>
                  <Badge tone="neutral">{rel.category.replace(/_/g, ' ')}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* -------------------------------------------------- nearby link */}
      <InfoPanel title={t('detailNearby')}>
        <Link
          href={`/nearby?opportunitySlug=${o.slug}`}
          className="inline-flex min-h-12 items-center gap-2 text-text-link underline"
        >
          <MapPin size={20} className="icon" aria-hidden="true" />
          {t('detailNearby')}
        </Link>
      </InfoPanel>

      <p className="sr-only">{tp('title')}</p>
    </article>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const item = await getOpportunityBySlug(slug, {}, null);
  if (!item) return { title: 'Not found' };
  return {
    title: locale === 'bn' ? item.opportunity.titleBn : item.opportunity.title,
    description: locale === 'bn' ? item.opportunity.summaryBn : item.opportunity.summary,
  };
}

export const dynamic = 'force-dynamic';
