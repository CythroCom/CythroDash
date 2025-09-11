import { serverOperations } from '../../database/servers';
import { planOperations } from '../../database/plan';
import { CythroDashServer, ServerStatus, BillingStatus } from '@/database/tables/cythro_dash_servers';
import { parseBillingCycle, addCycle } from '@/lib/billing-cycle';
import { panelServerSuspend, panelServerDelete } from '../../pterodactyl/servers';

export class ServerLifecycleController {
  /**
   * Calculate and set expiry_date for a server based on its plan billing cycle.
   */
  static async ensureExpiry(server: CythroDashServer): Promise<Date | null> {
    try {
      if (server.expiry_date) return server.expiry_date;
      const plan = await planOperations.getPlanById(server.billing.plan_id);
      if (!plan) return null;
      const cycleStr = (plan as any).billing_cycle_value || (plan as any).billing_cycle || '1month';
      const expiry = addCycle(server.created_at, String(cycleStr));
      await serverOperations.updateServer(server.id, { expiry_date: expiry } as any);
      return expiry;
    } catch (e) {
      console.error('ensureExpiry error:', e);
      return null;
    }
  }

  /** Backfill expiry_date for servers missing it */
  static async backfillExpiry(limit = 500): Promise<number> {
    let count = 0;
    const missing = await serverOperations.findServersMissingExpiry(limit);
    for (const s of missing) {
      const exp = await this.ensureExpiry(s);
      if (exp) count++;
    }
    return count;
  }

  /**
   * Process recurring billing for servers with next_billing_date due. Attempts to charge per cycle.
   * On insufficient balance, marks server as suspended and sets overdue amount.
   */
  static async processBillingCycles(now = new Date()): Promise<{ processed: number; charged: number; suspended: number; errors: number; logs: string[] }> {
    const logs: string[] = []
    let processed = 0, charged = 0, suspended = 0, errors = 0
    try {
      const due = await serverOperations.findServersBillingDue(now)
      for (const s of due) {
        processed++
        try {
          const plan = await planOperations.getPlanById(s.billing.plan_id)
          if (!plan) { logs.push(`No plan for server ${s.id}`); continue }
          const cycleStr = (plan as any).billing_cycle_value || (plan as any).billing_cycle || 'monthly'
          const parsed = parseBillingCycle(String(cycleStr))

          // Walk cycles until next_billing_date is in the future
          let next = s.billing.next_billing_date ? new Date(s.billing.next_billing_date) : now
          if (isNaN(next.getTime())) next = now

          while (next <= now) {
            // Attempt to charge user
            const amount = plan.price
            try {
              const { userOperations } = await import('../../database/user')
              const ok = await userOperations.updateCoins(s.user_id, -amount, `Server ${s.id} billing`)
              if (!ok) throw new Error('Debit failed')
              const newNext = addCycle(next, String(cycleStr))
              const ok2 = await serverOperations.applyBillingCharge(s.id, amount, newNext, now)
              if (!ok2) throw new Error('applyBillingCharge failed')
              // Optionally align expiry_date to next billing date
              await serverOperations.updateServer(s.id, { expiry_date: newNext } as any)
              charged++
              next = newNext
            } catch (e) {
              // Insufficient balance or debit error: compute overdue and suspend
              const remainingCycles = Math.max(1, Math.ceil((now.getTime() - next.getTime()) / parsed.ms))
              const overdueAmount = plan.price * remainingCycles
              const autoDeleteAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
              await serverOperations.updateServer(s.id, { billing: { overdue_amount: overdueAmount } as any } as any)
              const okSuspend = await serverOperations.markServerSuspended(s.id, 'Insufficient balance', 0, autoDeleteAt)
              if (!okSuspend) logs.push(`Failed to mark suspended ${s.id}`)
              suspended++
              break
            }
          }
        } catch (err) {
          errors++
          logs.push(`Billing error for ${s.id}: ${String(err)}`)
        }
      }
      return { processed, charged, suspended, errors, logs }
    } catch (e) {
      logs.push(`processBillingCycles fatal: ${String(e)}`)
      return { processed, charged, suspended, errors: ++errors, logs }
    }
  }

  /**
   * Suspend servers whose expiry_date has passed. Sets auto_delete_at to +24h.
   */
  static async suspendExpired(now = new Date()): Promise<{ processed: number; errors: number; logs: string[] }> {
    const logs: string[] = [];
    let processed = 0, errors = 0;
    try {
      const servers = await serverOperations.findExpiredActiveServers(now);
      for (const server of servers) {
        try {
          if (server.pterodactyl_server_id) {
            try { await panelServerSuspend(server.pterodactyl_server_id); } catch (e) {
              logs.push(`Suspend panel failed for ${server.id}: ${String(e)}`);
            }
          }
          const autoDeleteAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          const ok = await serverOperations.markServerSuspended(server.id, 'Billing expired', 0, autoDeleteAt);
          if (!ok) throw new Error('DB update failed');
          processed++;
        } catch (err) {
          errors++;
          logs.push(`Error suspending ${server.id}: ${String(err)}`);
        }
      }
      return { processed, errors, logs };
    } catch (e) {
      logs.push(`suspendExpired fatal: ${String(e)}`);
      return { processed, errors: ++errors, logs };
    }
  }

  /**
   * Permanently delete servers suspended for >24h.
   */
  static async deleteAfterGrace(now = new Date()): Promise<{ processed: number; errors: number; logs: string[] }> {
    const logs: string[] = [];
    let processed = 0, errors = 0;
    try {
      const servers = await serverOperations.findSuspendedDueDeletion(now);
      const { ServersController } = await import('./Servers');
      for (const server of servers) {
        try {
          const result = await ServersController.deleteServer(server.user_id, server.id);
          if (!result.success) throw new Error(result.message || 'Delete failed');
          processed++;
        } catch (err) {
          errors++;
          logs.push(`Error deleting ${server.id}: ${String(err)}`);
        }
      }
      return { processed, errors, logs };
    } catch (e) {
      logs.push(`deleteAfterGrace fatal: ${String(e)}`);
      return { processed, errors: ++errors, logs };
    }
  }
}

