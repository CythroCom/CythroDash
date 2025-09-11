"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Props = {
  provider: "Discord" | "GitHub"
  connected: boolean
  subtitle?: string
  onConnect: () => void
  onDisconnect: () => void
}

export default function SocialAccountCard({ provider, connected, subtitle, onConnect, onDisconnect }: Props) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/40 border border-neutral-700/30">
      <div className="flex items-center gap-3">
        <div className={`h-8 w-8 rounded flex items-center justify-center ${provider==='Discord'?'bg-indigo-600/20':'bg-neutral-600/20'}`}>{provider[0]}</div>
        <div>
          <div className="font-medium">{provider}</div>
          <div className="text-xs text-neutral-400">{subtitle || (connected?"Connected":"Not connected")}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {connected ? <Badge variant="secondary">Connected</Badge> : <Badge variant="outline">Not connected</Badge>}
        {connected ? (
          <Button variant="outline" onClick={onDisconnect}>Disconnect</Button>
        ) : (
          <Button onClick={onConnect}>Connect</Button>
        )}
      </div>
    </div>
  )
}

