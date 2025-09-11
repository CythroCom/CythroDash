"use client"

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import AdminLayout from '@/components/Admin/AdminLayout'
import UserDetailLayout from '@/components/Admin/Users/UserDetailLayout'
import UserGeneralTab from '@/components/Admin/Users/tabs/UserGeneralTab'
import UserSecurityTab from '@/components/Admin/Users/tabs/UserSecurityTab'
import UserFinancialTab from '@/components/Admin/Users/tabs/UserFinancialTab'
import UserActivityTab from '@/components/Admin/Users/tabs/UserActivityTab'
import UserReferralsTab from '@/components/Admin/Users/tabs/UserReferralsTab'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStore } from '@/stores/admin-store'
import UserTabErrorBoundary from '@/components/Admin/Users/UserTabErrorBoundary'

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params?.id)

  const { selectedUser, isLoadingSelectedUser, getUserById, getAdminLogs, getReferralAnalytics, getReferredUsers } = useAdminStore()

  React.useEffect(() => {
    if (!id || Number.isNaN(id)) return
    if (!selectedUser || selectedUser.id !== id) getUserById(id)
  }, [id, selectedUser, getUserById])

  // Prefetch data for Activity and Referrals to make tab switches instant
  React.useEffect(() => {
    if (!id || Number.isNaN(id)) return
    // Fire and forget
    getAdminLogs({ userId: id, page: 1, limit: 20 })
    getReferralAnalytics(id, 'daily')
    getReferredUsers({ userId: id, limit: 20, offset: 0 })
  }, [id, getAdminLogs, getReferralAnalytics, getReferredUsers])


  const header = (
    <div className="space-y-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin/users">Users</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>User {id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div>
        {isLoadingSelectedUser && (!selectedUser || selectedUser.id !== id) ? (
          <Skeleton className="h-8 w-64" />
        ) : (
          <div className="text-2xl font-semibold text-white">{selectedUser?.username || `User #${id}`}</div>
        )}
        <div className="text-sm text-neutral-400">ID: {id}</div>
      </div>
    </div>
  )

  return (
    <AdminLayout title={`User ${id}`}>
      <div className="p-4 md:p-6 space-y-6">
        {header}
        {!id || Number.isNaN(id) ? (
          <div className="text-neutral-400">Invalid user id</div>
        ) : (
          <UserDetailLayout
            userId={id}
            tabs={[
              { key: 'general', label: 'General', content: <UserTabErrorBoundary><UserGeneralTab userId={id} /></UserTabErrorBoundary> },
              { key: 'security', label: 'Security', content: <UserTabErrorBoundary><UserSecurityTab userId={id} /></UserTabErrorBoundary> },
              { key: 'financial', label: 'Financial', content: <UserTabErrorBoundary><UserFinancialTab userId={id} /></UserTabErrorBoundary> },
              { key: 'activity', label: 'Activity', content: <UserTabErrorBoundary><UserActivityTab userId={id} /></UserTabErrorBoundary> },
              { key: 'referrals', label: 'Referrals', content: <UserTabErrorBoundary><UserReferralsTab userId={id} /></UserTabErrorBoundary> }
            ]}
          />
        )}
      </div>
    </AdminLayout>
  )
}

