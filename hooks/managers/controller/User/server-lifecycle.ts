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

