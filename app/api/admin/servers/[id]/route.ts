/**
 * CythroDash - Admin Individual Server API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverOperations, UpdateServerData } from '@/hooks/managers/database/servers';
import { ServerStatus, BillingStatus, PowerState } from '@/database/tables/cythro_dash_servers';
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache';
import { compressedJson } from '@/lib/compress';
import { requireAdmin } from '@/lib/auth/middleware';

// Input validation schema for PATCH request (coercive and resilient)
const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.nativeEnum(ServerStatus).optional(),
  billing_status: z.nativeEnum(BillingStatus).optional(),
  power_state: z.nativeEnum(PowerState).optional(),
  limits: z.object({
    memory: z.coerce.number().int().min(128).optional(),
    disk: z.coerce.number().int().min(1024).optional(),
    cpu: z.coerce.number().int().min(1).optional(),
    swap: z.coerce.number().int().min(0).optional(),
    io: z.coerce.number().int().min(10).optional(),
    databases: z.coerce.number().int().min(0).optional(),
    allocations: z.coerce.number().int().min(1).optional(),
    backups: z.coerce.number().int().min(0).optional(),
  }).partial().optional(),
  configuration: z.object({
    environment_variables: z.record(z.union([z.string(), z.number(), z.boolean()])).transform((rec) => {
      const out: Record<string,string> = {}
      Object.entries(rec || {}).forEach(([k,v]) => { out[k] = String(v) })
      return out
    }).optional(),
    auto_start: z.coerce.boolean().optional(),
    crash_detection: z.coerce.boolean().optional(),
    backup_enabled: z.coerce.boolean().optional(),
    startup_command: z.string().optional(),
  }).partial().optional(),
  billing: z.object({
    plan_id: z.string().optional(),
    next_billing_date: z.union([z.string().datetime(), z.coerce.date().transform(d => d.toISOString())]).optional(),
    monthly_cost: z.coerce.number().min(0).optional(),
    billing_cycle: z.string().optional(),
  }).partial().optional(),
});



/**
 * GET /api/admin/servers/[id]
 * Get individual server details
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Apply authentication
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

    const serverId = (await params).id;

    // Cache lookup
    const t0 = Date.now();
    const bypass = shouldBypassCache(request.url);
    const cacheKey = makeKey(['admin_server_detail', admin.user!.id, serverId]);
    if (!bypass) {
      const cached = getCache<any>(cacheKey);
      const ifNoneMatch = request.headers.get('if-none-match') || '';
      if (cached.hit && cached.value) {
        const etag = cached.etag || makeETagFromObject(cached.value);
        if (etag && ifNoneMatch && ifNoneMatch === etag) {
          return new NextResponse(null, { 
            status: 304, 
            headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } 
          });
        }
        return compressedJson(request, cached.value, 200, { 
          ETag: etag, 
          'X-Cache': 'HIT', 
          'X-Response-Time': `${Date.now()-t0}ms` 
        });
      }
    }

    // Get server from database
    const server = await serverOperations.getServerById(serverId);
    if (!server) {
      return compressedJson(request, { 
        success: false, 
        message: 'Server not found' 
      }, 404);
    }

    // Get Pterodactyl data if available
    let pterodactylData = null;
    if (server.pterodactyl_server_id) {
      try {
        const { panelServerGetDetails } = await import('@/hooks/managers/pterodactyl/servers');
        pterodactylData = await panelServerGetDetails(server.pterodactyl_server_id);
      } catch (error) {
        console.warn('Failed to get Pterodactyl data for server:', serverId, error);
      }
    }

    const result = {
      success: true,
      message: 'Server details retrieved successfully',
      server,
      pterodactyl_data: pterodactylData
    };

    // Store in cache with short TTL
    const etag = makeETagFromObject(result);
    if (!bypass) setCache(cacheKey, result, 10_000, { ETag: etag }, etag); // 10 seconds TTL
    return compressedJson(request, result, 200, { 
      ETag: etag, 
      'X-Cache': bypass ? 'BYPASS' : 'MISS', 
      'X-Response-Time': `${Date.now()-t0}ms` 
    });

  } catch (error) {
    console.error('GET /api/admin/servers/[id] error:', error);
    return compressedJson(request, { 
      success: false, 
      message: 'An unexpected error occurred while retrieving server details' 
    }, 500);
  }
}

/**
 * PATCH /api/admin/servers/[id]
 * Update server settings
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Apply authentication
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

    const serverId = (await params).id;

    // Check if server exists
    const existingServer = await serverOperations.getServerById(serverId);
    if (!existingServer) {
      return NextResponse.json({
        success: false,
        message: 'Server not found'
      }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateServerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const updateData = validation.data as UpdateServerData;

    // Update server in database
    const updateResult = await serverOperations.updateServer(serverId, updateData);

    if (!updateResult) {
      return NextResponse.json({
        success: false,
        message: 'Failed to update server'
      }, { status: 500 });
    }

    // Get updated server data
    const updatedServer = await serverOperations.getServerById(serverId);

    // Attempt to sync to Pterodactyl (non-blocking for DB success)
    let pterodactyl_sync: { success: boolean; message: string } | null = null
    try {
      if (updatedServer && updatedServer.pterodactyl_server_id) {
        const { ServersController } = await import('@/hooks/managers/controller/User/Servers')
        const syncRes = await ServersController.updateServerSettingsPterodactyl(existingServer.user_id, serverId, updateData as any)
        pterodactyl_sync = { success: !!syncRes.success, message: syncRes.message || (syncRes.success ? 'Synced' : 'Failed') }
      }
    } catch (e: any) {
      console.warn('Pterodactyl sync failed after DB update:', e?.message || e)
      pterodactyl_sync = { success: false, message: e?.message || 'Pterodactyl sync failed' }
    }

    return NextResponse.json({
      success: true,
      message: 'Server updated successfully',
      server: updatedServer,
      pterodactyl_sync
    }, { status: 200 });

  } catch (error) {
    console.error('PATCH /api/admin/servers/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while updating server'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/servers/[id]
 * Delete server (admin-initiated)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Apply authentication
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response!;

    const serverId = (await params).id;

    // Check if server exists
    const existingServer = await serverOperations.getServerById(serverId);
    if (!existingServer) {
      return NextResponse.json({
        success: false,
        message: 'Server not found'
      }, { status: 404 });
    }

    // Use the existing ServersController to delete the server
    const { ServersController } = await import('@/hooks/managers/controller/User/Servers');
    
    // Admin can delete any server, so we use the server's user_id
    const result = await ServersController.deleteServer(existingServer.user_id, serverId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('DELETE /api/admin/servers/[id] error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while deleting server'
    }, { status: 500 });
  }
}
