"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDailyLoginStore } from "@/stores/daily-login-store"
import { useAuthStore } from "@/stores/user-store"
import { useSocialConnections } from "@/hooks/useSocialConnections"
import { useServerStore } from "@/stores/server-store"
import { showError, showSuccess } from "@/lib/toast"
import Link from "next/link"

function TaskRow({ title, description, reward, status, action }: { title: string, description: string, reward: number | string, status: 'completed'|'available'|'locked', action?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-neutral-800/40 border border-neutral-700/30 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium text-white truncate">{title}</div>
          <Badge variant={status==='completed'?'secondary':status==='available'?'outline':'outline'}>{status}</Badge>
        </div>
        <div className="text-xs text-neutral-400 truncate">{description}</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-neutral-300">+{reward} coins</div>
        {action}
      </div>
    </div>
  )
}

export default function EarnTasksCard({ preloaded, suppressFetch = false }: { preloaded?: { dailyLoginStatus?: any | null; discordReward?: any | null; githubReward?: any | null; firstServerStatus?: any | null; discord?: any | null; github?: any | null; serversCount?: number; referralCode?: string | null; referralStats?: any | null }; suppressFetch?: boolean } = {}) {
  const user = useAuthStore(s => s.currentUser)
  const updateCoins = useAuthStore(s => s.updateCoins)
  const dailyEnabled = (process.env.NEXT_PUBLIC_DAILY_LOGIN_BONUS || "false") === "true"
  const dailyAmount = parseInt(process.env.NEXT_PUBLIC_DAILY_LOGIN_BONUS_AMOUNT || "10", 10)

  const { dailyLoginStatus, checkDailyLoginStatus, claimDailyBonus, isChecking, isClaiming } = useDailyLoginStore()
  const effectiveDailyStatus = preloaded?.dailyLoginStatus ?? dailyLoginStatus
  const { discord, github, refresh, connectDiscord, connectGitHub } = useSocialConnections()
  const effectiveDiscord = preloaded?.discord ?? discord
  const effectiveGithub = preloaded?.github ?? github
  const { servers, fetchServers } = useServerStore()
  const preloadedServersCount = preloaded?.serversCount ?? undefined



  // Task reward status states
  const [firstServerStatus, setFirstServerStatus] = React.useState<{ has_server: boolean; reward_claimed: boolean; can_claim: boolean; reward_amount: number } | null>(preloaded?.firstServerStatus ?? null)
  const [githubReward, setGithubReward] = React.useState<{ github_connected: boolean; reward_claimed: boolean; can_claim: boolean; reward_amount: number } | null>(preloaded?.githubReward ?? null)
  const [discordReward, setDiscordReward] = React.useState<{ discord_connected: boolean; reward_claimed: boolean; can_claim: boolean; reward_amount: number } | null>(preloaded?.discordReward ?? null)

  const headersFor = React.useCallback((): HeadersInit => {
    if (!user) return { 'Content-Type': 'application/json' }
    return {
      'Content-Type': 'application/json',
      'x-user-data': encodeURIComponent(JSON.stringify({ id: user.id, username: user.username, email: user.email, role: user.role }))
    }
  }, [user])

  React.useEffect(() => { if (!suppressFetch) { void checkDailyLoginStatus?.(true); void refresh(); void fetchServers(); } }, [checkDailyLoginStatus, refresh, fetchServers, suppressFetch])

  const reloadStatuses = React.useCallback(async () => {
    if (!user) return
    const headers = headersFor()
    try {
      const [fs, gh, dc] = await Promise.all([
        fetch('/api/earn/first-server-reward', { method: 'GET', headers, credentials: 'include' }).then(r=>r.json()).catch(()=>null),
        fetch('/api/auth/github/reward', { method: 'GET', headers, credentials: 'include' }).then(r=>r.json()).catch(()=>null),
        fetch('/api/auth/discord/reward', { method: 'GET', headers, credentials: 'include' }).then(r=>r.json()).catch(()=>null),
      ])
      if (fs?.success) setFirstServerStatus(fs.data)
      if (gh?.success) setGithubReward(gh.data)
      if (dc?.success) setDiscordReward(dc.data)
    } catch (e) {
      console.warn('Failed reloading task statuses', e)
    }
  }, [user, headersFor])

  // Initial load of task statuses
  React.useEffect(() => { if (!suppressFetch) { void reloadStatuses() } }, [reloadStatuses, suppressFetch])

  // Daily bonus claim action
  const onClaim = async () => {
    const ok = await claimDailyBonus?.()
    if (ok) showSuccess("Daily bonus claimed", `+${dailyAmount} coins added`)
    else showError("Claim failed", "Please try again later")
  }

  // Actions
  const claimFirstServer = async () => {
    if (!user) return
    const headers = headersFor()
    const resp = await fetch('/api/earn/first-server-reward', { method: 'POST', headers, credentials: 'include' })
    const json = await resp.json()
    if (json?.success) {
      const awarded = json?.data?.coins_awarded || 0
      if (awarded > 0) {
        updateCoins?.(awarded)
        showSuccess('First server reward granted', `+${awarded} coins added`)
      }
      setFirstServerStatus(s => ({ ...(s||{ has_server: true, reward_amount: json?.data?.coins_awarded || 50, can_claim: false }), reward_claimed: true, can_claim: false }))
      void reloadStatuses()
    } else {
      showError('Claim failed', json?.message || 'Please try again later')
    }
  }

  const claimGithub = async () => {
    if (!user) return
    const headers = headersFor()
    const resp = await fetch('/api/auth/github/reward', { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ action: 'claim' }) })
    const json = await resp.json()
    if (json?.success) {
      const awarded = json?.data?.coins_awarded || 0
      if (awarded > 0) { updateCoins?.(awarded); showSuccess('GitHub reward claimed', `+${awarded} coins added`) }
      setGithubReward(s => ({ ...(s||{ github_connected: true, reward_amount: 40, can_claim: false }), reward_claimed: true, can_claim: false }))
      void reloadStatuses()
    } else {
      showError('Claim failed', json?.message || 'Please try again later')
    }
  }

  const claimDiscord = async () => {
    if (!user) return
    const headers = headersFor()
    const resp = await fetch('/api/auth/discord/reward', { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ action: 'claim' }) })
    const json = await resp.json()
    if (json?.success) {
      const awarded = json?.data?.coins_awarded || 0
      if (awarded > 0) { updateCoins?.(awarded); showSuccess('Discord reward claimed', `+${awarded} coins added`) }
      setDiscordReward(s => ({ ...(s||{ discord_connected: true, reward_amount: 25, can_claim: false }), reward_claimed: true, can_claim: false }))
      void reloadStatuses()
    } else {
      showError('Claim failed', json?.message || 'Please try again later')
    }
  }





  const tasks: React.ReactNode[] = []

  // Daily login task
  if (dailyEnabled) {
    const canClaim = !!effectiveDailyStatus?.canClaim
    const already = !!effectiveDailyStatus?.alreadyClaimed
    tasks.push(
      <TaskRow
        key="daily"
        title="Daily Login Bonus"
        description={already?"Already claimed today":"Log in daily to claim your reward"}
        reward={dailyAmount}
        status={already? 'completed' : canClaim ? 'available' : 'locked'}
        action={already ? <Badge variant="secondary">Claimed</Badge> : (
          <Button disabled={!canClaim || isClaiming || isChecking} onClick={onClaim}>{isClaiming?"Claiming...":"Claim"}</Button>
        )}
      />
    )
  }

  // Discord connection task (requires claim)
  const discordConnected = !!effectiveDiscord?.connected || !!discordReward?.discord_connected
  const discordClaimed = !!discordReward?.reward_claimed
  tasks.push(
    <TaskRow
      key="discord"
      title="Connect Discord"
      description={discordConnected ? (discordClaimed ? "Reward claimed" : "Discord connected, claim your reward") : "Connect your Discord account in settings"}
      reward={discordReward?.reward_amount || 25}
      status={discordClaimed ? 'completed' : (discordConnected ? 'available' : 'locked')}
      action={discordClaimed ? <Badge variant="secondary">Done</Badge> : (
        discordConnected ? (
          <Button onClick={claimDiscord}>Claim</Button>
        ) : (
          <div className="flex gap-2">
            <Link href="/settings"><Button variant="outline">Settings</Button></Link>
            <Button onClick={connectDiscord}>Connect</Button>
          </div>
        )
      )}
    />
  )

  // GitHub connection task (requires claim)
  const githubConnected = !!effectiveGithub?.connected || !!githubReward?.github_connected
  const githubClaimed = !!githubReward?.reward_claimed
  tasks.push(
    <TaskRow
      key="github"
      title="Connect GitHub"
      description={githubConnected ? (githubClaimed ? "Reward claimed" : "GitHub connected, claim your reward") : "Connect your GitHub account in settings"}
      reward={githubReward?.reward_amount || 40}
      status={githubClaimed ? 'completed' : (githubConnected ? 'available' : 'locked')}
      action={githubClaimed ? <Badge variant="secondary">Done</Badge> : (
        githubConnected ? (
          <Button onClick={claimGithub}>Claim</Button>
        ) : (
          <div className="flex gap-2">
            <Link href="/settings"><Button variant="outline">Settings</Button></Link>
            <Button onClick={connectGitHub}>Connect</Button>
          </div>
        )
      )}
    />
  )



  // Referral task - redirect to /referrals page
  tasks.push(
    <TaskRow
      key="referral"
      title="Invite Friends"
      description="Manage your referral program and track earnings"
      reward="Varies"
      status={'available'}
      action={
        <Link href="/referral">
          <Button>View Referrals</Button>
        </Link>
      }
    />
  )

  // Create first server task (requires claim)
  const hasAnyServer = firstServerStatus?.has_server || (preloadedServersCount !== undefined ? preloadedServersCount > 0 : (servers?.length || 0) > 0)
  const firstClaimed = !!firstServerStatus?.reward_claimed
  tasks.push(
    <TaskRow
      key="create"
      title="Create Your First Server"
      description={hasAnyServer ? (firstClaimed ? "Reward claimed" : "Server created, claim your reward") : "Launch your first game server"}
      reward={firstServerStatus?.reward_amount || 50}
      status={firstClaimed ? 'completed' : (hasAnyServer ? 'available' : 'locked')}
      action={firstClaimed ? <Badge variant="secondary">Done</Badge> : (
        hasAnyServer ? <Button onClick={claimFirstServer}>Claim</Button> : <Link href="/create-server"><Button>Start</Button></Link>
      )}
    />
  )

  return (
    <Card className="bg-neutral-900/40 border-neutral-700/40">
      <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {tasks}
      </CardContent>
    </Card>
  )
}
