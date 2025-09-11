"use client"

import React from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStore, type AdminUserSummary } from '@/stores/admin-store'

export default function UserGeneralTab({ userId }: { userId: number }) {
  const { selectedUser, isLoadingSelectedUser, getUserById, updateUser } = useAdminStore()
  const [local, setLocal] = React.useState<Partial<AdminUserSummary> | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [msg, setMsg] = React.useState<{ type: 'success'|'error'; text: string }|null>(null)

  React.useEffect(() => {
    if (!selectedUser || selectedUser.id !== userId) {
      getUserById(userId)
    } else {
      setLocal(selectedUser)
    }
  }, [userId, selectedUser, getUserById])

  React.useEffect(() => {
    if (selectedUser && selectedUser.id === userId) setLocal(selectedUser)
  }, [selectedUser, userId])

  if (isLoadingSelectedUser && !local) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </div>
    )
  }

  if (!local) return <div className="text-neutral-400">User not found</div>

  const original = selectedUser && selectedUser.id === userId ? selectedUser : null
  const dirty = !!original && !!local && (
    original.username !== local.username ||
    original.email !== local.email ||
    original.first_name !== local.first_name ||
    original.last_name !== local.last_name ||
    (original.display_name || '') !== (local.display_name || '') ||
    original.role !== local.role ||
    !!original.verified !== !!local.verified
  )
  const invalid = !local?.username || local.username!.length < 3 || !local?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(local.email!)

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`text-sm ${msg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</div>
      )}

      {/* Account statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-md border border-neutral-800 p-4 bg-neutral-900/60">
          <div className="text-xs text-neutral-400">Credits/Coins</div>
          <div className="text-xl text-white">{local.coins ?? 0}</div>
        </div>
        <div className="rounded-md border border-neutral-800 p-4 bg-neutral-900/60">
          <div className="text-xs text-neutral-400">Member Since</div>
          <div className="text-sm text-white">{local.created_at ? new Date(local.created_at).toLocaleDateString() : '—'}</div>
        </div>
        <div className="rounded-md border border-neutral-800 p-4 bg-neutral-900/60">
          <div className="text-xs text-neutral-400">Last Login</div>
          <div className="text-sm text-white">{local.last_login ? new Date(local.last_login).toLocaleString() : '—'}</div>
        </div>
        <div className="rounded-md border border-neutral-800 p-4 bg-neutral-900/60">
          <div className="text-xs text-neutral-400">Servers Created</div>
          <div className="text-xl text-white">{local.total_servers_created ?? 0}</div>
        </div>
      </div>

      {/* Profile form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">Username</label>
          <Input value={local.username || ''} onChange={(e) => setLocal({ ...local, username: e.target.value })} placeholder="Username" className="bg-neutral-800/50 border-neutral-700/50" />
        </div>
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">Email</label>
          <Input type="email" value={local.email || ''} onChange={(e) => setLocal({ ...local, email: e.target.value })} placeholder="Email" className="bg-neutral-800/50 border-neutral-700/50" />
        </div>
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">First Name</label>
          <Input value={local.first_name || ''} onChange={(e) => setLocal({ ...local, first_name: e.target.value })} placeholder="First name" className="bg-neutral-800/50 border-neutral-700/50" />
        </div>
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">Last Name</label>
          <Input value={local.last_name || ''} onChange={(e) => setLocal({ ...local, last_name: e.target.value })} placeholder="Last name" className="bg-neutral-800/50 border-neutral-700/50" />
        </div>
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">Display Name</label>
          <Input value={local.display_name || ''} onChange={(e) => setLocal({ ...local, display_name: e.target.value })} placeholder="Display name" className="bg-neutral-800/50 border-neutral-700/50" />
        </div>
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">Role</label>
          <Select value={String(local.role ?? 1)} onValueChange={(v) => setLocal({ ...local, role: Number(v) as any })}>
            <SelectTrigger className="bg-neutral-800/50 border-neutral-700/50"><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Admin</SelectItem>
              <SelectItem value="1">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">Status</label>
          <div className="text-sm">
            <span className={local.banned ? 'text-red-400' : 'text-green-400'}>{local.banned ? 'Banned' : 'Active'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={!!local.verified} onCheckedChange={(v) => setLocal({ ...local, verified: !!v })} />
          <span className="text-sm text-neutral-300">Verified</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={!dirty || saving} onClick={() => { setLocal(original || local) ; setMsg(null) }}>Cancel</Button>
        <Button disabled={saving || !dirty || invalid} onClick={async () => {
          if (!local) return
          setMsg(null)
          // Confirmation for sensitive changes
          if (original && original.role !== local.role) {
            const ok = window.confirm('You are about to change user role. Continue?')
            if (!ok) return
          }
          setSaving(true)
          const res = await updateUser(userId, {
            username: local.username,
            email: local.email,
            first_name: local.first_name,
            last_name: local.last_name,
            display_name: local.display_name,
            role: local.role as any,
            verified: local.verified as any,
          } as any)
          setSaving(false)
          if (res?.success) setMsg({ type: 'success', text: 'Profile updated' })
          else setMsg({ type: 'error', text: res?.message || 'Failed to update profile' })
        }}>Save changes</Button>
      </div>
    </div>
  )
}

