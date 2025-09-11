"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/user-store"

export default function EarnActivity({ preloadedLogs, suppressFetch = false }: { preloadedLogs?: any[] | null; suppressFetch?: boolean } = {}) {
  const user = useAuthStore(s => s.currentUser)
  const [logs, setLogs] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  const loadLogs = async () => {
    if (!user) return
    setLoading(true)
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-user-data': encodeURIComponent(JSON.stringify({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }))
      }

      const response = await fetch('/api/user/earn-logs?limit=50', {
        method: 'GET',
        headers,
        credentials: 'include'
      })

      const result = await response.json()
      if (result.success) {
        setLogs(result.data.logs || [])
      }
    } catch (error) {
      console.error('Failed to load earn logs:', error)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (preloadedLogs && Array.isArray(preloadedLogs)) {
      setLogs(preloadedLogs)
    } else if (!suppressFetch) {
      loadLogs()
    }
  }, [preloadedLogs, suppressFetch, user])

  const entries = React.useMemo(() => {
    return (logs || [])
      .map((log: any) => ({
        time: new Date(log.time || log.created_at || Date.now()),
        title: log.title || 'Earning Event',
        description: log.description || '',
        amount: log.amount
      }))
      .sort((a: any, b: any) => b.time.getTime() - a.time.getTime())
      .slice(0, 30)
  }, [logs])

  return (
    <Card className="bg-neutral-900/40 border-neutral-700/40">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Earning Logs</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadLogs} disabled={loading}>{loading?"Refreshing...":"Refresh"}</Button>
        </div>
      </CardHeader>
      <CardContent>
        {!entries?.length ? (
          <div className="text-sm text-neutral-400">No earning activity yet.</div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
            {entries.map((e:any, idx:number) => (
              <div key={idx} className="p-3 rounded-lg bg-neutral-800/40 border border-neutral-700/30">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{e.title}</div>
                  <div className="text-xs text-neutral-400">{e.time.toLocaleString()}</div>
                </div>
                <div className="text-xs text-neutral-400 mt-1">{e.description}</div>
                {typeof e.amount !== 'undefined' && (
                  <div className={`text-xs mt-1 ${e.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{e.amount >= 0 ? `+${e.amount}` : e.amount} coins</div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

