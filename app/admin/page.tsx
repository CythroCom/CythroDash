"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from '@/components/Admin/AdminLayout'
import { useAdminGuard } from '@/hooks/use-admin-auth'
import { useAuthStore } from '@/stores/user-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Server, Activity } from 'lucide-react'

interface DashboardMetrics {
  users: {
    total: number
    new24h: number
    active24h: number
    totalCoins: number
  }
  servers: {
    total: number
    active: number
    online: number
    avgMemoryUtilization: number
  }
  transfers24h: number
  referrals: {
    enabled: boolean
    clicks24h?: number
    signups24h?: number
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const { isLoading, hasAccess } = useAdminGuard()
  const [searchQuery, setSearchQuery] = useState("")
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true)

  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoadingMetrics(true)
      const { currentUser, sessionToken } = useAuthStore.getState()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`
      if (currentUser) headers['x-user-data'] = encodeURIComponent(JSON.stringify(currentUser))

      const response = await fetch('/api/admin/dashboard', {
        method: 'GET',
        credentials: 'include',
        headers
      })

      const result = await response.json()
      if (result.success) {
        setMetrics(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error)
    } finally {
      setIsLoadingMetrics(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) {
      fetchMetrics()
    }
  }, [hasAccess, fetchMetrics])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return null
  }

  return (
    <AdminLayout
      title="Admin Dashboard"
      subtitle="System overview and metrics"
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
    >
      <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {isLoadingMetrics ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="border-neutral-700/50 bg-neutral-800/40">
                    <CardContent className="p-6">
                      <div className="animate-pulse">
                        <div className="h-4 bg-neutral-700 rounded w-1/3 mb-2"></div>
                        <div className="h-8 bg-neutral-700 rounded w-1/2"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : metrics ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-200">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-neutral-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{metrics.users.total.toLocaleString()}</div>
                    <p className="text-xs text-neutral-400">
                      +{metrics.users.new24h} new in last 24h
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-200">Total Servers</CardTitle>
                    <Server className="h-4 w-4 text-neutral-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{metrics.servers.total.toLocaleString()}</div>
                    <p className="text-xs text-neutral-400">
                      {metrics.servers.active} active, {metrics.servers.online} online
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-neutral-200">System Activity</CardTitle>
                    <Activity className="h-4 w-4 text-neutral-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{metrics.users.active24h.toLocaleString()}</div>
                    <p className="text-xs text-neutral-400">
                      Active users in last 24h
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardContent className="p-6">
                  <p className="text-neutral-400">Failed to load dashboard metrics</p>
                </CardContent>
              </Card>
            )}
          </div>
      </div>
    </AdminLayout>
  )
}
