"use client"

import React, { memo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import Icon from "@/components/IconProvider"
import { useHoverAnimation } from "@/hooks/useAnimations"

import { useAuthStore } from "@/stores/user-store"
import { showError, showConfirm } from "@/lib/toast"

export interface Server {
  id: string | number
  name: string
  status: "online" | "starting" | "stopping" | "offline" | "suspended" | "started" | "unknown"
  billing_status?: "active" | "overdue" | "suspended" | "cancelled" | "terminated"
  game: string
  ip: string
  // Additional fields for lifecycle management
  expiry_date?: string
  auto_delete_at?: string
  overdue_amount?: number
}

interface ServerCardProps {
  server: Server
  onCopyIP?: (ip: string) => void
  onOpenExternal?: (serverId: string | number) => void
  onRenew?: (serverId: string | number) => void
  onManageServer?: (serverId: string | number) => void
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

// Enhanced billing badge with lifecycle status
const BillingBadge = memo(({ status, server }: { status: NonNullable<Server["billing_status"]>; server: Server }) => {
  const cfg: Record<string, { className: string; label: string }> = {
    active:     { className: "bg-blue-500/10 text-blue-300 border-blue-500/20", label: "Active" },
    overdue:    { className: "bg-amber-500/10 text-amber-300 border-amber-500/20", label: "Overdue" },
    suspended:  { className: "bg-red-500/10 text-red-300 border-red-500/20", label: "Suspended" },
    cancelled:  { className: "bg-neutral-500/10 text-neutral-300 border-neutral-500/20", label: "Cancelled" },
    terminated: { className: "bg-neutral-700/30 text-neutral-400 border-neutral-600/30", label: "Terminated" },
  }

  // Show "Pending Deletion" if auto_delete_at is set
  if (server.auto_delete_at && status === 'suspended') {
    const deleteDate = new Date(server.auto_delete_at);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.ceil((deleteDate.getTime() - now.getTime()) / (1000 * 60 * 60)));

    return (
      <Badge className="bg-red-600/20 text-red-200 border-red-500/30">
        Pending Deletion ({hoursLeft}h)
      </Badge>
    );
  }

  const c = cfg[status] || cfg.active
  return <Badge className={c.className}>{c.label}</Badge>
})
BillingBadge.displayName = "BillingBadge"
StatusBadge.displayName = "StatusBadge"

// Renewal button component
const RenewalButton = memo(({ server, onRenew }: {
  server: Server
  onRenew?: (serverId: string | number) => void
}) => {
  const [isRenewing, setIsRenewing] = useState(false);
  const user = useAuthStore(s => s.currentUser);

  const handleRenew = React.useCallback(async () => {
    if (!user || !onRenew) return;

    const overdueAmount = server.overdue_amount || 0;
    if (overdueAmount <= 0) {
      showError("No overdue amount", "This server doesn't have any overdue payments.");
      return;
    }

    const confirmed = await showConfirm(
      "Renew Server",
      `This will charge ${overdueAmount} coins to renew your server. Continue?`
    );

    if (!confirmed) return;

    setIsRenewing(true);
    try {
      onRenew(server.id);
    } finally {
      setIsRenewing(false);
    }
  }, [server.id, server.overdue_amount, user, onRenew]);

  if (server.status === "suspended" && server.overdue_amount && server.overdue_amount > 0) {
    return (
      <Button
        className="flex-1 gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 h-12 rounded-xl font-medium"
        onClick={handleRenew}
        disabled={isRenewing}
      >
        <Icon name={isRenewing ? "Loader" : "DollarSign"} className={`h-4 w-4 ${isRenewing ? "animate-spin" : ""}`} />
        {isRenewing ? "Renewing..." : `Renew (${server.overdue_amount} coins)`}
      </Button>
    );
  }

  return null;
});
RenewalButton.displayName = "RenewalButton";

// Memoized action button component - shows manage button for active servers, renewal for suspended
const ActionButton = memo(({ server, onRenew, onManageServer }: {
  server: Server
  onRenew?: (serverId: string | number) => void
  onManageServer?: (serverId: string | number) => void
}) => {
  // Show renewal button for suspended servers with overdue amount
  if (server.status === "suspended") {
    return <RenewalButton server={server} onRenew={onRenew} />;
  }

  // For active servers, show "Manage Server" button
  const isStarting = server.status === "starting"
  const isOnline = server.status === "online" || server.status === "started"
  const isActive = isOnline || isStarting

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('ServerCard Debug:', {
      serverId: server.id,
      serverName: server.name,
      status: server.status,
      isStarting,
      isOnline,
      isActive,
      hasManageCallback: !!onManageServer
    });
  }

  if (isActive && onManageServer) {
    return (
      <Button
        className="flex-1 gap-2 h-12 rounded-xl font-medium transition-all duration-200 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20"
        onClick={() => onManageServer(server.id)}
      >
        <Icon name="Settings" className="h-4 w-4" />
        Manage Server
      </Button>
    )
  }

  // Fallback status display for other states
  return (
    <Button
      className={`flex-1 gap-2 h-12 rounded-xl font-medium transition-all duration-200 ${
        isOnline
          ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : isStarting
          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
          : "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
      } cursor-default`}
      disabled
    >
      <Icon
        name={isStarting ? "Loader" : isOnline ? "CheckCircle" : "Clock"}
        className={`h-4 w-4 ${isStarting ? "animate-spin" : ""}`}
      />
      {isStarting ? "Starting..." : isOnline ? "Running" : "Offline"}
    </Button>
  )
})
ActionButton.displayName = "ActionButton"

// Main ServerCard component with optimizations
const ServerCard = memo(({ server, onCopyIP, onOpenExternal, onRenew, onManageServer }: ServerCardProps) => {
  const cardRef = useRef<HTMLElement>(null)

  // Optimized animations
  useHoverAnimation(cardRef as any, { scale: 1.02, translateY: -4, duration: 200 })

  // Server status logic
  const effectiveStatus: Server["status"] = React.useMemo(() => {
    return server.status === 'online' ? 'started' : server.status
  }, [server.status])

  const effectiveBilling = React.useMemo(() => {
    return server.billing_status
  }, [server.billing_status])


  // Memoized event handlers
  const handleCopyIP = React.useCallback(() => {
    onCopyIP?.(server.ip)
  }, [server.ip, onCopyIP])

  const handleOpenExternal = React.useCallback(() => {
    onOpenExternal?.(server.id)
  }, [server.id, onOpenExternal])



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
            {effectiveBilling && <BillingBadge status={effectiveBilling} server={server} />}
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
        <div className="flex gap-3 pt-2">
          <ActionButton server={server} onRenew={onRenew} onManageServer={onManageServer} />
        </div>
      </CardContent>
    </Card>
  )
})

ServerCard.displayName = "ServerCard"

export default ServerCard
