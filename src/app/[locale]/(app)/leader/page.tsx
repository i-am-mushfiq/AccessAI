import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Landmark, Flag, AlertTriangle, ClipboardList, Users, Wallet, ShieldAlert } from 'lucide-react';
import { getFullSession } from '@/lib/http/session';
import { getLeaderPortalData, type OversightScope } from '@/modules/oversight/oversight.service';
import { Card, Section } from '@/components/primitives/Card';
import { EmptyState } from '@/components/primitives/States';
import { Money, Num } from '@/components/primitives/Money';

/**
 * SJ-25/28/29 — the Leader Portal. Scope comes only from the viewer's own
 * civic role (never a query parameter — see the identical rule in
 * modules/oversight/oversight.service.ts's callers), so an upazila/zila
 * officer sees the rollup across every union under them and a chairman sees
 * exactly their own union, with the same code path either way.
 */
export default async function LeaderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  const { user } = session;

  let scope: OversightScope | null = null;
  if ((user.civicRole === 'union_chairman' || user.civicRole === 'union_staff') && user.civicUnionId) {
    scope = { kind: 'union', unionId: user.civicUnionId };
  } else if (user.civicRole === 'upazila_officer' && user.civicUpazila) {
    scope = { kind: 'upazila', upazila: user.civicUpazila };
  } else if (user.civicRole === 'zila_officer' && user.civicDistrict) {
    scope = { kind: 'district', district: user.civicDistrict };
  }

  const t = await getTranslations('leader');
  if (!scope) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        </header>
        <EmptyState title={t('notLeader')} icon={<Landmark size={64} className="icon" strokeWidth={1.5} />} />
      </div>
    );
  }

  const data = await getLeaderPortalData(scope);
  const bn = locale === 'bn';
  const scopeLabel = scope.kind === 'union' ? t('scopeUnion') : scope.kind === 'upazila' ? t('scopeUpazila') : t('scopeDistrict');

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('title')}</h1>
        <p className="type-body-lg mt-2 text-text-secondary">{t('subtitle')}</p>
        <p className="type-caption mt-1 text-text-tertiary">
          {scopeLabel} · {data.unions.map((u) => (bn ? u.nameBn : u.name)).join(', ')}
        </p>
      </header>

      <Section title={t('allocationsTotal')}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Wallet} label={t('allocationsTotal')} money={data.allocations.sum} />
          <Stat icon={ClipboardList} label={bn ? 'মোট বরাদ্দের সংখ্যা' : 'Allocation count'} value={data.allocations.total} />
          <Stat icon={Flag} label={t('allocationsFlagged')} value={data.allocations.flagged} tone={data.allocations.flagged > 0 ? 'warning' : 'neutral'} />
          <Stat icon={AlertTriangle} label={t('allocationsEscalated')} value={data.allocations.escalated} tone={data.allocations.escalated > 0 ? 'error' : 'neutral'} />
        </dl>
      </Section>

      <Section title={t('issuesTotal')}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={ClipboardList} label={t('issuesTotal')} value={data.issues.total} />
          {Object.entries(data.issues.byStatus).map(([status, count]) => (
            <Stat key={status} icon={ClipboardList} label={status.replace(/_/g, ' ')} value={count} />
          ))}
        </dl>
      </Section>

      <Section title={t('beneficiariesTotal')}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Users} label={t('beneficiariesTotal')} value={data.beneficiaries.total} />
          <Stat icon={Wallet} label={t('disbursedPaid')} money={data.beneficiaries.disbursedPaid} tone="success" />
          <Stat icon={Wallet} label={t('disbursedScheduled')} money={data.beneficiaries.disbursedScheduled} />
        </dl>
      </Section>

      <Section title={t('anomalies')}>
        {data.anomalies.length === 0 ? (
          <EmptyState title={t('noAnomalies')} icon={<ShieldAlert size={64} className="icon" strokeWidth={1.5} />} />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.anomalies.map((a, i) => (
              <li key={`${a.kind}-${i}`}>
                <Card padding="default" className="flex items-start gap-3">
                  <AlertTriangle
                    size={20}
                    className={`icon mt-0.5 shrink-0 ${a.severity === 'high' ? 'text-ramp-error-600' : a.severity === 'medium' ? 'text-ramp-amber-600' : 'text-text-tertiary'}`}
                    aria-hidden="true"
                  />
                  <p className="type-body-md text-text-primary">{bn ? a.message[1] : a.message[0]}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  money,
  tone = 'neutral',
}: {
  readonly icon: typeof Landmark;
  readonly label: string;
  readonly value?: number;
  readonly money?: number;
  readonly tone?: 'neutral' | 'success' | 'warning' | 'error';
}) {
  const toneClass =
    tone === 'success' ? 'text-text-success' : tone === 'warning' ? 'text-text-warning' : tone === 'error' ? 'text-text-error' : 'text-text-primary';

  return (
    <div className="rounded-lg border border-stroke-subtle bg-surface p-4 shadow-elev-1">
      <dt className="type-caption flex items-center gap-1.5 text-text-secondary">
        <Icon size={16} className="icon shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate capitalize">{label}</span>
      </dt>
      <dd className={`type-heading-md mt-1 tabular ${toneClass}`}>
        {money !== undefined ? <Money amount={money} decimals={0} size="label" /> : <Num value={value ?? 0} />}
      </dd>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'leader' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
