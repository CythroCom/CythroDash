"use client"

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStore } from '@/stores/admin-store'
import { useAuthStore } from '@/stores/user-store'

interface LedgerEntry {
  id: string
  amount: number
  balance_after: number
  reason: string
  created_at: string
}

export default function UserFinancialTab({ userId }: { userId: number }) {
  const { selectedUser, isLoadingSelectedUser, getUserById, adjustUserCoins } = useAdminStore()
  const { currentUser } = useAuthStore()
  const [entries, setEntries] = React.useState<LedgerEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [working, setWorking] = React.useState(false)

  React.useEffect(() => {
    if (!selectedUser || selectedUser.id !== userId) getUserById(userId)
  }, [userId, selectedUser, getUserById])

  const loadEntries = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/coins?page=${page}&limit=20`, {
        headers: {
          'x-user-data': JSON.stringify(currentUser || {}),
        },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setEntries(data.items || data.entries || [])
      }
    } finally {
      setLoading(false)
    }
  }, [userId, page, currentUser])

  React.useEffect(() => { loadEntries() }, [loadEntries])

  if (isLoadingSelectedUser && (!selectedUser || selectedUser.id !== userId)) {
    return <Skeleton className="h-24 w-full" />
  }
  if (!selectedUser || selectedUser.id !== userId) return <div className="text-neutral-400">User not found</div>

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <div className="text-xs text-neutral-400">Current Balance</div>
          <div className="text-2xl text-white">{selectedUser.coins}</div>
        </div>
        <div className="flex-1" />
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (+/-)" className="max-w-[140px] bg-neutral-800/50 border-neutral-700/50" />
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="max-w-[220px] bg-neutral-800/50 border-neutral-700/50" />
        <Button disabled={working || !amount || !reason} onClick={async () => {
          const val = parseInt(amount, 10)
          if (!val) return
          setWorking(true)
          try {
            await adjustUserCoins(userId, val, reason)
            setAmount(''); setReason('')
            await getUserById(userId)
            await loadEntries()
          } finally {
            setWorking(false)
          }
        }}>Apply</Button>
      </div>

      <div className="rounded-md border border-neutral-800 bg-neutral-900/60 overflow-hidden">
        <div className="grid grid-cols-5 px-4 py-2 text-xs uppercase text-neutral-400">
          <div>Date</div>
          <div>Amount</div>
          <div>Balance</div>
          <div className="col-span-2">Reason</div>
        </div>
        {loading ? (
          <div className="divide-y divide-neutral-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-5 items-center px-4 py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <div className="col-span-2">
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-sm text-neutral-400">No transactions</div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {entries.map((e) => (
              <div key={e.id} className="grid grid-cols-5 items-center px-4 py-3 text-sm">
                <div className="text-neutral-400">{new Date(e.created_at).toLocaleString()}</div>
                <div className={e.amount >= 0 ? 'text-green-400' : 'text-red-400'}>{e.amount >= 0 ? `+${e.amount}` : e.amount}</div>
                <div className="text-neutral-200">{e.balance_after}</div>
                <div className="col-span-2 text-neutral-300 truncate">{e.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
        <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  )
}

