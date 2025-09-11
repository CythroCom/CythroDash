"use client"

import React from "react"
import SocialAccountCard from "./SocialAccountCard"
import { useAuthStore } from "@/stores/user-store"
import { showError, showSuccess } from "@/lib/toast"

export default function ConnectionsSection() {
  const user = useAuthStore(s => s.currentUser)
  const [providers, setProviders] = React.useState<{discord:{enabled:boolean,login:boolean},github:{enabled:boolean,login:boolean}} | null>(null)
  const [discordConnected, setDiscordConnected] = React.useState<boolean>(false)
  const [githubConnected, setGithubConnected] = React.useState<boolean>(false)
  const [loading, setLoading] = React.useState<boolean>(true)

  const authHeaders = React.useMemo(() => {
    const h: HeadersInit = { "Content-Type": "application/json" }
    if (user) {
      try {
        ;(h as any)["x-user-data"] = encodeURIComponent(JSON.stringify({ id: user.id, username: user.username, email: user.email }))
      } catch {}
    }
    return h
  }, [user])

  const refreshStatus = React.useCallback(async () => {
    if (!providers) return
    try {
      if (providers.discord.login && user) {
        const dr = await fetch("/api/auth/discord/status", { headers: authHeaders, credentials: "include" })
        const dj = await dr.json()
        setDiscordConnected(!!dj?.connected)
      } else {
        setDiscordConnected(false)
      }

      if (providers.github.login && user) {
        const gr = await fetch("/api/auth/github/status", { headers: authHeaders, credentials: "include" })
        const gj = await gr.json()
        setGithubConnected(!!gj?.connected)
      } else {
        setGithubConnected(false)
      }
    } catch (e) {
      // swallow
    }
  }, [providers, user, authHeaders])

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/auth/providers", { cache: "no-store" })
        const json = await res.json()
        if (json?.success && json.providers) setProviders(json.providers)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  React.useEffect(() => { void refreshStatus() }, [providers, refreshStatus])

  const connect = (provider: 'discord' | 'github') => {
    window.location.href = `/api/auth/${provider}`
  }

  const disconnect = async (provider: 'discord' | 'github') => {
    try {
      const url = `/api/auth/${provider}/status`
      const res = await fetch(url, { method: 'DELETE', headers: authHeaders, credentials: 'include' })
      const j = await res.json()
      if (j?.success) {
        showSuccess(`${provider === 'discord' ? 'Discord' : 'GitHub'} disconnected`)
        await refreshStatus()
      } else {
        showError('Failed', j?.message || `Failed to disconnect ${provider}`)
      }
    } catch (e: any) {
      showError('Error', e?.message || `Failed to disconnect ${provider}`)
    }
  }

  if (loading && !providers) {
    return (
      <div className="space-y-2">
        <div className="h-10 bg-neutral-800/40 rounded animate-pulse" />
        <div className="h-10 bg-neutral-800/40 rounded animate-pulse" />
      </div>
    )
  }

  const showDiscord = !!providers?.discord?.login
  const showGithub = !!providers?.github?.login

  if (!showDiscord && !showGithub) {
    return (
      <div className="rounded-lg border border-neutral-700/40 bg-neutral-800/30 p-6 text-center text-neutral-400">
        No connection providers are enabled.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {showDiscord && (
        <SocialAccountCard
          provider="Discord"
          connected={discordConnected}
          onConnect={() => connect('discord')}
          onDisconnect={() => disconnect('discord')}
        />
      )}
      {showGithub && (
        <SocialAccountCard
          provider="GitHub"
          connected={githubConnected}
          onConnect={() => connect('github')}
          onDisconnect={() => disconnect('github')}
        />
      )}
    </div>
  )
}

