"use client"

import React, { useCallback, useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminLayout from '@/components/Admin/AdminLayout'
import { useAdminGuard } from '@/hooks/use-admin-auth'
import { useAdminServerManagementStore } from '@/stores/admin-server-management'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Server, Activity, Settings } from 'lucide-react'


// Lazy load tab components for better performance
const OverviewTab = React.lazy(() => import('@/components/Admin/ServerTabs/OverviewTab'))
const ConfigurationTab = React.lazy(() => import('@/components/Admin/ServerTabs/ConfigurationTab'))

interface ServerDetailPageProps {
  params: { id: string }
}

function ServerDetailContent({ params }: ServerDetailPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoading, hasAccess } = useAdminGuard()
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview')

  const {
    selectedServer,
    isLoadingSelectedServer,
    getServerById,
  } = useAdminServerManagementStore()

  const serverId = params.id

  const fetchServerDetails = useCallback(async () => {
    await getServerById(serverId, true) // Force refresh for detail view
  }, [getServerById, serverId])

  useEffect(() => {
    if (hasAccess && serverId) {
      fetchServerDetails()
    }
  }, [hasAccess, serverId, fetchServerDetails])

  // Update URL when tab changes
  useEffect(() => {
    const url = new URL(window.location.href)
    if (activeTab !== 'overview') {
      url.searchParams.set('tab', activeTab)
    } else {
      url.searchParams.delete('tab')
    }
    window.history.replaceState({}, '', url.toString())
  }, [activeTab])


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

  if (isLoadingSelectedServer) {
    return (
      <AdminLayout
        title="Server Details"
        subtitle="Loading server information..."
      >
        <div className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-neutral-700 rounded w-1/3"></div>
              <div className="h-6 bg-neutral-700 rounded w-1/2"></div>
              <div className="h-32 bg-neutral-700 rounded"></div>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!selectedServer) {
    return (
      <AdminLayout
        title="Server Not Found"
        subtitle="The requested server could not be found"
      >
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <Card className="border-neutral-700/50 bg-neutral-800/40">
              <CardContent className="p-6 text-center">
                <Server className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                <p className="text-neutral-400 text-lg mb-2">Server not found</p>
                <p className="text-neutral-500 text-sm mb-4">
                  The server with ID "{serverId}" does not exist or you don't have permission to view it.
                </p>
                <Button 
                  onClick={() => router.push('/admin/servers')}
                  className="bg-neutral-700 hover:bg-neutral-600"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Servers
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title={`Server: ${selectedServer.name}`}
      subtitle={`Managing server ${selectedServer.id}`}
    >
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header with server info and actions */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/servers')}
                className="border-neutral-600 hover:bg-neutral-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Servers
              </Button>

              <div>
                <h1 className="text-2xl font-bold text-white mb-1">{selectedServer.name}</h1>
                <p className="text-neutral-400">
                  Server ID: <span className="font-mono">{selectedServer.id}</span> |
                  User ID: {selectedServer.user_id} |
                  Created: {new Date(selectedServer.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>


          </div>

          {/* Tabbed interface */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-neutral-800/50 border border-neutral-700/50">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="configuration" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuration
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="overview" className="space-y-4">
                <Suspense fallback={<div className="h-64 bg-neutral-800/40 rounded animate-pulse"></div>}>
                  <OverviewTab server={selectedServer} onRefresh={fetchServerDetails} />
                </Suspense>
              </TabsContent>

              <TabsContent value="configuration" className="space-y-4">
                <Suspense fallback={<div className="h-64 bg-neutral-800/40 rounded animate-pulse"></div>}>
                  <ConfigurationTab server={selectedServer} onUpdate={fetchServerDetails} />
                </Suspense>
              </TabsContent>


            </div>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  )
}

export default function ServerDetailPage({ params }: ServerDetailPageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading server details...</p>
        </div>
      </div>
    }>
      <ServerDetailContent params={params} />
    </Suspense>
  )
}
