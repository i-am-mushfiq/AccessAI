import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { desc } from 'drizzle-orm';
import {
  Users, Database, ShieldCheck, Cpu, AlertTriangle, Activity, ClipboardList, TrendingUp,
} from 'lucide-react';
import { db } from '@/lib/db/client';
import { auditLog } from '@/lib/db/schema';
import { getFullSession, isStaff } from '@/lib/http/session';
import { getAnalytics, getSystemHealth } from '@/modules/admin/admin.service';
import { Card, Section } from '@/components/primitives/Card';
import { Banner } from '@/components/primitives/Banner';
import { Badge } from '@/components/primitives/Chip';
import { Num } from '@/components/primitives/Money';
import { AdminJobs } from '@/components/admin/AdminJobs';
import { AdminNav } from '@/components/admin/AdminNav';
import { formatTimeAgo } from '@/lib/format/dates';

/**
 * Admin overview — PRD §77, §78, §120.
 *
 * The panel leads with KNOWLEDGE HEALTH rather than user counts, because for
 * this product the corpus is the substance: 42 programmes of which none are
 * verified is the single most important fact an operator needs, and burying it
 * under a DAU chart would hide the thing that determines whether citizens are
 * being told the truth.
 */
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const bn = locale === 'bn';

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');
  const tt = await getTranslations('trust');

  const [analytics, health, recentAudit] = await Promise.all([
    getAnalytics(),
    getSystemHealth(),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(10),
  ]);

  const unverifiedShare =
    analytics.knowledge.programmes === 0
      ? 0
      : Math.round((analytics.knowledge.unverifiedSample / analytics.knowledge.programmes) * 100);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-md mt-1 text-text-secondary">
          {session.user.name} · <Badge tone="brand">{session.user.role.replace(/_/g, ' ')}</Badge>
        </p>
      </header>

      <AdminNav />

      {/* The most important operational fact, stated first and plainly. */}
      {analytics.knowledge.unverifiedSample > 0 ? (
        <Banner tone="warning" statusWord={tt('unverifiedSample')}>
          {bn
            ? `${analytics.knowledge.programmes}টি কর্মসূচির মধ্যে ${analytics.knowledge.unverifiedSample}টি (${unverifiedShare}%) এখনো যাচাই করা হয়নি। নাগরিকদের কাছে এগুলো "নমুনা তথ্য" হিসেবে দেখানো হচ্ছে এবং আস্থার মাত্রা ৬৫%-এ সীমিত রাখা হয়েছে।`
            : `${analytics.knowledge.unverifiedSample} of ${analytics.knowledge.programmes} programmes (${unverifiedShare}%) are not yet verified. Citizens see these labelled as sample data, and their confidence is capped at 65%.`}
        </Banner>
      ) : null}

      {analytics.knowledge.missingRules > 0 ? (
        <Banner tone="error" statusWord={t('missingRules')}>
          {bn
            ? `${analytics.knowledge.missingRules}টি কর্মসূচিতে যোগ্যতার নিয়ম নেই। ${t('missingRulesWarning')}`
            : `${analytics.knowledge.missingRules} programmes have no eligibility rules. ${t('missingRulesWarning')}`}
        </Banner>
      ) : null}

      {/* ------------------------------------------------ knowledge health */}
      <Section title={`${t('programmes')} — ${bn ? 'অবস্থা' : 'health'}`}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Database} label={t('programmes')} value={analytics.knowledge.programmes} />
          <Stat icon={ShieldCheck} label={tt('verified')} value={analytics.knowledge.verified} tone="success" />
          <Stat
            icon={AlertTriangle}
            label={tt('unverifiedSample')}
            value={analytics.knowledge.unverifiedSample}
            tone="warning"
          />
          <Stat
            icon={AlertTriangle}
            label={t('missingRules')}
            value={analytics.knowledge.missingRules}
            tone={analytics.knowledge.missingRules > 0 ? 'error' : 'neutral'}
          />
          <Stat icon={Database} label={t('organizations')} value={analytics.knowledge.organisations} />
          <Stat icon={Database} label={bn ? 'সেবা কেন্দ্র' : 'Service locations'} value={analytics.knowledge.locations} />
          <Stat icon={AlertTriangle} label={tt('outdated')} value={analytics.knowledge.outdated} tone="warning" />
          <Stat icon={AlertTriangle} label={bn ? 'পুরনো নথি' : 'Stale documents'} value={analytics.knowledge.staleDocuments} tone="warning" />
        </dl>
      </Section>

      {/* --------------------------------------------------------- AI ops */}
      <Section title={t('aiLogs')}>
        <Card padding="default" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={health.ai.isLive ? 'success' : 'info'}>
              <Cpu size={18} className="icon" aria-hidden="true" />
              {health.ai.status === 'simulated'
                ? (bn ? 'সিমুলেটেড এআই' : 'Simulated AI')
                : health.ai.status === 'configuration-error'
                  ? (bn ? 'প্রোভাইডার কনফিগারেশন সমস্যা' : 'Provider configuration error')
                  : health.ai.status === 'runtime-failure'
                    ? (bn ? 'প্রোভাইডার ব্যর্থ — fallback চালু' : 'Provider failed — fallback active')
                    : `${health.ai.mode} configured`}
              {' · '}{health.ai.model}
            </Badge>
            <Badge tone="neutral">{health.retrieval.mode}</Badge>
          </div>
          <p className="type-body-md text-text-secondary measure">{health.ai.note}</p>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Activity} label={bn ? 'অনুরোধ' : 'Requests'} value={analytics.ai.requests} />
            <Stat icon={Activity} label={bn ? 'গড় সময় (মিসে)' : 'Avg latency (ms)'} value={analytics.ai.avgLatencyMs} />
            <Stat icon={Activity} label={bn ? 'p95 সময় (মিসে)' : 'p95 latency (ms)'} value={analytics.ai.p95LatencyMs} />
            <Stat
              icon={AlertTriangle}
              label={t('groundingFailures')}
              value={analytics.ai.groundingFailures}
              tone={analytics.ai.groundingFailures > 0 ? 'error' : 'success'}
            />
          </dl>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-surface-sunken px-3 py-2">
              <dt className="type-caption text-text-secondary">
                {bn ? 'উৎস উদ্ধৃতির হার' : 'Citation coverage'}
              </dt>
              <dd className="type-heading-sm tabular text-text-primary">{analytics.ai.citationCoverage}%</dd>
            </div>
            <div className="rounded-md bg-surface-sunken px-3 py-2">
              <dt className="type-caption text-text-secondary">
                {bn ? 'গড় আস্থা' : 'Average confidence'}
              </dt>
              <dd className="type-heading-sm tabular text-text-primary">{analytics.ai.avgConfidence}%</dd>
            </div>
          </dl>

          <p className="type-caption text-text-tertiary">
            {bn
              ? `রিট্রিভাল ইনডেক্স: ${health.retrieval.chunks}টি চাঙ্ক, ${health.retrieval.embedded}টিতে ভেক্টর আছে।`
              : `Retrieval index: ${health.retrieval.chunks} chunks, ${health.retrieval.embedded} with vectors.`}
          </p>
        </Card>
      </Section>

      {/* ---------------------------------------------------- engagement */}
      <Section title={t('analytics')}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Users} label={bn ? 'ব্যবহারকারী' : 'Users'} value={analytics.users.total} />
          <Stat icon={Users} label={bn ? '৭ দিনে সক্রিয়' : 'Active (7d)'} value={analytics.users.activeLast7Days} />
          <Stat icon={ClipboardList} label={bn ? 'কথা' : 'Conversations'} value={analytics.engagement.conversations} />
          <Stat icon={ClipboardList} label={bn ? 'সেভ' : 'Saves'} value={analytics.engagement.saves} />
          <Stat icon={TrendingUp} label={bn ? 'আবেদন শুরু' : 'Applications'} value={analytics.engagement.applications} tone="success" />
          <Stat icon={ClipboardList} label={bn ? 'পরিকল্পনা' : 'Action plans'} value={analytics.engagement.actionPlans} />
          <Stat icon={ClipboardList} label={bn ? 'সম্পন্ন পরিকল্পনা' : 'Completed plans'} value={analytics.engagement.completedActionPlans} tone="success" />
          <Stat icon={Activity} label={bn ? 'অনুসন্ধান' : 'Searches'} value={analytics.engagement.searches} />
        </dl>
      </Section>

      {/* -------------------------------------------------- eligibility */}
      <Section title={bn ? 'যোগ্যতার সিদ্ধান্ত' : 'Eligibility decisions'}>
        <Card padding="default">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={ShieldCheck} label={bn ? 'যোগ্য' : 'Eligible'} value={analytics.eligibility.eligible} tone="success" />
            <Stat icon={AlertTriangle} label={bn ? 'আংশিক' : 'Partial'} value={analytics.eligibility.partiallyEligible} tone="warning" />
            <Stat icon={AlertTriangle} label={bn ? 'তথ্য দরকার' : 'Unknown'} value={analytics.eligibility.unknown} tone="info" />
            <Stat icon={AlertTriangle} label={bn ? 'প্রযোজ্য নয়' : 'Not eligible'} value={analytics.eligibility.notEligible} />
          </dl>
          <p className="type-caption mt-3 text-text-tertiary measure">
            {bn
              ? '"তথ্য দরকার" বেশি হওয়া মানে প্রোফাইল অসম্পূর্ণ — এটি সমস্যা নয়, বরং সিস্টেম অনুমান না করে জিজ্ঞাসা করছে।'
              : 'A high "unknown" count means incomplete profiles — not a fault, but the system asking instead of guessing.'}
          </p>
        </Card>
      </Section>

      {/* --------------------------------------------------------- jobs */}
      <Section title={t('jobs')}>
        <AdminJobs
          runs={health.jobs.map((run) => ({
            id: run.id,
            job: run.job,
            status: run.status,
            startedAt: run.startedAt.toISOString(),
            finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
            processed: run.processed,
            detail: run.detail,
          }))}
        />
      </Section>

      {/* ---------------------------------------------------- audit log */}
      <Section title={t('auditLog')}>
        <Card padding="none">
          <ul className="divide-y divide-stroke-subtle">
            {recentAudit.length === 0 ? (
              <li className="px-4 py-3">
                <p className="type-body-md text-text-secondary">—</p>
              </li>
            ) : (
              recentAudit.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="type-body-md block text-text-primary">{entry.action}</span>
                    <span className="type-caption block text-text-secondary">
                      {entry.entityType}
                      {entry.actorRole ? ` · ${entry.actorRole}` : ''}
                    </span>
                  </span>
                  <span className="type-caption shrink-0 text-text-tertiary">
                    {formatTimeAgo(entry.createdAt, locale as 'bn' | 'en')}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </Section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  readonly icon: typeof Users;
  readonly label: string;
  readonly value: number;
  readonly tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-text-success'
      : tone === 'warning'
        ? 'text-text-warning'
        : tone === 'error'
          ? 'text-text-error'
          : tone === 'info'
            ? 'text-text-link'
            : 'text-text-primary';

  return (
    <div className="rounded-lg border border-stroke-subtle bg-surface p-4 shadow-elev-1">
      <dt className="type-caption flex items-center gap-1.5 text-text-secondary">
        <Icon size={16} className="icon shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{label}</span>
      </dt>
      <dd className={`type-heading-md mt-1 tabular ${toneClass}`}>
        <Num value={value} />
      </dd>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
