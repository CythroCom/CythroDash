"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/user-store"
import SocialAccountCard from "./SocialAccountCard"
import { useSocialConnections } from "@/hooks/useSocialConnections"
import { showSuccess, showError } from "@/lib/toast"

export default function ProfileSection() {
  const user = useAuthStore(s => s.currentUser)
  const updateUserProfile = useAuthStore(s => s.updateUserProfile)
  const [profile, setProfile] = React.useState({
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    display_name: user?.display_name ?? "",
    username: user?.username ?? "",
    email: user?.email ?? "",
  })
  React.useEffect(() => {
    setProfile({
      first_name: user?.first_name ?? "",
      last_name: user?.last_name ?? "",
      display_name: user?.display_name ?? "",
      username: user?.username ?? "",
      email: user?.email ?? "",
    })
  }, [user?.id])

  const onSave = async () => {
    const res = await updateUserProfile({ ...profile })
    if (res.success) showSuccess("Profile saved", res.message) 
    else showError("Failed to save profile", res.message)
  }

  const { discord, github, loading, refresh, connectDiscord, disconnectDiscord, connectGitHub, disconnectGitHub } = useSocialConnections()
  React.useEffect(() => { refresh() }, [refresh])

  return (
    <div className="space-y-6">
      <Card className="bg-neutral-900/40 border-neutral-700/40">
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>First name</Label>
              <Input value={profile.first_name} onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={profile.last_name} onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))} />
            </div>
            <div>
              <Label>Display name</Label>
              <Input value={profile.display_name} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} />
            </div>
            <div>
              <Label>Username</Label>
              <Input value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Email</Label>
              <Input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setProfile({
              first_name: user?.first_name ?? "",
              last_name: user?.last_name ?? "",
              display_name: user?.display_name ?? "",
              username: user?.username ?? "",
              email: user?.email ?? "",
            })}>Reset</Button>
            <Button onClick={onSave}>Save changes</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-neutral-900/40 border-neutral-700/40">
        <CardHeader><CardTitle>Connected accounts</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <SocialAccountCard
            provider="Discord"
            connected={!!discord?.connected}
            subtitle={discord?.connected ? `@${discord?.username}#${discord?.discriminator}` : "Not connected"}
            onConnect={connectDiscord}
            onDisconnect={disconnectDiscord}
          />
          <SocialAccountCard
            provider="GitHub"
            connected={!!github?.connected}
            subtitle={github?.connected ? `@${github?.login}` : "Not connected"}
            onConnect={connectGitHub}
            onDisconnect={disconnectGitHub}
          />
        </CardContent>
      </Card>

      <Card className="bg-neutral-900/40 border-neutral-700/40">
        <CardHeader><CardTitle>Danger zone</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-neutral-400">Deactivate or delete your account. This is irreversible.</p>
          <div className="flex flex-col md:flex-row gap-2">
            <Button variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10" onClick={() => showError("Not implemented", "Deactivation flow not implemented yet.")}>Deactivate account</Button>
            <Button variant="destructive" onClick={() => showError("Not implemented", "Deletion flow not implemented yet.")}>Delete account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

