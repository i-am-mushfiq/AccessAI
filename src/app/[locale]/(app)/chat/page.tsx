import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getFullSession } from '@/lib/http/session';
import { getConversation, listConversations } from '@/modules/ai/conversation.service';
import { describeAiMode } from '@/modules/ai/providers';
import { ChatClient, type ChatMessage } from '@/components/chat/ChatClient';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/primitives/Card';
import { formatTimeAgo } from '@/lib/format/dates';

/**
 * Chat page.
 *
 * The transcript is loaded on the server so a returning citizen sees their
 * conversation in the first paint rather than after a client fetch — on a slow
 * connection that difference is several seconds of blank screen.
 */
export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { locale } = await params;
  const { c } = await searchParams;
  setRequestLocale(locale);

  const session = await getFullSession();
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations('chat');

  const [existing, conversations] = await Promise.all([
    c ? getConversation(session.userId, c) : Promise.resolve(null),
    listConversations(session.userId, 12),
  ]);

  const initialMessages: ChatMessage[] = (existing?.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    kind: m.kind,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    confidence: m.confidence,
    aiEngine: m.aiEngine,
    payload: (m.payload as ChatMessage['payload']) ?? null,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      <ChatClient
        initialMessages={initialMessages}
        initialConversationId={existing?.conversation.id ?? null}
        aiMode={describeAiMode().mode}
        userName={session.user.name.split(' ')[0] ?? session.user.name}
      />

      {/* Conversation history. On mobile it sits below the chat rather than
          behind a hamburger, which BDS §9.5 bans for primary navigation. */}
      <aside className="flex flex-col gap-3">
        <h2 className="type-heading-sm text-text-primary">{t('history')}</h2>
        {conversations.length === 0 ? (
          <Card padding="compact">
            <p className="type-body-md text-text-secondary">{t('historyEmpty')}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/chat?c=${conversation.id}`}
                  aria-current={conversation.id === existing?.conversation.id ? 'page' : undefined}
                  className={
                    conversation.id === existing?.conversation.id
                      ? 'flex min-h-16 flex-col justify-center gap-1 rounded-md border-1.5 border-stroke-brand bg-surface-brand-subtle px-4 py-3 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2'
                      : 'flex min-h-16 flex-col justify-center gap-1 rounded-md border border-stroke-subtle bg-surface px-4 py-3 hover:bg-surface-sunken focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2'
                  }
                >
                  <span className="type-body-md text-text-primary clamp-2">
                    {conversation.title ?? conversation.summary ?? t('newConversation')}
                  </span>
                  <span className="type-caption text-text-secondary">
                    {conversation.lastMessageAt
                      ? formatTimeAgo(conversation.lastMessageAt, locale as 'bn' | 'en')
                      : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'chat' });
  return { title: t('title') };
}

export const dynamic = 'force-dynamic';
