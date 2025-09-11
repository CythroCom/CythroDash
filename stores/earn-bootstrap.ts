"use client"

import { create } from "zustand"
import React from "react"
import { useAuthStore } from "@/stores/user-store"

export type EarnBootstrap = {
  daily: { status: any | null; stats: any | null }
  social: {
    discord: { connected: boolean; username?: string; discriminator?: string; connected_at?: string } | null
    github: { connected: boolean; login?: string; name?: string; connected_at?: string } | null
  }
  rewards: {
    discord: { discord_connected: boolean; reward_claimed: boolean; can_claim: boolean; reward_amount: number } | null
    github: { github_connected: boolean; reward_claimed: boolean; can_claim: boolean; reward_amount: number } | null
    firstServer: { has_server: boolean; reward_claimed: boolean; can_claim: boolean; reward_amount: number } | null
  }
  referral: { code: string | null; stats: any | null }
  servers: { count: number }
  activity: { logs: any[] | null }
}

type State = {
  data: EarnBootstrap | null
  loading: boolean
  error: string | null
  lastLoadedAt: number | null
  ttlMs: number
  inFlight: Map<string, Promise<EarnBootstrap>>
  fetch: (force?: boolean) => Promise<EarnBootstrap>
  clear: () => void
}

const TTL_MS = 2 * 60 * 1000

export const useEarnBootstrapStore = create<State>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  lastLoadedAt: null,
  ttlMs: TTL_MS,
  inFlight: new Map(),

  clear: () => set({ data: null, lastLoadedAt: null, error: null }),

  fetch: async (force = false) => {
    const { currentUser, sessionToken, getSecurityLogs } = useAuthStore.getState()
    if (!currentUser || !sessionToken) throw new Error("Not authenticated")

    const now = Date.now()
    const { lastLoadedAt, ttlMs, data, inFlight } = get()
    if (!force && data && lastLoadedAt && now - lastLoadedAt < ttlMs) return data

    const key = "bootstrap"
    if (inFlight.has(key)) return inFlight.get(key) as Promise<EarnBootstrap>

    set({ loading: true, error: null })

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sessionToken}`,
      "x-user-data": encodeURIComponent(JSON.stringify(currentUser))
    }

    const p = (async (): Promise<EarnBootstrap> => {
      try {
        const [
          dailyStatusRes,
          dailyStatsRes,
          discordStatusRes,
          githubStatusRes,
          firstServerRewardRes,
          githubRewardRes,
          discordRewardRes,
          referralGetRes,
          referralStatsRes,
          serversRes,
        ] = await Promise.all([
          fetch('/api/user/daily-login', { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ action: 'check' }) }),
          fetch('/api/user/daily-login', { method: 'GET', headers, credentials: 'include' }),
          fetch('/api/auth/discord/status', { headers, credentials: 'include' }),
          fetch('/api/auth/github/status', { headers, credentials: 'include' }),
          fetch('/api/earn/first-server-reward', { headers, credentials: 'include' }),
          fetch('/api/auth/github/reward', { headers, credentials: 'include' }),
          fetch('/api/auth/discord/reward', { headers, credentials: 'include' }),
          fetch('/api/user/referral-code', { headers, credentials: 'include' }),
          fetch('/api/referrals/stats', { headers, credentials: 'include' }),
          fetch('/api/servers/user', { headers, credentials: 'include' }),
        ])

        const [
          dailyStatus,
          dailyStats,
          discordStatus,
          githubStatus,
          firstServerReward,
          githubReward,
          discordReward,
          referralCodeResp,
          referralStats,
          servers,
        ] = await Promise.all([
          dailyStatusRes.json().catch(()=>null),
          dailyStatsRes.json().catch(()=>null),
          discordStatusRes.json().catch(()=>null),
          githubStatusRes.json().catch(()=>null),
          firstServerRewardRes.json().catch(()=>null),
          githubRewardRes.json().catch(()=>null),
          discordRewardRes.json().catch(()=>null),
          referralGetRes.json().catch(()=>null),
          referralStatsRes.json().catch(()=>null),
          serversRes.json().catch(()=>null),
        ])

        let code: string | null = referralCodeResp?.data?.referral_code || currentUser.referral_code || null
        if (!code) {
          const createResp = await fetch('/api/user/referral-code', { method: 'POST', headers, credentials: 'include' })
          const createJson = await createResp.json().catch(()=>null)
          code = createJson?.data?.referral_code || null
        }

        // Load security logs (earn-related) via auth store API with caching
        let logs: any[] = []
        try {
          const res = await getSecurityLogs?.({ limit: 100 }, true)
          if (res?.success) logs = res.logs || []
        } catch {}

        const bootstrap: EarnBootstrap = {
          daily: {
            status: dailyStatus?.success ? dailyStatus.data : null,
            stats: dailyStats?.success ? dailyStats.data : null,
          },
          social: {
            discord: discordStatus?.connected ? { connected: true, username: discordStatus.discord_user?.username, discriminator: discordStatus.discord_user?.discriminator, connected_at: discordStatus.discord_user?.connected_at } : { connected: false },
            github: githubStatus?.connected ? { connected: true, login: githubStatus.github_user?.login, name: githubStatus.github_user?.name, connected_at: githubStatus.github_user?.connected_at } : { connected: false },
          },
          rewards: {
            firstServer: firstServerReward?.success ? firstServerReward.data : null,
            github: githubReward?.success ? githubReward.data : null,
            discord: discordReward?.success ? discordReward.data : null,
          },
          referral: { code, stats: referralStats?.success ? referralStats.data : null },
          servers: { count: Array.isArray(servers?.data) ? servers.data.length : (servers?.total ?? 0) },
          activity: { logs },
        }

        set({ data: bootstrap, lastLoadedAt: Date.now(), loading: false, error: null })
        get().inFlight.delete(key)
        return bootstrap
      } catch (e:any) {
        console.error('Earn bootstrap failed', e)
        set({ error: e?.message || 'Failed to load earn data', loading: false })
        get().inFlight.delete(key)
        throw e
      }
    })()

    get().inFlight.set(key, p)
    return p
  },
}))

export function useEarnBootstrap(force = false) {
  const s = useEarnBootstrapStore()
  const refresh = React.useCallback(() => s.fetch(force), [s, force])
  React.useEffect(() => { if (!s.data && !s.loading) { void s.fetch(force) } }, [s.data, s.loading, force, s.fetch])
  return { data: s.data, loading: s.loading, error: s.error, refresh }
}

