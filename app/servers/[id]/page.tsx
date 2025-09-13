"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ExternalLink, DollarSign, Server, AlertTriangle } from 'lucide-react'
import { Sidebar, Header } from '@/components/LazyComponents'
import { useAuthStore } from '@/stores/user-store'
import { showError, showSuccess, showConfirm } from '@/lib/toast'

interface ServerDetails {
  id: string
  name: string
  status: string
  billing_status: string
  game: string
  ip: string
  expiry_date?: string
  auto_delete_at?: string
  overdue_amount?: number
  pterodactyl_identifier?: string
  created_at: string
  updated_at: string
}

interface ServerDetailPageProps {
  params: { id: string }
}

export default function ServerDetailPage({ params }: ServerDetailPageProps) {
  const router = useRouter()
  const { id: serverId } = params
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [server, setServer] = useState<ServerDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panelUrl, setPanelUrl] = useState<string | null>(null)
  const [isRenewing, setIsRenewing] = useState(false)
  
  const { currentUser } = useAuthStore()

  const fetchServerDetails = useCallback(async () => {
    if (!serverId || !currentUser) return

    try {
      setIsLoading(true)
      setError(null)

      // Fetch server details from server API
      const response = await fetch(`/api/servers/${serverId}`, {
        credentials: 'include',
        headers: {
          'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch server details')
      }

      const result = await response.json()

      // Debug logging for development
      if (process.env.NODE_ENV === 'development') {
        console.log('Server Detail Page - API Response:', {
          success: result.success,
          server: result.server,
          message: result.message
        });
      }

      if (!result.success || !result.server) {
        throw new Error(result.message || 'Server not found')
      }

      const serverData = result.server

      setServer({
        id: serverData.id || serverData.identifier,
        name: serverData.name,
        status: serverData.status || 'unknown',
        billing_status: serverData.billing_status || 'active',
        game: serverData.egg?.name || serverData.type || 'Game Server',
        ip: (() => {
          const allocs = serverData.allocations || []
          const primary = allocs.find((a: any) => a.is_default) || allocs[0]
          return primary ? `${primary.ip}:${primary.port}` : 'N/A'
        })(),
        expiry_date: serverData.expiry_date,
        auto_delete_at: serverData.auto_delete_at,
        overdue_amount: serverData.overdue_amount,
        pterodactyl_identifier: serverData.identifier || serverData.pterodactyl_identifier,
        created_at: serverData.created_at,
        updated_at: serverData.updated_at
      })

    } catch (err) {
      console.error('Error fetching server details:', err)
      setError(err instanceof Error ? err.message : 'Failed to load server details')
    } finally {
      setIsLoading(false)
    }
  }, [serverId, currentUser])

  const fetchPanelUrl = useCallback(async () => {
    try {
      const response = await fetch('/api/config/panel_url')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.value) {
          setPanelUrl(result.value)
        }
      }
    } catch (err) {
      console.error('Error fetching panel URL:', err)
    }
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchServerDetails()
      fetchPanelUrl()
    }
  }, [currentUser, fetchServerDetails, fetchPanelUrl])

  const handleRenewServer = useCallback(async () => {
    if (!server || !server.overdue_amount || server.overdue_amount <= 0) return

    const confirmed = await showConfirm(
      "Renew Server",
      `This will charge ${server.overdue_amount} coins to renew your server. Continue?`
    )

    if (!confirmed) return

    try {
      setIsRenewing(true)

      const response = await fetch(`/api/servers/${serverId}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-data': encodeURIComponent(JSON.stringify(currentUser))
        },
        credentials: 'include',
        body: JSON.stringify({ confirm: true })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('Server renewed successfully')
        await fetchServerDetails() // Refresh server data
      } else {
        showError(result.message || 'Failed to renew server')
      }
    } catch (error) {
      console.error('Error renewing server:', error)
      showError('Failed to renew server')
    } finally {
      setIsRenewing(false)
    }
  }, [server, serverId, currentUser, fetchServerDetails])

  const handleOpenPanel = useCallback(() => {
    if (!panelUrl || !server?.pterodactyl_identifier) {
      showError('Panel access not available', 'Panel URL or server identifier not configured')
      return
    }

    const fullPanelUrl = `${panelUrl}/servers/${server.pterodactyl_identifier}`
    window.open(fullPanelUrl, '_blank', 'noopener,noreferrer')
  }, [panelUrl, server?.pterodactyl_identifier])

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      online: { className: "bg-green-500/10 text-green-400 border-green-500/20", label: "Online" },
      started: { className: "bg-green-500/10 text-green-400 border-green-500/20", label: "Started" },
      starting: { className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Starting" },
      stopping: { className: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Stopping" },
      suspended: { className: "bg-red-500/10 text-red-400 border-red-500/20", label: "Suspended" },
      offline: { className: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20", label: "Offline" },
      unknown: { className: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20", label: "Unknown" },
    }
    const config = statusConfig[status] || statusConfig.unknown
    return <Badge className={config.className}>{config.label}</Badge>
  }

  const getBillingBadge = (status: string) => {
    const billingConfig: Record<string, { className: string; label: string }> = {
      active: { className: "bg-blue-500/10 text-blue-300 border-blue-500/20", label: "Active" },
      overdue: { className: "bg-amber-500/10 text-amber-300 border-amber-500/20", label: "Overdue" },
      suspended: { className: "bg-red-500/10 text-red-300 border-red-500/20", label: "Suspended" },
      cancelled: { className: "bg-neutral-500/10 text-neutral-300 border-neutral-500/20", label: "Cancelled" },
      terminated: { className: "bg-neutral-700/30 text-neutral-400 border-neutral-600/30", label: "Terminated" },
    }
    const config = billingConfig[status] || billingConfig.active
    return <Badge className={config.className}>{config.label}</Badge>
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400">Please log in to view server details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'}`}>
        <Header 
          title="Server Details"
          sidebarOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
        />
        
        <main className="p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="text-neutral-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Servers
            </Button>

            {/* Loading State */}
            {isLoading && (
              <Card className="border-neutral-700/50 bg-neutral-800/40">
                <CardHeader>
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            )}

            {/* Error State */}
            {error && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-400 text-lg mb-2">Error Loading Server</p>
                  <p className="text-neutral-400 text-sm mb-4">{error}</p>
                  <Button 
                    onClick={fetchServerDetails}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Server Details */}
            {server && !isLoading && !error && (
              <>
                {/* Server Header */}
                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl text-white font-bold">{server.name}</CardTitle>
                        <p className="text-neutral-400">{server.game}</p>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(server.status)}
                        {getBillingBadge(server.billing_status)}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Server Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <Card className="border-neutral-700/50 bg-neutral-800/40">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Server Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm text-neutral-400">Server ID</label>
                        <p className="text-white font-mono">{server.id}</p>
                      </div>
                      <div>
                        <label className="text-sm text-neutral-400">IP Address</label>
                        <p className="text-white font-mono">{server.ip}</p>
                      </div>
                      <div>
                        <label className="text-sm text-neutral-400">Created</label>
                        <p className="text-white">{formatDate(server.created_at)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Billing Information */}
                  <Card className="border-neutral-700/50 bg-neutral-800/40">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Billing Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {server.expiry_date && (
                        <div>
                          <label className="text-sm text-neutral-400">Expires</label>
                          <p className="text-white">{formatDate(server.expiry_date)}</p>
                        </div>
                      )}
                      {server.overdue_amount && server.overdue_amount > 0 && (
                        <div>
                          <label className="text-sm text-neutral-400">Overdue Amount</label>
                          <p className="text-red-400 font-bold">{server.overdue_amount} coins</p>
                        </div>
                      )}
                      {server.auto_delete_at && (
                        <div>
                          <label className="text-sm text-neutral-400">Auto-delete</label>
                          <p className="text-red-400">{formatDate(server.auto_delete_at)}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons */}
                <Card className="border-neutral-700/50 bg-neutral-800/40">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      {/* Open in Panel Button */}
                      {server.pterodactyl_identifier && panelUrl && (
                        <Button
                          onClick={handleOpenPanel}
                          className="flex-1 gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open in Panel
                        </Button>
                      )}

                      {/* Renewal Button */}
                      {server.status === 'suspended' && server.overdue_amount && server.overdue_amount > 0 && (
                        <Button
                          onClick={handleRenewServer}
                          disabled={isRenewing}
                          className="flex-1 gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20"
                        >
                          <DollarSign className={`h-4 w-4 ${isRenewing ? 'animate-spin' : ''}`} />
                          {isRenewing ? 'Renewing...' : `Renew (${server.overdue_amount} coins)`}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
