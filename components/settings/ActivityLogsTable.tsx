"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/user-store"

export default function ActivityLogsTable() {
  const getSecurityLogs = useAuthStore(s => s.getSecurityLogs)
  const logsCache = useAuthStore(s => s.securityLogs)
  const [logs, setLogs] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  const loadLogs = async () => {
    setLoading(true)
    const r = await getSecurityLogs({ limit: 100 }, true)
    if (r.success) setLogs(r.logs || [])
    setLoading(false)
  }

  React.useEffect(() => { if (!logsCache?.length) loadLogs(); else setLogs(logsCache) }, [])

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'activity-logs.json'; a.click(); URL.revokeObjectURL(url)
  }
  const exportCSV = () => {
    if (!logs?.length) return
    const keys = Array.from(new Set(logs.flatMap((l:any) => Object.keys(l))))
    const header = keys.join(',')
    const rows = logs.map((l:any) => keys.map(k => JSON.stringify(l[k] ?? "")).join(','))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'activity-logs.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <Card className="bg-neutral-900/40 border-neutral-700/40">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Activity Logs</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
          <Button variant="outline" onClick={exportJSON}>Export JSON</Button>
          <Button onClick={loadLogs} disabled={loading}>{loading?"Refreshing...":"Refresh"}</Button>
        </div>
      </CardHeader>
      <CardContent>
        {!logs?.length ? (
          <div className="text-sm text-neutral-400">No activity yet.</div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
            {logs.map((l:any, idx:number) => (
              <div key={idx} className="p-3 rounded-lg bg-neutral-800/40 border border-neutral-700/30">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{l.action || l.event || "Event"}</div>
                  <div className="text-xs text-neutral-400">{new Date(l.created_at || l.timestamp || Date.now()).toLocaleString()}</div>
                </div>
                {l.ip && <div className="text-xs text-neutral-400 mt-1">IP: {l.ip}</div>}
                {l.user_agent && <div className="text-xs text-neutral-500 truncate">Agent: {l.user_agent}</div>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

