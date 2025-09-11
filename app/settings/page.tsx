"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sidebar, Header } from "@/components/LazyComponents"
import ProfileSection from "@/components/settings/ProfileSection"
import SecuritySection from "@/components/settings/SecuritySection"
import ActivityLogsTable from "@/components/settings/ActivityLogsTable"
import ConnectionsSection from "@/components/settings/ConnectionsSection"
import { useAuthStore } from "@/stores/user-store"
import { useUserSettings } from "@/stores/user-settings-store"
import { showError, showSuccess } from "@/lib/toast"

function useUserHeader() {
  const user = useAuthStore(s => s.currentUser)
  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="h-12 w-12 rounded-full bg-neutral-700 overflow-hidden flex items-center justify-center text-sm">
        {user?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt={user.username} className="h-full w-full object-cover" />
        ) : (
          <span className="text-neutral-300">{user?.username?.[0]?.toUpperCase() ?? "U"}</span>
        )}
      </div>
      <div>
        <div className="text-lg font-semibold">{user?.display_name || `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || user?.username}</div>
        <div className="text-neutral-400 text-sm">{user?.email}</div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const params = useSearchParams()
  const user = useAuthStore(s => s.currentUser)
  const { settings, loading, error, availableSocialConnections, connectSocial, disconnectSocial } = useUserSettings()

  // Complete pending social connections if redirected back
  React.useEffect(() => {
    const discordPending = params.get("discord_pending") === "true"
    const githubPending = params.get("github_pending") === "true"
    const run = async () => {
      try {
        if (discordPending && user) {
          const res = await fetch("/api/auth/discord/connect", { method: "POST", headers: { "x-user-data": encodeURIComponent(JSON.stringify(user)), "Content-Type": "application/json" }, credentials: "include" })
          const j = await res.json()
          if (j.success) showSuccess("Discord connected", j.message); else showError("Discord connection failed", j.message)
        }
        if (githubPending && user) {
          const res = await fetch("/api/auth/github/connect", { method: "POST", headers: { "x-user-data": encodeURIComponent(JSON.stringify(user)), "Content-Type": "application/json" }, credentials: "include" })
          const j = await res.json()
          if (j.success) showSuccess("GitHub connected", j.message); else showError("GitHub connection failed", j.message)
        }
        if (discordPending || githubPending) {
          const url = new URL(window.location.href)
          url.searchParams.delete("discord_pending")
          url.searchParams.delete("github_pending")
          router.replace(url.pathname + (url.search ? "?" + url.searchParams.toString() : ""))
        }
      } catch {}
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-neutral-900">
      <Sidebar isOpen={true} onToggle={() => {}} />
      <div className={`transition-all duration-200 lg:ml-72`}>
        <Header searchQuery={""} onSearchChange={() => {}} onMenuClick={() => {}} />
        <main className="p-8 max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-neutral-400 text-lg mt-1">Manage your account, security and activity</p>
          </div>

          {useUserHeader()}

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="connections">Connections</TabsTrigger>
	              <TabsTrigger value="logs">Activity Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4">
              <ProfileSection />
            </TabsContent>

            <TabsContent value="security" className="mt-4">
              <SecuritySection />
            </TabsContent>

            <TabsContent value="connections" className="mt-4">
              <ConnectionsSection />
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <ActivityLogsTable />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

