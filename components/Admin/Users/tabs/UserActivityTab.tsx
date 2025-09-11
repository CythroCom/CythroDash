"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStore } from '@/stores/admin-store'

interface LogItem {
  id: string
  category: string
  action: string
  created_at: string
  meta?: Record<string, any>
}

export default function UserActivityTab({ userId }: { userId: number }) {
  const { getAdminLogs } = useAdminStore()
  const [items, setItems] = React.useState<LogItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getAdminLogs({ userId, page, limit: 20 })
    if (result.success) setItems(result.items as LogItem[])
    else setError(result.message || 'Failed to load activity')
    setLoading(false)
  }, [userId, page, getAdminLogs])

  React.useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-neutral-800 bg-neutral-900/60 overflow-hidden">
        <div className="grid grid-cols-4 px-4 py-2 text-xs uppercase text-neutral-400">
          <div>Date</div>
          <div>Category</div>
          <div className="col-span-2">Action</div>
        </div>
        {loading ? (
          <div className="divide-y divide-neutral-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-4 items-center px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <div className="col-span-2"><Skeleton className="h-4 w-64" /></div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-neutral-400">No activity</div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {items.map((e) => (
              <div key={e.id} className="grid grid-cols-4 items-center px-4 py-3 text-sm">
                <div className="text-neutral-400">{new Date(e.created_at).toLocaleString()}</div>
                <div className="text-neutral-300">{e.category}</div>
                <div className="col-span-2 text-neutral-200 truncate">{e.action}</div>
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

