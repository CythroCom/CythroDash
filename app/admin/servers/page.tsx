"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/Admin/AdminLayout'
import { useAdminGuard } from '@/hooks/use-admin-auth'
import { useAdminServerManagementStore } from '@/stores/admin-server-management'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Server, Activity, Users, DollarSign } from 'lucide-react'
import { ServerStatus, PowerState } from '@/database/tables/cythro_dash_servers'

export default function AdminServers() {
  const router = useRouter()
  const { isLoading, hasAccess } = useAdminGuard()

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ServerStatus | "all">("all")
  const [powerStateFilter, setPowerStateFilter] = useState<PowerState | "all">("all")

  const {
    serversList,
    serversListPagination,
    serversListStats,
    isLoadingServersList,
    getServersList,
  } = useAdminServerManagementStore()

  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])

  const fetchServers = useCallback(async () => {
    const filters: any = { 
      search: searchQuery, 
      include_stats: true 
    }
    
    if (statusFilter !== "all") filters.status = statusFilter
    if (powerStateFilter !== "all") filters.power_state = powerStateFilter
    
    await getServersList(filters)
  }, [getServersList, searchQuery, statusFilter, powerStateFilter])

  useEffect(() => {
    if (hasAccess) {
      fetchServers()
    }
  }, [hasAccess, fetchServers])

  const handleViewDetails = (serverId: string) => {
    router.push(`/admin/servers/${serverId}`)
  }


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

  if (!hasAccess) {
    return null
  }

  return (
    <AdminLayout
      title="Server Management"
      subtitle="Manage all servers across the platform"
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
    >
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder="Search servers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-80 bg-neutral-800/50 border-neutral-700/50"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ServerStatus | "all")}>
                <SelectTrigger className="w-40 bg-neutral-800/50 border-neutral-700/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value={ServerStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={ServerStatus.SUSPENDED}>Suspended</SelectItem>
                  <SelectItem value={ServerStatus.CREATING}>Creating</SelectItem>
                  <SelectItem value={ServerStatus.ERROR}>Error</SelectItem>
                </SelectContent>
              </Select>

              <Select value={powerStateFilter} onValueChange={(value) => setPowerStateFilter(value as PowerState | "all")}>
                <SelectTrigger className="w-40 bg-neutral-800/50 border-neutral-700/50">
                  <SelectValue placeholder="Power State" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700">
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value={PowerState.ONLINE}>Online</SelectItem>
                  <SelectItem value={PowerState.OFFLINE}>Offline</SelectItem>
                  <SelectItem value={PowerState.STARTING}>Starting</SelectItem>
                  <SelectItem value={PowerState.STOPPING}>Stopping</SelectItem>
                </SelectContent>
              </Select>
            </div>
            

          </div>

          {serversListStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Total Servers</CardTitle>
                  <Server className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serversListStats.total_servers}</div>
                  <p className="text-xs text-neutral-400">
                    {serversListStats.active_servers} active
                  </p>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Online Servers</CardTitle>
                  <Activity className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serversListStats.online_servers}</div>
                  <p className="text-xs text-neutral-400">
                    {serversListStats.offline_servers} offline
                  </p>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{serversListStats.total_users}</div>
                  <p className="text-xs text-neutral-400">
                    with servers
                  </p>
                </CardContent>
              </Card>

              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Monthly Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-neutral-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">${serversListStats.total_monthly_revenue}</div>
                  <p className="text-xs text-neutral-400">
                    from servers
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900/60">
            {isLoadingServersList && serversList.length === 0 ? (
              <div className="divide-y divide-neutral-800">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 items-center px-4 py-3">
                    <div className="col-span-4"><div className="h-4 w-48 bg-neutral-700 rounded" /></div>
                    <div className="col-span-2"><div className="h-4 w-24 bg-neutral-700 rounded" /></div>
                    <div className="col-span-2"><div className="h-4 w-24 bg-neutral-700 rounded" /></div>
                    <div className="col-span-2"><div className="h-4 w-24 bg-neutral-700 rounded" /></div>
                    <div className="col-span-2"><div className="h-4 w-24 bg-neutral-700 rounded" /></div>
                  </div>
                ))}
              </div>
            ) : serversList.length === 0 ? (
              <div className="p-6 text-neutral-400">No servers found</div>
            ) : (
              <>
                <div className="grid grid-cols-12 px-4 py-2 text-xs uppercase text-neutral-400">
                  <div className="col-span-4">Server</div>
                  <div className="col-span-2">Plan</div>
                  <div className="col-span-2">User</div>
                  <div className="col-span-2">Location</div>
                  <div className="col-span-2">Created</div>
                </div>
                <div className="divide-y divide-neutral-800">
                  {serversList.map((server) => (
                    <div
                      key={server.id}
                      onClick={() => handleViewDetails(server.id)}
                      className="grid grid-cols-12 items-center px-4 py-3 border-b border-neutral-800 text-sm hover:bg-neutral-800/40 cursor-pointer"
                    >
                      <div className="col-span-4 truncate text-white">{server.name}</div>
                      <div className="col-span-2 text-neutral-300 truncate">{server.billing.plan_id}</div>
                      <div className="col-span-2 text-neutral-300">{server.user_id}</div>
                      <div className="col-span-2 text-neutral-300 truncate">{server.location_id}</div>
                      <div className="col-span-2 text-neutral-400">{new Date(server.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {serversListPagination && serversListPagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchServers()}
                disabled={serversListPagination.current_page === 1}
                className="border-neutral-600 hover:bg-neutral-700"
              >
                Previous
              </Button>
              <span className="text-neutral-400 text-sm">
                Page {serversListPagination.current_page} of {serversListPagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchServers()}
                disabled={serversListPagination.current_page === serversListPagination.total_pages}
                className="border-neutral-600 hover:bg-neutral-700"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
