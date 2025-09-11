"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from '@/components/Admin/AdminLayout'
import { useAdminGuard } from '@/hooks/use-admin-auth'
import { useAdminSecurityStore } from '@/stores/admin-security-store'
import { useAdminSecurityLogsStore } from '@/stores/admin-security-logs-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Download, RefreshCw, ShieldAlert, ShieldCheck, Shield } from 'lucide-react'
import { SecurityLogAction, SecurityLogSeverity, SecurityLogStatus } from '@/database/tables/cythro_dash_users_logs'

function SeverityBadge({ severity }: { severity: SecurityLogSeverity }) {
  const color = severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : severity === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    : severity === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  return <Badge className={color}>{severity}</Badge>
}

export default function AdminSecurityLogsPage() {
  const { isLoading, hasAccess } = useAdminGuard()

  const { data: metrics, fetchSecurityData } = useAdminSecurityStore()
  const { logs, loading, error, filters, setFilters, fetchLogs, autoRefresh, setAutoRefresh, exportCsv } = useAdminSecurityLogsStore()

  const [searchUserId, setSearchUserId] = useState<string>('')
  const [searchIP, setSearchIP] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const refreshTimer = useRef<NodeJS.Timeout | null>(null)

  const handleSearchApply = useCallback(() => {
    setFilters({ user_id: searchUserId ? Number(searchUserId) : undefined, ip_address: searchIP || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined, page: 1 })
    fetchLogs({ page: 1 })
  }, [searchUserId, searchIP, dateFrom, dateTo, setFilters, fetchLogs])

  const handleResetFilters = useCallback(() => {
    setSearchUserId(''); setSearchIP(''); setDateFrom(''); setDateTo('')
    setFilters({ user_id: undefined, ip_address: undefined, action: undefined, severity: undefined, status: undefined, is_suspicious: undefined, requires_attention: undefined, date_from: undefined, date_to: undefined, page: 1 })
    fetchLogs({ page: 1 })
  }, [setFilters, fetchLogs])

  useEffect(() => {
    if (!hasAccess) return
    fetchSecurityData()
    fetchLogs({ page: 1 })
  }, [hasAccess, fetchSecurityData, fetchLogs])

  useEffect(() => {
    if (!autoRefresh) { if (refreshTimer.current) { clearInterval(refreshTimer.current as any); refreshTimer.current = null } return }
    refreshTimer.current = setInterval(() => { void fetchLogs() }, 5000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current as any) }
  }, [autoRefresh, fetchLogs])

  const actionOptions = useMemo(() => Object.values(SecurityLogAction), [])
  const severityOptions = useMemo(() => Object.values(SecurityLogSeverity), [])
  const statusOptions = useMemo(() => Object.values(SecurityLogStatus), [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading admin panel...</p>
        </div>
      </div>
    )
  }
  if (!hasAccess) return null

  return (
    <AdminLayout title="Security Logs" subtitle="Review security events, warnings, and alerts" searchQuery="" onSearchChange={() => {}}>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-neutral-700/50 bg-neutral-800/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-neutral-200">Threat Level</CardTitle>
                <Shield className="h-4 w-4 text-neutral-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white capitalize">{metrics?.threat_level || 'low'}</div>
              </CardContent>
            </Card>
            <Card className="border-neutral-700/50 bg-neutral-800/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-neutral-200">Events (24h)</CardTitle>
                <ShieldAlert className="h-4 w-4 text-neutral-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{metrics?.summary.total_events_24h ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="border-neutral-700/50 bg-neutral-800/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-neutral-200">Suspicious (24h)</CardTitle>
                <ShieldCheck className="h-4 w-4 text-neutral-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{metrics?.summary.suspicious_24h ?? 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="border-neutral-700/50 bg-neutral-800/40">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Input placeholder="User ID" value={searchUserId} onChange={(e) => setSearchUserId(e.target.value)} className="bg-neutral-800/50 border-neutral-700/50" />
                <Input placeholder="IP Address" value={searchIP} onChange={(e) => setSearchIP(e.target.value)} className="bg-neutral-800/50 border-neutral-700/50" />
                <Select onValueChange={(v) => { setFilters({ action: (v as SecurityLogAction) || undefined }); void fetchLogs({ page: 1 }) }}>
                  <SelectTrigger className="bg-neutral-800/50 border-neutral-700/50"><SelectValue placeholder="Action" /></SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 max-h-60 overflow-y-auto">
                    {actionOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select onValueChange={(v) => { setFilters({ severity: v as SecurityLogSeverity }); void fetchLogs({ page: 1 }) }}>
                  <SelectTrigger className="bg-neutral-800/50 border-neutral-700/50"><SelectValue placeholder="Severity" /></SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700">
                    {severityOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select onValueChange={(v) => { setFilters({ status: v as SecurityLogStatus }); void fetchLogs({ page: 1 }) }}>
                  <SelectTrigger className="bg-neutral-800/50 border-neutral-700/50"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700">
                    {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-neutral-800/50 border-neutral-700/50" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-neutral-800/50 border-neutral-700/50" />
                <div className="flex items-center space-x-2">
                  <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
                  <label htmlFor="auto-refresh" className="text-neutral-300 text-sm">Auto-refresh</label>
                </div>
                <Button onClick={handleSearchApply} className="bg-neutral-700 hover:bg-neutral-600"><RefreshCw className="w-4 h-4 mr-2" />Apply</Button>
                <Button variant="outline" onClick={handleResetFilters} className="border-neutral-600 text-neutral-300 hover:bg-neutral-700/40">Reset</Button>
              </div>
            </CardContent>
          </Card>

          {/* Logs table */}
          <Card className="border-neutral-700/50 bg-neutral-800/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Security Events</CardTitle>
              <Button variant="outline" onClick={() => {
                const csv = exportCsv()
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `security-logs-${Date.now()}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }} className="border-neutral-600 text-neutral-300 hover:bg-neutral-700/40"><Download className="w-4 h-4 mr-2" />Export CSV</Button>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-neutral-700/40 rounded mb-2 animate-pulse" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="p-6 text-neutral-400">No logs found for the given filters.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-neutral-800/60">
                          <TableCell className="whitespace-nowrap text-neutral-300">{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-neutral-300">#{log.user_id}</TableCell>
                          <TableCell className="text-neutral-300">{log.ip_address || '-'}</TableCell>
                          <TableCell className="text-neutral-300">{log.action}</TableCell>
                          <TableCell><SeverityBadge severity={log.severity} /></TableCell>
                          <TableCell className="capitalize text-neutral-300">{log.status}</TableCell>
                          <TableCell className="text-neutral-300 max-w-xl truncate" title={log.description}>{log.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex items-center justify-between p-4 border-t border-neutral-700/40">
                <div className="text-sm text-neutral-400">Page {filters.page || 1}</div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    className="border-neutral-600 text-neutral-300 hover:bg-neutral-700/40"
                    onClick={() => { if ((filters.page || 1) > 1) { const p=(filters.page||1)-1; setFilters({ page: p }); void fetchLogs({ page: p }) } }}
                    disabled={(filters.page || 1) <= 1}
                  >Prev</Button>
                  <Button
                    variant="outline"
                    className="border-neutral-600 text-neutral-300 hover:bg-neutral-700/40"
                    onClick={() => { const p=(filters.page||1)+1; setFilters({ page: p }); void fetchLogs({ page: p }) }}
                    disabled={logs.length < (filters.limit || 50)}
                  >Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

