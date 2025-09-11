"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStore } from '@/stores/admin-store'

export default function UserSecurityTab({ userId }: { userId: number }) {
  const { selectedUser, isLoadingSelectedUser, getUserById, banUser, unbanUser } = useAdminStore()
  const [working, setWorking] = React.useState(false)

  React.useEffect(() => {
    if (!selectedUser || selectedUser.id !== userId) getUserById(userId)
  }, [userId, selectedUser, getUserById])

  if (isLoadingSelectedUser && (!selectedUser || selectedUser.id !== userId)) {
    return <Skeleton className="h-24 w-full" />
  }
  if (!selectedUser || selectedUser.id !== userId) return <div className="text-neutral-400">User not found</div>

  const isBanned = !!selectedUser.banned

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-neutral-800 p-4 bg-neutral-900/60">
        <div>
          <div className="text-sm text-neutral-300">Account Status</div>
          <div className="text-xs text-neutral-400">{isBanned ? 'Disabled' : 'Active'}</div>
        </div>
        <Button variant="outline" disabled={working} onClick={async () => {
          setWorking(true)
          try {
            if (isBanned) await unbanUser(userId)
            else await banUser(userId)
          } finally {
            setWorking(false)
          }
        }}>{isBanned ? 'Enable' : 'Disable'}</Button>
      </div>

      <div className="rounded-md border border-neutral-800 p-4 bg-neutral-900/60">
        <div className="text-sm text-neutral-300">Two-Factor Authentication (2FA)</div>
        <div className="text-xs text-neutral-400 mt-1">{selectedUser.two_factor_enabled ? 'Enabled' : 'Disabled'}</div>
      </div>
    </div>
  )
}

