import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { getFullSession, isStaff } from '@/lib/http/session';
import { verifyLedgerChain } from '@/modules/ledger/ledger.service';
import { verifyAuditChain } from '@/modules/admin/admin.service';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, Section } from '@/components/primitives/Card';

/**
 * SJ-13/14's payoff, made visible: walks both hash chains independently and
 * reports exactly where either breaks, if it does. Not the public
 * transparency surface SJ-37 asks for (Phase 4) — an internal integrity
 * check for staff.
 */
export default async function AdminLedgerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');
  const [ledger, auditLog] = await Promise.all([verifyLedgerChain(), verifyAuditChain()]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('ledgerIntegrity')}</h1>
      </header>

      <AdminNav />

      <Section title={t('financialLedger')}>
        <IntegrityCard intact={ledger.intact} checked={ledger.checked} reason={ledger.reason} brokenAtId={ledger.brokenAtId} />
      </Section>

      <Section title={t('auditLogChain')}>
        <IntegrityCard intact={auditLog.intact} checked={auditLog.checked} reason={auditLog.reason} brokenAtId={auditLog.brokenAtId} />
      </Section>
    </div>
  );
}

function IntegrityCard({
  intact,
  checked,
  reason,
  brokenAtId,
}: {
  readonly intact: boolean;
  readonly checked: number;
  readonly reason: string | null;
  readonly brokenAtId: string | null;
}) {
  return (
    <Card padding="default" className="flex items-start gap-3">
      {intact ? (
        <ShieldCheck size={28} className="icon mt-0.5 shrink-0 text-ramp-green-600" aria-hidden="true" />
      ) : (
        <ShieldAlert size={28} className="icon mt-0.5 shrink-0 text-ramp-error-600" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="type-body-lg text-text-primary">
          {intact ? `${checked} entries verified — chain intact` : 'Chain broken'}
        </p>
        {!intact ? (
          <p className="type-body-md mt-1 text-text-error">
            {reason} (entry {brokenAtId})
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export const dynamic = 'force-dynamic';
