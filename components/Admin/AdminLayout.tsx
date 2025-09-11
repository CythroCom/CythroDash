"use client"

import React, { memo, useState, useCallback, useEffect } from 'react'
import { useAdminGuard } from '@/hooks/use-admin-auth'
import AdminSidebar from './AdminSidebar'
import AdminTopbar from './AdminTopbar'
import { useAdminSettingsStore } from '@/stores/admin-settings-store'

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

const AdminLayout = memo(({ 
  children, 
  title, 
  subtitle, 
  searchQuery, 
  onSearchChange 
}: AdminLayoutProps) => {
  const { isLoading, hasAccess } = useAdminGuard()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const fetchAllSettings = useAdminSettingsStore(s => s.fetchAll)

  useEffect(() => {
    // Warm up admin data while guard is verifying access
    void fetchAllSettings()
  }, [fetchAllSettings])

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  const handleMenuClick = useCallback(() => {
    setSidebarOpen(true)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-6">
          <div className="space-y-3">
            <div className="h-6 w-1/3 bg-neutral-700/50 rounded" />
            <div className="h-4 w-2/3 bg-neutral-700/40 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 bg-neutral-800/40 border border-neutral-700/40 rounded" />
            <div className="h-20 bg-neutral-800/40 border border-neutral-700/40 rounded" />
            <div className="h-20 bg-neutral-800/40 border border-neutral-700/40 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-10 bg-neutral-800/40 border border-neutral-700/40 rounded" />
            <div className="h-10 bg-neutral-800/40 border border-neutral-700/40 rounded" />
            <div className="h-10 bg-neutral-800/40 border border-neutral-700/40 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-neutral-400 mb-6">
            You don't have permission to access the admin panel. Please contact an administrator if you believe this is an error.
          </p>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onToggle={handleSidebarToggle} />

      {/* Main content area - positioned beside sidebar */}
      <div className={`
        min-h-screen transition-all duration-200
        ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'}
      `}>
        {/* Topbar */}
        <AdminTopbar
          title={title}
          subtitle={subtitle}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onMenuClick={handleMenuClick}
          sidebarOpen={false} // Don't apply margin in topbar since parent handles it
        />

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  )
})

AdminLayout.displayName = 'AdminLayout'

export default AdminLayout
