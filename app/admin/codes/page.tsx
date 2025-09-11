"use client"

import React from "react"
import AdminLayout from "@/components/Admin/AdminLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import Icon from "@/components/IconProvider"
import { useAdminCodeStore, setAuthHeaders } from "@/stores/code-store"
import { useAuthStore } from "@/stores/user-store"
import type { CodeStatus } from "@/database/tables/cythro_dash_codes"

function useAuthHeaderBootstrap() {
  const user = useAuthStore(s => s.currentUser)
  const token = useAuthStore(s => s.sessionToken)
  React.useEffect(() => {
    setAuthHeaders(() => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(user ? { 'x-user-data': encodeURIComponent(JSON.stringify(user)) } : {})
    }))
  }, [user, token])
}

export default function AdminCodesPage() {
  useAuthHeaderBootstrap()

  const {
    codes, codesTotal, isLoadingCodes,
    getCodes, createCode, updateCode, deleteCode,
    selectedCode, codeStatistics, getCodeById, clearSelectedCode
  } = useAdminCodeStore()

  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<CodeStatus | "">("")
  const [page, setPage] = React.useState(1)
  const pageSize = 20

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [statsOpen, setStatsOpen] = React.useState(false)

  const [form, setForm] = React.useState({
    code: "",
    coins_value: 100,
    max_uses: 1,
    expiry_date: "",
    description: "",
    restricted_to_new_users: false,
  })
  const [bulkCount, setBulkCount] = React.useState(1)

  const load = React.useCallback((force = false) => {
    void getCodes({ limit: pageSize, offset: (page - 1) * pageSize, search: search.trim() || undefined, status: (status as CodeStatus) || undefined }, force)
  }, [getCodes, page, pageSize, search, status])

  React.useEffect(() => { load(false) }, [load])

  function resetForm() {
    setForm({ code: "", coins_value: 100, max_uses: 1, expiry_date: "", description: "", restricted_to_new_users: false })
    setBulkCount(1)
  }

  async function handleCreate() {
    const createOne = async () => {
      const payload: any = {
        coins_value: Math.max(1, Math.floor(form.coins_value)),
        max_uses: Math.max(0, Math.floor(form.max_uses)),
        ...(form.code ? { code: form.code.trim().toUpperCase() } : {}),
        ...(form.expiry_date ? { expiry_date: new Date(form.expiry_date) } : {}),
        description: form.description || undefined,
        restricted_to_new_users: !!form.restricted_to_new_users,
      }
      await createCode(payload)
    }

    const n = Math.min(100, Math.max(1, Math.floor(bulkCount)))
    for (let i = 0; i < n; i++) { await createOne() }
    setCreateOpen(false); resetForm(); load(true)
  }

  async function handleUpdate() {
    if (!selectedCode) return
    const payload: any = {
      coins_value: Math.max(1, Math.floor(form.coins_value)),
      max_uses: Math.max(0, Math.floor(form.max_uses)),
      is_active: selectedCode.is_active,
      ...(form.expiry_date ? { expiry_date: new Date(form.expiry_date) } : { expiry_date: undefined }),
      description: form.description || undefined,
      restricted_to_new_users: !!form.restricted_to_new_users,
    }
    await updateCode(selectedCode.id, payload)
    setEditOpen(false); load(true)
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this code? If it has redemptions, deletion will fail. You can deactivate instead.")) return
    await deleteCode(id)
    load(true)
  }

  function openEdit(code: any) {
    setForm({
      code: code.code,
      coins_value: code.coins_value,
      max_uses: code.max_uses,
      expiry_date: code.expiry_date ? new Date(code.expiry_date).toISOString().slice(0, 16) : "",
      description: code.description || "",
      restricted_to_new_users: !!code.restricted_to_new_users,
    })
    setEditOpen(true)
  }

  async function openStats(code: any) {
    await getCodeById(code.id, true)
    setStatsOpen(true)
  }

  const totalPages = Math.max(1, Math.ceil(codesTotal / pageSize))

  return (
    <AdminLayout
      title="Redeem Codes"
      subtitle="Create, manage, and analyze redeemable coin codes"
      searchQuery={search}
      onSearchChange={(q) => { setSearch(q); setPage(1) }}
    >
      <div className="p-6 max-w-7xl mx-auto">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
          <div className="flex gap-3 items-center">
            <div className="w-64">
              <Input placeholder="Search codes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <Select value={(status as string) || 'all'} onValueChange={(v) => { setStatus((v === 'all' ? '' : (v as any))); setPage(1) }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="depleted">Depleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { resetForm(); setCreateOpen(true) }}>
              <Icon name="Plus" className="h-4 w-4 mr-2" /> New Code
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-neutral-900/40 border border-neutral-700/40 rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Coins</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingCodes ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-28 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : codes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-neutral-400 py-10">No codes found</TableCell>
                </TableRow>
              ) : (
                codes.map((c) => (
                  <TableRow key={c.id} className="hover:bg-neutral-800/30">
                    <TableCell className="font-mono">{c.code}</TableCell>
                    <TableCell>{c.coins_value}</TableCell>
                    <TableCell>{c.current_uses}/{c.max_uses === 0 ? '∞' : c.max_uses}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${c.status === 'active' ? 'bg-green-500/10 text-green-400' : c.status === 'expired' ? 'bg-yellow-500/10 text-yellow-400' : c.status === 'depleted' ? 'bg-orange-500/10 text-orange-400' : 'bg-neutral-600/30 text-neutral-300'}`}>{c.status}</span>
                    </TableCell>
                    <TableCell>{c.expiry_date ? new Date(c.expiry_date).toLocaleString() : '—'}</TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openStats(c)}><Icon name="Eye" className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Icon name="Settings" className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Icon name="X" className="h-4 w-4 text-red-400" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)) }} />
              </PaginationItem>
              {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => {
                const p = i + 1
                return (
                  <PaginationItem key={p}>
                    <PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p) }}>{p}</PaginationLink>
                  </PaginationItem>
                )
              })}
              <PaginationItem>
                <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)) }} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create code{bulkCount > 1 ? ` (x${bulkCount})` : ''}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2">
              <Label>Code (optional)</Label>
              <Input placeholder="Leave blank to auto-generate" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <Label>Coins value</Label>
              <Input type="number" min={1} value={form.coins_value} onChange={(e) => setForm(f => ({ ...f, coins_value: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Max uses (0 = unlimited)</Label>
              <Input type="number" min={0} value={form.max_uses} onChange={(e) => setForm(f => ({ ...f, max_uses: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Expiry (optional)</Label>
              <Input type="datetime-local" value={form.expiry_date} onChange={(e) => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div>
              <Label>Bulk generate</Label>
              <Input type="number" min={1} max={100} value={bulkCount} onChange={(e) => setBulkCount(Number(e.target.value))} />
            </div>
            <div className="md:col-span-2">
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) clearSelectedCode() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit code</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div>
              <Label>Coins value</Label>
              <Input type="number" min={1} value={form.coins_value} onChange={(e) => setForm(f => ({ ...f, coins_value: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Max uses (0 = unlimited)</Label>
              <Input type="number" min={0} value={form.max_uses} onChange={(e) => setForm(f => ({ ...f, max_uses: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Expiry (optional)</Label>
              <Input type="datetime-local" value={form.expiry_date} onChange={(e) => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={statsOpen} onOpenChange={(o) => { setStatsOpen(o); if (!o) clearSelectedCode() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Code statistics</DialogTitle>
          </DialogHeader>
          {!selectedCode ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-400">Code</div>
                  <div className="font-mono text-white text-lg">{selectedCode.code}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-neutral-400">Coins</div>
                  <div className="text-white font-semibold">{selectedCode.coins_value}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Total redemptions" value={codeStatistics?.total_redemptions ?? 0} />
                <Stat label="Unique users" value={codeStatistics?.unique_users ?? 0} />
                <Stat label="Coins awarded" value={codeStatistics?.total_coins_awarded ?? 0} />
                <Stat label="Status" value={selectedCode.status} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Stat label="First redemption" value={codeStatistics?.first_redemption ? new Date(codeStatistics.first_redemption).toLocaleString() : '—'} />
                <Stat label="Last redemption" value={codeStatistics?.last_redemption ? new Date(codeStatistics.last_redemption).toLocaleString() : '—'} />
              </div>
              <div className="text-sm text-neutral-400">Redemptions by day</div>
              <div className="max-h-40 overflow-y-auto rounded border border-neutral-700/40 p-2 text-sm">
                {(codeStatistics?.redemptions_by_day?.length ?? 0) === 0 ? (
                  <div className="text-neutral-400">No redemption history yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {codeStatistics!.redemptions_by_day.map((r, idx) => (
                      <li key={idx} className="flex justify-between"><span className="text-neutral-300">{r.date}</span><span className="text-neutral-100">{r.count}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

function Stat({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-700/40 rounded-lg p-3">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-white font-medium">{value}</div>
    </div>
  )
}

