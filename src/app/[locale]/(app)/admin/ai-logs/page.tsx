import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { desc, eq, sql } from 'drizzle-orm';
import { AlertTriangle, Cpu } from 'lucide-react';
import { db } from '@/lib/db/client';
import { aiLogs, users } from '@/lib/db/schema';
import { getFullSession, isStaff } from '@/lib/http/session';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Chip';
import { Banner } from '@/components/primitives/Banner';
import { EmptyState } from '@/components/primitives/States';
import { formatTimeAgo } from '@/lib/format/dates';

/**
 * AI log viewer — PRD §Feature 20 ("Review AI Logs").
 *
 * Only the 500-character summary captured at write time is shown, never a full
 * transcript. An operator auditing AI quality does not need a citizen's complete
 * personal narrative, and storing less of it is the privacy-by-design position
 * PRD §121 asks for.
 */
export default async function AdminAiLogsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const bn = locale === 'bn';

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);
  if (!isStaff(session.user.role)) redirect(`/${locale}/dashboard`);

  const t = await getTranslations('admin');
  const tc = await getTranslations('common');

  const [rows, byEngine] = await Promise.all([
    db
      .select({ log: aiLogs, userName: users.name })
      .from(aiLogs)
      .leftJoin(users, eq(aiLogs.userId, users.id))
      .orderBy(desc(aiLogs.createdAt))
      .limit(80),
    db.select({ engine: aiLogs.engine, n: sql<number>`count(*)` }).from(aiLogs).groupBy(aiLogs.engine),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-heading-lg text-text-primary">{t('aiLogs')}</h1>
      </header>

      <AdminNav />

      <div className="flex flex-wrap gap-2">
        {byEngine.map((entry) => (
          <Badge key={entry.engine} tone={entry.engine === 'simulated' ? 'info' : 'success'}>
            <Cpu size={16} className="icon" aria-hidden="true" />
            {entry.engine}: {Number(entry.n)}
          </Badge>
        ))}
      </div>

      <Banner tone="info" statusWord={tc('appName')}>
        {bn
          ? 'গোপনীয়তার জন্য নাগরিকের বার্তার শুধু সংক্ষিপ্ত অংশ (৫০০ অক্ষর) সংরক্ষণ ও দেখানো হয়।'
          : 'For privacy, only a 500-character summary of the citizen\'s message is stored and shown.'}
      </Banner>

      {rows.length === 0 ? (
        <EmptyState title={tc('none')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ log, userName }) => (
            <li key={log.id}>
              <Card padding="default" className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={log.engine === 'simulated' ? 'info' : 'success'}>{log.engine}</Badge>
                    <Badge tone="neutral">{log.requestType}</Badge>
                    {log.groundingFailure ? (
                      <Badge tone="error" icon={<AlertTriangle size={16} className="icon" />}>
                        {t('groundingFailures')}
                      </Badge>
                    ) : null}
                    {log.error ? <Badge tone="error">error</Badge> : null}
                  </div>
                  <span className="type-caption tabular text-text-tertiary">
                    {formatTimeAgo(log.createdAt, locale as 'bn' | 'en')}
                    {log.latencyMs !== null ? ` · ${log.latencyMs}ms` : ''}
                    {log.confidence !== null ? ` · ${log.confidence}%` : ''}
                  </span>
                </div>

                {log.inputSummary ? (
                  <p className="type-body-md text-text-primary">{log.inputSummary}</p>
                ) : null}
                {log.outputSummary ? (
                  <p className="type-body-md rounded-md bg-surface-sunken p-3 text-text-secondary">
                    {log.outputSummary}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {(log.intents ?? []).map((intent) => (
                    <Badge key={intent} tone="brand">
                      {intent.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                  {log.retrievedChunkIds && log.retrievedChunkIds.length > 0 ? (
                    <Badge tone="neutral">
                      {bn ? 'উৎস' : 'sources'}: {log.retrievedChunkIds.length}
                    </Badge>
                  ) : null}
                  {log.promptVersion ? <Badge tone="neutral">prompt {log.promptVersion}</Badge> : null}
                </div>

                <p className="type-caption text-text-tertiary">{userName ?? tc('unknown')}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
