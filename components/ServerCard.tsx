"use client"

import React, { memo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Icon from "@/components/IconProvider"
import { useHoverAnimation } from "@/hooks/useAnimations"
import { useServerStore } from "@/stores/server-store"

export interface Server {
  id: string | number
  name: string
  status: "online" | "starting" | "stopping" | "offline" | "suspended" | "started" | "unknown"
  billing_status?: "active" | "overdue" | "suspended" | "cancelled" | "terminated"
  game: string
  players: { current: number; max: number }
  cpu: number
  memory: { used: number; total: number }
  uptime: string
  ip: string
}

interface ServerCardProps {
  server: Server
  onStart?: (serverId: string | number) => void
  onRestart?: (serverId: string | number) => void
  onCopyIP?: (ip: string) => void
  onOpenExternal?: (serverId: string | number) => void
}

// Memoized status badge component
const StatusBadge = memo(({ status }: { status: Server["status"] }) => {
  const statusConfig: Record<string, { className: string; label: string }> = {
    online:   { className: "bg-green-500/10 text-green-400 border-green-500/20", label: "Online" },
    started:  { className: "bg-green-500/10 text-green-400 border-green-500/20", label: "Started" },
    starting: { className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Starting" },
    stopping: { className: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Stopping" },
    suspended:{ className: "bg-red-500/10 text-red-400 border-red-500/20", label: "Suspended" },
    offline:  { className: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20", label: "Offline" },
    unknown:  { className: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20", label: "Unknown" },
  }
  const config = statusConfig[status] || statusConfig.unknown
  return <Badge className={config.className}>{config.label}</Badge>
})
StatusBadge.displayName = "StatusBadge"

// Billing badge
const BillingBadge = memo(({ status }: { status: NonNullable<Server["billing_status"]> }) => {
  const cfg: Record<string, { className: string; label: string }> = {
    active:     { className: "bg-blue-500/10 text-blue-300 border-blue-500/20", label: "Billing Active" },
    overdue:    { className: "bg-amber-500/10 text-amber-300 border-amber-500/20", label: "Overdue" },
    suspended:  { className: "bg-red-500/10 text-red-300 border-red-500/20", label: "Billing Suspended" },
    cancelled:  { className: "bg-neutral-500/10 text-neutral-300 border-neutral-500/20", label: "Cancelled" },
    terminated: { className: "bg-neutral-700/30 text-neutral-400 border-neutral-600/30", label: "Terminated" },
  }
  const c = cfg[status] || cfg.active
  return <Badge className={c.className}>{c.label}</Badge>
})
BillingBadge.displayName = "BillingBadge"
StatusBadge.displayName = "StatusBadge"

// Memoized action button component
const ActionButton = memo(({ server, onStart, onRestart }: {
  server: Server
  onStart?: (serverId: string | number) => void
  onRestart?: (serverId: string | number) => void
}) => {
  const handleClick = React.useCallback(() => {
    if (server.status === "suspended") return
    if (server.status === "starting" || server.status === "started" || server.status === "online") {
      onRestart?.(server.id)
    } else {
      onStart?.(server.id)
    }
  }, [server.id, server.status, onStart, onRestart])

  if (server.status === "suspended") {
    return (
      <Button
        className="flex-1 gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 h-12 rounded-xl font-medium"
        disabled
      >
        <Icon name="PauseCircle" className="h-4 w-4" />
        Suspended
      </Button>
    )
  }

  if (server.status === "starting") {
    return (
      <Button
        className="flex-1 gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 h-12 rounded-xl font-medium"
        onClick={handleClick}
      >
        <Icon name="Loader" className="h-4 w-4 animate-spin" />
        Starting
      </Button>
    )
  }

  if (server.status === "started") {
    return (
      <Button
        className="flex-1 gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 h-12 rounded-xl font-medium"
        onClick={handleClick}
      >
        <Icon name="CheckCircle" className="h-4 w-4" />
        Started
      </Button>
    )
  }

  return (
    <Button
      className="flex-1 gap-2 bg-neutral-600/10 hover:bg-neutral-600/20 text-neutral-300 border border-neutral-500/20 h-12 rounded-xl font-medium"
      onClick={handleClick}
    >
      <Icon name="Play" className="h-4 w-4" />
      Start
    </Button>
  )
})
ActionButton.displayName = "ActionButton"

// Main ServerCard component with optimizations
const ServerCard = memo(({ server, onStart, onRestart, onCopyIP, onOpenExternal }: ServerCardProps) => {
  const cardRef = useRef<HTMLElement>(null)

  // Optimized animations
  useHoverAnimation(cardRef as any, { scale: 1.02, translateY: -4, duration: 200 })

  // Live data selection
  const liveServer = useServerStore(React.useCallback(s => s.servers.find(x => String(x.id) === String(server.id)), [server.id])) as any

  // Memoized derived metrics
  const liveMem = liveServer?.resources?.memory
  const memoryPercentage = React.useMemo(() => {
    const used = typeof liveMem?.used === 'number' ? liveMem.used : server.memory.used
    const total = typeof liveMem?.limit === 'number' ? liveMem.limit : server.memory.total
    return Math.min(100, (used / Math.max(1, total)) * 100)
  }, [liveMem?.used, liveMem?.limit, server.memory.used, server.memory.total])

  const liveCpuUsed = liveServer?.resources?.cpu?.used
  const cpuPercentage = React.useMemo(() => {
    const v = typeof liveCpuUsed === 'number' ? liveCpuUsed : server.cpu
    return Math.min(100, v)
  }, [liveCpuUsed, server.cpu])

  // Derive effective statuses (operational + billing)
  const effectiveStatus: Server["status"] = React.useMemo(() => {
    const s = (liveServer?.status as string) || server.status
    return (s === 'online' ? 'started' : (s as any))
  }, [liveServer?.status, server.status])

  const effectiveBilling = React.useMemo(() => {
    const b = (liveServer?.billing_status as string) || (server as any).billing_status
    return (b as any) as NonNullable<Server["billing_status"]> | undefined
  }, [liveServer?.billing_status, (server as any).billing_status])


  // Memoized event handlers
  const handleCopyIP = React.useCallback(() => {
    onCopyIP?.(server.ip)
  }, [server.ip, onCopyIP])

  const handleOpenExternal = React.useCallback(() => {
    onOpenExternal?.(server.id)
  }, [server.id, onOpenExternal])

  const handleRestart = React.useCallback(() => {
    onRestart?.(server.id)
  }, [server.id, onRestart])

  return (
    <Card
      ref={cardRef as any}
      className="border border-neutral-700/30 bg-neutral-800/40 hover:bg-neutral-800/60 transition-colors-fast shadow-soft hover:shadow-strong rounded-2xl overflow-hidden card-optimized"
    >
      <CardHeader className="pb-4">
        {/* Prominent status row at the very top */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={effectiveStatus} />
            {effectiveBilling && <BillingBadge status={effectiveBilling} />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-neutral-700/30 border border-neutral-600/20 h-9 w-9 transition-colors-fast"
              onClick={handleOpenExternal}
            >
              <Icon name="ExternalLink" className="h-4 w-4 icon-optimized" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-neutral-700/30 border border-neutral-600/20 h-9 w-9 transition-colors-fast"
              onClick={handleCopyIP}
            >
              <Icon name="Copy" className="h-4 w-4 icon-optimized" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-700/50 rounded-xl flex items-center justify-center border border-neutral-600/30 shadow-lg">
            <Icon name="Database" className="h-6 w-6 text-neutral-300" />
          </div>
          <div>
            <CardTitle className="text-xl text-white font-bold">{server.name}</CardTitle>
            <p className="text-sm text-neutral-400 font-medium">{server.game}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="p-3 rounded-xl bg-neutral-700/30 border border-neutral-600/20">
            <div className="flex items-center gap-2 text-neutral-400 mb-2">
              <Icon name="Users" className="h-4 w-4" />
              Players
            </div>
            <div className="font-bold text-white text-lg">
              {server.players.current}/{server.players.max}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-neutral-700/30 border border-neutral-600/20">
            <div className="flex items-center justify-between text-sm mb-3">
              <div className="flex items-center gap-2 text-neutral-400">
                <Icon name="Clock" className="h-4 w-4" />
                Uptime
              </div>
              <span className="font-bold text-white">{(liveServer?.uptime ?? server.uptime)}</span>
            </div>
            <Progress
              value={cpuPercentage}
              className="h-3 bg-neutral-600/30 rounded-full [&>div]:bg-neutral-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-neutral-700/30 border border-neutral-600/20">
            <div className="flex items-center justify-between text-sm mb-3">
              <div className="flex items-center gap-2 text-neutral-400">
                <Icon name="Cpu" className="h-4 w-4" />
                CPU Usage
              </div>
              <span className="font-bold text-white">{Math.round(cpuPercentage)}%</span>
            </div>
            <Progress
              value={cpuPercentage}
              className="h-3 bg-neutral-600/30 rounded-full [&>div]:bg-neutral-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-neutral-700/30 border border-neutral-600/20">
            <div className="flex items-center justify-between text-sm mb-3">
              <div className="flex items-center gap-2 text-neutral-400">
                <Icon name="HardDrive" className="h-4 w-4" />
                Memory Usage
              </div>
              <span className="font-bold text-white">
                {(liveMem?.used ?? server.memory.used)}MB/{(liveMem?.limit ?? server.memory.total)}MB
              </span>
            </div>
            <Progress
              value={memoryPercentage}
              className="h-3 bg-neutral-600/30 rounded-full [&>div]:bg-neutral-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <ActionButton server={server} onStart={onStart} onRestart={onRestart} />
          <Button
            variant="outline"
            size="sm"
            className="border-neutral-600/20 hover:bg-neutral-700/30 bg-transparent h-12 w-12 rounded-xl transition-colors duration-200"
            onClick={handleRestart}
          >
            <Icon name="RotateCcw" className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})

ServerCard.displayName = "ServerCard"

export default ServerCard
