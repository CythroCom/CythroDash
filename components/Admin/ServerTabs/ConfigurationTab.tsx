"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings, Server, Cpu, DollarSign } from 'lucide-react'
import type { AdminServerSummary } from '@/stores/admin-server-management'

interface ConfigurationTabProps {
  server: AdminServerSummary
  onUpdate: () => void
}

export default function ConfigurationTab({ server, onUpdate }: ConfigurationTabProps) {
  // Information-only mode: server configuration is read-only for admins
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Server Configuration
        </h2>
        <Badge variant="secondary">Information only</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Server className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription className="text-neutral-400">Server name, description, and statuses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-neutral-300">Name</span><span className="text-white font-medium truncate">{server.name}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">Description</span><span className="text-neutral-200 truncate">{server.description || '—'}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">Server Status</span><Badge>{server.status}</Badge></div>
            <div className="flex justify-between"><span className="text-neutral-300">Billing Status</span><Badge>{server.billing_status}</Badge></div>
          </CardContent>
        </Card>

        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Cpu className="h-5 w-5" />Resource Limits</CardTitle>
            <CardDescription className="text-neutral-400">CPU, memory, disk and other allocations</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between"><span className="text-neutral-300">Memory (MB)</span><span className="text-white">{server.limits.memory}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">Disk (MB)</span><span className="text-white">{server.limits.disk}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">CPU (%)</span><span className="text-white">{server.limits.cpu}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">Databases</span><span className="text-white">{server.limits.databases}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">Allocations</span><span className="text-white">{server.limits.allocations}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">Backups</span><span className="text-white">{server.limits.backups}</span></div>
          </CardContent>
        </Card>

        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><DollarSign className="h-5 w-5" />Billing</CardTitle>
            <CardDescription className="text-neutral-400">Pricing and billing cycle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-neutral-300">Plan</span><span className="text-white">{server.billing.plan_id}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">Monthly Cost</span><span className="text-white">${server.billing.monthly_cost}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">Billing Cycle</span><span className="text-white">{server.billing.billing_cycle}</span></div>
            <div className="flex justify-between"><span className="text-neutral-300">Next Billing</span><span className="text-white">{server.billing.next_billing_date ? new Date(server.billing.next_billing_date).toLocaleDateString() : '—'}</span></div>
          </CardContent>
        </Card>

        <Card className="border-neutral-700/50 bg-neutral-800/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><Settings className="h-5 w-5" />Configuration</CardTitle>
            <CardDescription className="text-neutral-400">Auto-start, backup and environment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex justify-between"><span className="text-neutral-300">Auto Start</span><Badge variant={server.configuration.auto_start ? 'default' : 'secondary'}>{server.configuration.auto_start ? 'Enabled' : 'Disabled'}</Badge></div>
              <div className="flex justify-between"><span className="text-neutral-300">Backups</span><Badge variant={server.configuration.backup_enabled ? 'default' : 'secondary'}>{server.configuration.backup_enabled ? 'Enabled' : 'Disabled'}</Badge></div>
            </div>
            <div>
              <div className="text-neutral-300 mb-1">Startup Command</div>
              <div className="text-neutral-100 font-mono break-words whitespace-pre-wrap bg-neutral-800/60 border border-neutral-700/40 rounded p-2 text-xs">
                {server.configuration.startup_command || '—'}
              </div>
            </div>
            <div>
              <div className="text-neutral-300 mb-1">Environment Variables</div>
              <div className="text-neutral-100 font-mono break-words whitespace-pre-wrap bg-neutral-800/60 border border-neutral-700/40 rounded p-2 text-xs">
                {Object.entries(server.configuration.environment_variables || {}).map(([k,v]) => `${k}=${v}`).join('\n') || '—'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


