"use client"

import React from "react"
import { Sidebar, Header } from "@/components/LazyComponents"
import EarnStatsCard from "@/components/earn/EarnStatsCard"
import EarnTasksCard from "@/components/earn/EarnTasksCard"
import EarnActivity from "@/components/earn/EarnActivity"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStore } from "@/stores/user-store"
import { useDailyLoginStore } from "@/stores/daily-login-store"
import { useSocialConnections } from "@/hooks/useSocialConnections"
import { Skeleton } from "@/components/ui/skeleton"
import { useEarnBootstrap } from "@/stores/earn-bootstrap"
import LoadingOverlay from "@/components/LoadingOverlay"
import { useAppBootstrap } from "@/hooks/use-bootstrap"

export default function EarnPage() {
  const user = useAuthStore(s => s.currentUser)
  const { checkDailyLoginStatus } = useDailyLoginStore()
  const { completePendingIfAny } = useSocialConnections()
  const { data, loading, error, refresh } = useEarnBootstrap()

  // Complete pending social connections if redirected back to /earn
  React.useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    void completePendingIfAny(search)
  }, [completePendingIfAny])

  React.useEffect(() => { if (!loading && !data) { void checkDailyLoginStatus?.(true) } }, [checkDailyLoginStatus, loading, data])

  const { isLoading: bootLoading } = useAppBootstrap()

  return (
    <div className="min-h-screen bg-neutral-900">
      {bootLoading && <LoadingOverlay message="Preparing your dashboard..." />}
      <Sidebar isOpen={true} onToggle={() => {}} />
      <div className={`transition-all duration-200 lg:ml-72`}>
        <Header searchQuery={""} onSearchChange={() => {}} onMenuClick={() => {}} />
        <main className="p-8 max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white">Earn</h1>
            <p className="text-neutral-400 text-lg mt-1">Complete tasks and activities to earn coins</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-neutral-900/40 border border-neutral-700/40 rounded-2xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
                <div className="mt-6"><Skeleton className="h-10" /></div>
              </div>
              <div className="bg-neutral-900/40 border border-neutral-700/40 rounded-2xl p-6">
                <Skeleton className="h-8 w-40 mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              </div>
              <div className="bg-neutral-900/40 border border-neutral-700/40 rounded-2xl p-6">
                <Skeleton className="h-8 w-48 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              <EarnStatsCard preloadedStats={data?.daily.stats} suppressFetch />

              <Tabs defaultValue="tasks" className="w-full">
                <TabsList className="grid grid-cols-2 md:grid-cols-2 w-full">
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="activity">Earning Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="mt-4">
                  <EarnTasksCard
                    suppressFetch
                    preloaded={{
                      dailyLoginStatus: data?.daily.status,
                      discordReward: data?.rewards.discord,
                      githubReward: data?.rewards.github,
                      firstServerStatus: data?.rewards.firstServer,
                      discord: data?.social.discord,
                      github: data?.social.github,
                      serversCount: data?.servers.count,
                    }}
                  />
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <EarnActivity preloadedLogs={data?.activity.logs ?? []} suppressFetch />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

