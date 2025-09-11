"use client"

import React from "react"
import { useAuthStore } from "@/stores/user-store"
import { showSuccess, showError, showConfirm } from "@/lib/toast"

export type DiscordStatus = { connected: boolean; username?: string; discriminator?: string; connected_at?: string }
export type GitHubStatus = { connected: boolean; login?: string; name?: string; connected_at?: string }

export function useSocialConnections() {
  const user = useAuthStore(s => s.currentUser)
  const authHeaders = React.useMemo(() => ({
    "x-user-data": encodeURIComponent(JSON.stringify(user ?? {}))
  }), [user])

  const [discord, setDiscord] = React.useState<DiscordStatus | null>(null)
  const [github, setGithub] = React.useState<GitHubStatus | null>(null)
  const [loading, setLoading] = React.useState(false)

  const refresh = React.useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [d, g] = await Promise.all([
        fetch("/api/auth/discord/status", { headers: authHeaders, credentials: "include" }).then(r => r.json()).catch(() => ({})),
        fetch("/api/auth/github/status", { headers: authHeaders, credentials: "include" }).then(r => r.json()).catch(() => ({})),
      ])
      setDiscord(d?.connected ? { connected: true, username: d.discord_user?.username, discriminator: d.discord_user?.discriminator, connected_at: d.discord_user?.connected_at } : { connected: false })
      setGithub(g?.connected ? { connected: true, login: g.github_user?.login, name: g.github_user?.name, connected_at: g.github_user?.connected_at } : { connected: false })
    } finally { setLoading(false) }
  }, [user, authHeaders])

  const completePendingIfAny = React.useCallback(async (search: URLSearchParams) => {
    const discordPending = search.get("discord_pending") === "true"
    const githubPending = search.get("github_pending") === "true"
    try {
      if (discordPending && user) {
        const res = await fetch("/api/auth/discord/connect", { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, credentials: "include" })
        const j = await res.json()
        if (j.success) showSuccess("Discord connected", j.message)
        else showError("Discord connection failed", j.message)
      }
      if (githubPending && user) {
        const res = await fetch("/api/auth/github/connect", { method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" }, credentials: "include" })
        const j = await res.json()
        if (j.success) showSuccess("GitHub connected", j.message)
        else showError("GitHub connection failed", j.message)
      }
      if (discordPending || githubPending) await refresh()
    } catch {}
  }, [user, authHeaders, refresh])

  const connectDiscord = React.useCallback(() => { window.location.href = "/api/auth/discord" }, [])
  const connectGitHub = React.useCallback(() => { window.location.href = "/api/auth/github" }, [])

  const disconnectDiscord = React.useCallback(async () => {
    const ok = await showConfirm("Disconnect Discord account?", "You can reconnect anytime.")
    if (!ok) return
    const res = await fetch("/api/auth/discord/status", { method: "DELETE", headers: authHeaders, credentials: "include" })
    const j = await res.json();
    if (j.success) showSuccess("Discord disconnected", j.message); else showError("Failed to disconnect", j.message)
    await refresh()
  }, [authHeaders, refresh])

  const disconnectGitHub = React.useCallback(async () => {
    const ok = await showConfirm("Disconnect GitHub account?", "You can reconnect anytime.")
    if (!ok) return
    const res = await fetch("/api/auth/github/status", { method: "DELETE", headers: authHeaders, credentials: "include" })
    const j = await res.json();
    if (j.success) showSuccess("GitHub disconnected", j.message); else showError("Failed to disconnect", j.message)
    await refresh()
  }, [authHeaders, refresh])

  return {
    discord, github, loading,
    refresh, completePendingIfAny,
    connectDiscord, disconnectDiscord,
    connectGitHub, disconnectGitHub,
  }
}

