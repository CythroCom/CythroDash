"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/Admin/AdminLayout'
import VirtualScrollList from '@/components/VirtualScrollList'
import { useAdminStore, type AdminUserSummary, type GetUsersFilters } from '@/stores/admin-store'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

export default function AdminUsersPage() {
  const {
    usersList,
    usersListPagination,
    usersListStats,
    isLoadingUsersList,
    getUsersList,
  } = useAdminStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all'|'0'|'1'>('all')
  const [statusFilter, setStatusFilter] = useState<'all'|'verified'|'unverified'|'banned'>('all')
  const [twoFAFilter, setTwoFAFilter] = useState<'all'|'yes'|'no'>('all')
  const [selected, setSelected] = useState<Record<number, boolean>>({})

  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])

  const filters = useMemo<GetUsersFilters>(() => ({
    page: 1,
    limit: 50,
    search: searchQuery || undefined,
    role: roleFilter === 'all' ? undefined : Number(roleFilter),
    verified: statusFilter === 'verified' ? true : statusFilter === 'unverified' ? false : undefined,
    banned: statusFilter === 'banned' ? true : undefined,
    has_two_factor: twoFAFilter === 'yes' ? true : twoFAFilter === 'no' ? false : undefined,
    sort_by: 'id',
    sort_order: 'asc',
    include_stats: true,
  }), [searchQuery, roleFilter, statusFilter, twoFAFilter])

  useEffect(() => {
    getUsersList(filters)
  }, [getUsersList, filters])

  const allIds = useMemo(() => usersList.map(u => u.id), [usersList])
  const allSelected = allIds.length > 0 && allIds.every(id => selected[id])
  const selectedIds = useMemo(() => Object.keys(selected).filter(k => selected[Number(k)]).map(Number), [selected])

  const toggleAll = () => {
    if (allSelected) {
      setSelected({})
    } else {
      const m: Record<number, boolean> = {}
      for (const id of allIds) m[id] = true
      setSelected(m)
    }
  }

  const renderRow = useCallback((u: AdminUserSummary) => {
    const checked = !!selected[u.id]
    return (
      <div className="grid grid-cols-12 items-center px-4 py-3 border-b border-neutral-800 text-sm hover:bg-neutral-800/40">
        <div className="col-span-1"><Checkbox checked={checked} onCheckedChange={(v) => setSelected(s => ({ ...s, [u.id]: !!v }))} /></div>
        <div className="col-span-1 text-neutral-400">{u.id}</div>
        <div className="col-span-3 truncate">
          <Link href={`/admin/users/${u.id}`} className="text-white hover:underline hover:text-neutral-100">{u.username}</Link>
        </div>
        <div className="col-span-3 text-neutral-300 truncate">{u.email}</div>
        <div className="col-span-1"><Badge variant="outline" className="text-xs">{u.role === 0 ? 'Admin' : 'User'}</Badge></div>
        <div className="col-span-1">{u.verified ? <Badge className="bg-green-600">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}</div>
        <div className="col-span-1 text-neutral-200 text-right">{u.coins}</div>
        <div className="col-span-1 text-neutral-400">{new Date(u.created_at).toLocaleDateString()}</div>
      </div>
    )
  }, [selected])

  return (
    <AdminLayout title="User Management" subtitle="Manage users, roles, and balances" searchQuery={searchQuery} onSearchChange={handleSearchChange}>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <Input placeholder="Search username, email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-neutral-800/50 border-neutral-700/50" />
            </div>
            <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
              <SelectTrigger className="w-[160px] bg-neutral-800/50 border-neutral-700/50"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="0">Admin</SelectItem>
                <SelectItem value="1">User</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[180px] bg-neutral-800/50 border-neutral-700/50"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
                <SelectItem value="banned">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={twoFAFilter} onValueChange={(v: any) => setTwoFAFilter(v)}>
              <SelectTrigger className="w-[160px] bg-neutral-800/50 border-neutral-700/50"><SelectValue placeholder="2FA" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">2FA Any</SelectItem>
                <SelectItem value="yes">2FA Yes</SelectItem>
                <SelectItem value="no">2FA No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk selection */}
          <div className="flex items-center gap-3 text-sm text-neutral-400">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            <span>{selectedIds.length} selected</span>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-12 px-4 py-2 text-xs uppercase text-neutral-400">
            <div className="col-span-1">Select</div>
            <div className="col-span-1">ID</div>
            <div className="col-span-3">Username</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-1">Role</div>
            <div className="col-span-1">Verified</div>
            <div className="col-span-1 text-right">Coins</div>
            <div className="col-span-1">Registered</div>
          </div>

          {/* List */}
          <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900/60">
            {isLoadingUsersList && usersList.length === 0 ? (
              <div className="divide-y divide-neutral-800">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 items-center px-4 py-3">
                    <div className="col-span-1"><Skeleton className="h-4 w-4 rounded" /></div>
                    <div className="col-span-1"><Skeleton className="h-4 w-8" /></div>
                    <div className="col-span-3"><Skeleton className="h-4 w-40" /></div>
                    <div className="col-span-3"><Skeleton className="h-4 w-56" /></div>
                    <div className="col-span-1"><Skeleton className="h-4 w-12" /></div>
                    <div className="col-span-1"><Skeleton className="h-4 w-14" /></div>
                    <div className="col-span-1"><Skeleton className="h-4 w-10 ml-auto" /></div>
                    <div className="col-span-1"><Skeleton className="h-4 w-16" /></div>
                  </div>
                ))}
              </div>
            ) : usersList.length === 0 ? (
              <div className="p-6 text-neutral-400">No users found</div>
            ) : (
              <VirtualScrollList
                items={usersList}
                itemHeight={48}
                containerHeight={600}
                renderItem={(item) => renderRow(item as AdminUserSummary)}
              />
            )}
          </div>

          {/* Stats */}
          {usersListStats && (
            <div className="text-xs text-neutral-400">
              Total: {usersListStats.total_users.toLocaleString()} • Verified: {usersListStats.verified_users.toLocaleString()} • Disabled: {usersListStats.banned_users.toLocaleString()} • Admins: {usersListStats.admin_users.toLocaleString()} • 2FA: {usersListStats.users_with_2fa.toLocaleString()}
            </div>
          )}
        </div>
      </div>

    </AdminLayout>
  )
}

