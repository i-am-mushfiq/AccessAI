import { and, isNotNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { conversations, aiLogs, otpChallenges } from '@/lib/db/schema';

/**
 * SJ-43 — a real, concrete retention policy, not a document describing an
 * aspirational one. The specific periods are a defensible default, not a
 * legal determination — a production deployment should set them from actual
 * legal advice; see docs/COMPLIANCE.md.
 *
 * What is DELIBERATELY never purged here: `ledger_entries` and `audit_log`.
 * Both are the accountability record Phase 3 exists to provide — a "data
 * retention" job that quietly shortened the audit trail would defeat SJ-13's
 * entire purpose. Financial and integrity records are kept indefinitely;
 * only personal conversational data ages out.
 */
export const RETENTION_POLICY = {
  /** A citizen's AI conversation history — personal, and the largest volume of stored PII in this app. */
  conversationInactiveDays: 730,
  /** Individual AI request/response logs, purged on their own schedule even inside a still-active conversation. */
  aiLogDays: 365,
  /** Expired OTP challenges are useless the moment they expire; no reason to keep them at all. */
  expiredOtpGraceDays: 7,
} as const;

export interface RetentionResult {
  readonly conversationsDeleted: number;
  readonly aiLogsDeleted: number;
  readonly otpChallengesDeleted: number;
}

/**
 * Deletes (never anonymises-in-place — a conversation with its content
 * blanked out but its row surviving is still a re-identifiable trace) every
 * conversation whose last message is older than the policy window, every
 * AI log older than its own window, and long-expired OTP challenges.
 * Cascading foreign keys take messages with their conversation.
 */
export async function enforceDataRetention(now: Date = new Date()): Promise<RetentionResult> {
  const conversationCutoff = new Date(now.getTime() - RETENTION_POLICY.conversationInactiveDays * 86_400_000);
  const aiLogCutoff = new Date(now.getTime() - RETENTION_POLICY.aiLogDays * 86_400_000);
  const otpCutoff = new Date(now.getTime() - RETENTION_POLICY.expiredOtpGraceDays * 86_400_000);

  const deletedConversations = await db
    .delete(conversations)
    .where(and(isNotNull(conversations.lastMessageAt), lt(conversations.lastMessageAt, conversationCutoff)))
    .returning({ id: conversations.id });

  const deletedAiLogs = await db.delete(aiLogs).where(lt(aiLogs.createdAt, aiLogCutoff)).returning({ id: aiLogs.id });

  const deletedOtp = await db.delete(otpChallenges).where(lt(otpChallenges.expiresAt, otpCutoff)).returning({ id: otpChallenges.id });

  return {
    conversationsDeleted: deletedConversations.length,
    aiLogsDeleted: deletedAiLogs.length,
    otpChallengesDeleted: deletedOtp.length,
  };
}
