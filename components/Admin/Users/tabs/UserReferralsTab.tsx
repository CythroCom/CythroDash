"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStore } from '@/stores/admin-store'

interface Analytics {
  clicks: number
  signups: number
  conversions: number
  earned_coins?: number
}

interface ReferredUser {
  id: number
  username: string
  email: string
  created_at: string
}

export default function UserReferralsTab({ userId }: { userId: number }) {
  const { getReferralAnalytics, getReferredUsers } = useAdminStore()
  const [summary, setSummary] = React.useState<Analytics | null>(null)
  const [users, setUsers] = React.useState<ReferredUser[]>([])
  const [loading, setLoading] = React.useState(true)
  const [offset, setOffset] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const [a, u] = await Promise.all([
      getReferralAnalytics(userId, 'daily'),
      getReferredUsers({ userId, limit: 20, offset }),
    ])
    if (a.success) setSummary((a.data as any) || null); else setError(a.message || 'Failed to load referral analytics')
    if (u.success) setUsers((u.items as any) || []); else setError(u.message || 'Failed to load referred users')
    setLoading(false)
  }, [userId, offset, getReferralAnalytics, getReferredUsers])

  React.useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {summary ? (
          <>
            <div className="rounded-md border border-neutral-800 p-4 bg-neutral-900/60"><div className="text-xs text-neutral-400">Clicks</div><div className="text-xl text-white">{summary.clicks}</div></div>
            <div className="rounded-md border border-neutral-800 p-4 bg-neutral-900/60"><div className="text-xs text-neutral-400">Signups</div><div className="text-xl text-white">{summary.signups}</div></div>
            <div className="rounded-md border border-neutral-800 p-4 bg-neutral-900/60"><div className="text-xs text-neutral-400">Conversions</div><div className="text-xl text-white">{summary.conversions}</div></div>
            <div className="rounded-md border border-neutral-800 p-4 bg-neutral-900/60"><div className="text-xs text-neutral-400">Earned Coins</div><div className="text-xl text-white">{summary.earned_coins ?? 0}</div></div>
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        )}
      </div>

      <div className="rounded-md border border-neutral-800 bg-neutral-900/60 overflow-hidden">
        <div className="grid grid-cols-4 px-4 py-2 text-xs uppercase text-neutral-400">
          <div>ID</div>
          <div>Username</div>
          <div>Email</div>
          <div>Signed Up</div>
        </div>
        {loading ? (
          <div className="divide-y divide-neutral-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-4 items-center px-4 py-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="p-4 text-sm text-neutral-400">No referred users</div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {users.map((u) => (
              <div key={u.id} className="grid grid-cols-4 items-center px-4 py-3 text-sm">
                <div className="text-neutral-400">{u.id}</div>
                <div className="text-neutral-200">{u.username}</div>
                <div className="text-neutral-300 truncate">{u.email}</div>
                <div className="text-neutral-400">{new Date(u.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 20))}>Previous</Button>
        <Button variant="outline" onClick={() => setOffset((o) => o + 20)}>Next</Button>
      </div>
    </div>
  )
}

