"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Server,
  DollarSign,
  RefreshCw
} from 'lucide-react'
import type { AdminServerSummary } from '@/stores/admin-server-management'

import { ServerStatus, BillingStatus, PowerState } from '@/database/tables/cythro_dash_servers'

interface OverviewTabProps {
  server: AdminServerSummary
  onRefresh: () => void
}

export default function OverviewTab({ server, onRefresh }: OverviewTabProps) {

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    // In information-only mode, we do not poll live status.
    // Last updated reflects the server.updated_at from DB on refresh.
    setLastUpdated(new Date(server.updated_at))
  }, [server.updated_at])
  const getStatusColor = (status: ServerStatus) => {
    switch (status) {
      case ServerStatus.ACTIVE: return 'bg-green-500/10 text-green-400 border-green-500/20'
      case ServerStatus.SUSPENDED: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case ServerStatus.CREATING: return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case ServerStatus.ERROR: return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
    }
  }



  const getBillingStatusColor = (billingStatus: BillingStatus) => {
    switch (billingStatus) {
      case BillingStatus.ACTIVE: return 'bg-green-500/10 text-green-400 border-green-500/20'
      case BillingStatus.SUSPENDED: return 'bg-red-500/10 text-red-400 border-red-500/20'
      case BillingStatus.CANCELLED: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
      default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
    }
  }



  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Server Overview</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="border-neutral-600 hover:bg-neutral-700"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-200">Server Status</CardTitle>
            <Server className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <Badge className={getStatusColor(server.status)}>{server.status}</Badge>
            <p className="text-xs text-neutral-400 mt-2">
              Last updated: {(lastUpdated || new Date(server.updated_at)).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-200">Power State</CardTitle>
            <Server className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <Badge className="bg-neutral-500/10 text-neutral-400 border-neutral-500/20">{server.power_state}</Badge>
            <p className="text-xs text-neutral-400 mt-2">
              Last updated: {(lastUpdated || new Date(server.updated_at)).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-200">Billing Status</CardTitle>
            <DollarSign className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <Badge className={getBillingStatusColor(server.billing_status)}>{server.billing_status}</Badge>
            <p className="text-xs text-neutral-400 mt-2">
              ${server.billing.monthly_cost}/month
            </p>
          </CardContent>
        </Card>
      </div>



      {/* Server Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Server className="h-5 w-5" />
              Server Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-neutral-400">Server ID</p>
                <p className="text-white font-mono text-sm">{server.id}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Name</p>
                <p className="text-white">{server.name}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400">User ID</p>
                <p className="text-white">{server.user_id}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Pterodactyl ID</p>
                <p className="text-white">{server.pterodactyl_id ?? 'Not assigned'}</p>
              </div>
            </div>
            
            {server.description && (
              <div>
                <p className="text-sm text-neutral-400">Description</p>
                <p className="text-white">{server.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-neutral-400">Created</p>
                <p className="text-white">{new Date(server.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Last Updated</p>
                <p className="text-white">{new Date(server.updated_at).toLocaleString()}</p>
              </div>
            </div>

            {server.expiry_date && (
              <div>
                <p className="text-sm text-neutral-400">Expiry Date</p>
                <p className="text-white">{new Date(server.expiry_date).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Billing & Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-neutral-400">Monthly Cost</p>
                <p className="text-white text-lg font-semibold">${server.billing.monthly_cost}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Billing Cycle</p>
                <p className="text-white">{server.billing.billing_cycle}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Next Billing</p>
                <p className="text-white">{new Date(server.billing.next_billing_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-400">Auto Start</p>
                <p className="text-white">{server.configuration.auto_start ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-neutral-400 mb-2">Resource Limits</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-white">{server.limits.memory} MB RAM</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white">{server.limits.disk} MB Disk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white">{server.limits.cpu}% CPU</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white">{server.limits.databases} DBs</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-neutral-400 mb-2">Configuration</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Backup Enabled:</span>
                    <span className="text-white">{server.configuration.backup_enabled ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Allocations:</span>
                    <span className="text-white">{server.limits.allocations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Backups:</span>
                    <span className="text-white">{server.limits.backups}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
