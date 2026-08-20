import { ok, handle } from '@/lib/http/response';
import { requireStaff } from '@/lib/http/session';
import { verifyLedgerChain } from '@/modules/ledger/ledger.service';
import { verifyAuditChain } from '@/modules/admin/admin.service';

/**
 * GET /api/v1/ledger/verify — SJ-13/14's actual payoff.
 *
 * An internal integrity-audit tool (staff-only), not the public transparency
 * surface SJ-37 asks for — that is explicitly Phase 4 scope. Walks both
 * hash chains independently and reports exactly where either breaks, if it
 * does.
 */
export async function GET() {
  return handle(async () => {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const [ledger, auditLog] = await Promise.all([verifyLedgerChain(), verifyAuditChain()]);

    return ok({ ledger, auditLog });
  }, 'ledger/verify:get');
}

export const dynamic = 'force-dynamic';
