"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAuthStore } from "@/stores/user-store"
import { useDailyLoginStore } from "@/stores/daily-login-store"

export default function EarnStatsCard({ preloadedStats, suppressFetch = false }: { preloadedStats?: any | null; suppressFetch?: boolean } = {}) {
  const user = useAuthStore(s => s.currentUser)
  const { dailyLoginStats, getDailyLoginStats, isLoadingStats } = useDailyLoginStore()

  React.useEffect(() => { if (!suppressFetch && !preloadedStats) { void getDailyLoginStats?.(true) } }, [getDailyLoginStats, suppressFetch, preloadedStats])

  const balance = user?.coins ?? 0
  const effectiveStats = preloadedStats ?? dailyLoginStats
  const totalSpent = (user as any)?.total_coins_spent ?? 0

  const totalEarned = (user as any)?.total_coins_earned ?? effectiveStats?.total_coins_earned ?? 0
  const currentStreak = effectiveStats?.current_streak ?? 0
  const longestStreak = Math.max(effectiveStats?.longest_streak ?? 0, currentStreak)
  const streakPct = longestStreak ? Math.min(100, Math.round((currentStreak / longestStreak) * 100)) : 0

  return (
    <Card className="bg-neutral-900/40 border-neutral-700/40">
      <CardHeader>
        <CardTitle>Earnings Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/30">
            <div className="text-sm text-neutral-400">Current Balance</div>
            <div className="mt-1 text-3xl font-bold text-white">{balance}</div>
            <div className="text-xs text-neutral-500">coins</div>
          </div>
          <div className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/30">
            <div className="text-sm text-neutral-400">Total Earned</div>
            <div className="mt-1 text-3xl font-bold text-white">{totalEarned}</div>
            <div className="text-xs text-neutral-500">lifetime</div>
          </div>
          <div className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/30">
            <div className="text-sm text-neutral-400">Total Spent</div>
            <div className="mt-1 text-3xl font-bold text-white">{totalSpent}</div>
            <div className="text-xs text-neutral-500">lifetime</div>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/30">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-neutral-300">Daily Login Streak</div>
            <div className="text-xs text-neutral-400">{currentStreak} / {longestStreak} days</div>
          </div>
          <Progress value={streakPct} className="h-2 bg-neutral-700/40" />
          {isLoadingStats && <div className="text-xs text-neutral-500 mt-2">Updating streak...</div>}
        </div>
      </CardContent>
    </Card>
  )
}

