"use client"

import React from "react"
import { Sidebar, Header } from "@/components/LazyComponents"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import Icon from "@/components/IconProvider"
import { useAuthStore } from "@/stores/user-store"
import { TransfersProtectedRoute } from "@/components/FeatureProtectedRoute"

export default function TransfersPage() {
  const user = useAuthStore(s => s.currentUser)
  const token = useAuthStore(s => s.sessionToken)
  const updateCoins = useAuthStore(s => s.updateCoins)
  const refreshUserData = useAuthStore(s => s.refreshUserData)
  const isRefreshingUserData = useAuthStore(s => s.isRefreshingUserData)

  const [sidebarOpen] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [suggestions, setSuggestions] = React.useState<Array<{ id: number; username: string; display_name?: string; avatar?: string }>>([])
  const [selectedUsername, setSelectedUsername] = React.useState("")
  const [amount, setAmount] = React.useState(0)
  const [note, setNote] = React.useState("")

  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [transfers, setTransfers] = React.useState<any[]>([])
  const [isLoadingTransfers, setIsLoadingTransfers] = React.useState(true)

  const headers = React.useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(user ? { 'x-user-data': encodeURIComponent(JSON.stringify(user)) } : {})
  }), [token, user])

  // Fetch transfers history
  const fetchTransfers = React.useCallback(async () => {
    try {
      setIsLoadingTransfers(true)
      const res = await fetch('/api/transfers?limit=50&offset=0', { headers, credentials: 'include' })
      const json = await res.json()
      if (json?.success) setTransfers(json.transfers || [])
    } catch (e) {
      console.error('Failed to load transfers', e)
    } finally {
      setIsLoadingTransfers(false)
    }
  }, [headers])

  React.useEffect(() => { void fetchTransfers() }, [fetchTransfers])
  // Ensure balance reflects server state
  React.useEffect(() => { void refreshUserData(true) }, [refreshUserData])

  // Debounced suggestions
  React.useEffect(() => {
    const controller = new AbortController()
    const t = setTimeout(async () => {
      const q = search.trim()
      if (!q || q.length < 2) { setSuggestions([]); return }
      try {
        const res = await fetch(`/api/transfers/search-users?q=${encodeURIComponent(q)}`, { headers, credentials: 'include', signal: controller.signal })
        const json = await res.json()
        if (Array.isArray(json?.users)) setSuggestions(json.users)
      } catch (e) { /* noop */ }
    }, 250)
    return () => { controller.abort(); clearTimeout(t) }
  }, [search, headers])

  function pickSuggestion(name: string) {
    setSelectedUsername(name)
    setSearch("")
    setSuggestions([])
  }

  function validate(): string | null {
    if (!selectedUsername) return 'Please select a recipient'
    if (!Number.isInteger(amount) || amount <= 0) return 'Enter a valid coin amount (integer > 0)'
    if (user && selectedUsername.toLowerCase() === user.username.toLowerCase()) return 'You cannot transfer coins to yourself'
    return null
  }

  async function submitTransfer() {
    const error = validate()
    if (error) { alert(error); return }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ to_username: selectedUsername, amount, note })
      })
      const json = await res.json()
      if (json?.success) {
        // Update local balance and reload history
        updateCoins(-amount)
        await fetchTransfers()
        setConfirmOpen(false)
        setAmount(0); setNote("")
      } else {
        alert(json?.message || 'Transfer failed')
      }
    } catch (e) {
      alert('Network error while submitting transfer')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <TransfersProtectedRoute>
      <div className="min-h-screen bg-neutral-900">
        <Sidebar isOpen={sidebarOpen} onToggle={() => {}} />
        <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'}`}>
          <Header searchQuery={""} onSearchChange={() => {}} onMenuClick={() => {}} />

          <main className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white">Transfers</h1>
              <p className="text-neutral-400 text-lg mt-1">Send coins to other users and view your transfer history</p>
            </div>

            {/* Balance & Send */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-neutral-900/40 border border-neutral-700/40 rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-4">Send coins</h2>
                <div className="space-y-4">
                  <div>
                    <Label>Recipient</Label>
                    <Input placeholder="Search by username..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    {suggestions.length > 0 && (
                      <div className="mt-1 border border-neutral-700/50 rounded-lg bg-neutral-900/90 max-h-64 overflow-y-auto">
                        {suggestions.map((s) => (
                          <button key={s.id} onClick={() => pickSuggestion(s.username)} className="w-full text-left px-3 py-2 hover:bg-neutral-800/60 flex items-center gap-2">
                            <span className="text-neutral-200">{s.username}</span>
                            {s.display_name && <span className="text-neutral-400 text-sm">({s.display_name})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedUsername && (
                      <div className="text-sm text-neutral-300 mt-1">Selected: <span className="font-medium">{selectedUsername}</span> <button onClick={() => setSelectedUsername("")} className="text-neutral-400 hover:text-white ml-2">Change</button></div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Amount</Label>
                      <Input type="number" min={1} value={amount} onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))} />
                    </div>
                    <div>
                      <Label>Note (optional)</Label>
                      <Input value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => setConfirmOpen(true)} disabled={isSubmitting}>Send</Button>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-900/40 border border-neutral-700/40 rounded-2xl p-6">
                <div className="text-neutral-400 text-sm">Current balance</div>
                {(!user || isRefreshingUserData) ? (
                  <Skeleton className="h-8 w-40 mt-1" />
                ) : (
                  <div className="text-3xl font-bold text-white mt-1">{user.coins} <span className="text-base font-medium text-neutral-300">coins</span></div>
                )}
                <div className="text-neutral-400 text-sm mt-2">Daily transfer limit applies</div>
              </div>
            </div>

            {/* History */}
            <div className="mt-6 bg-neutral-900/40 border border-neutral-700/40 rounded-2xl">
              <div className="p-6 flex items-center justify-between">
                <h2 className="text-white font-semibold">Transfer history</h2>
                <Button variant="ghost" size="sm" onClick={() => fetchTransfers()}><Icon name="RefreshCw" className="h-4 w-4 mr-2" />Refresh</Button>
              </div>
              <div className="px-6 pb-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingTransfers ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          </TableRow>
                        ))
                      ) : transfers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-neutral-400 py-10">No transfers yet</TableCell>
                        </TableRow>
                      ) : (
                        transfers.map((t) => {
                          const outgoing = user && t.from_user_id === user.id
                          return (
                            <TableRow key={t.id}>
                              <TableCell className="font-mono">{t.id}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded text-xs ${outgoing ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{outgoing ? 'Sent' : 'Received'}</span>
                              </TableCell>
                              <TableCell>{outgoing ? t.to_username : t.from_username}</TableCell>
                              <TableCell>{outgoing ? `- ${t.amount}` : `+ ${t.amount}`}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded text-xs ${t.status === 'completed' ? 'bg-green-500/10 text-green-400' : t.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>{t.status}</span>
                              </TableCell>
                              <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Confirm dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm transfer</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <div className="text-neutral-300">You're sending <span className="font-semibold text-white">{amount}</span> coins to <span className="font-semibold text-white">{selectedUsername || '—'}</span>.</div>
              {note && <div className="text-neutral-400 text-sm">Note: {note}</div>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={submitTransfer} disabled={isSubmitting}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TransfersProtectedRoute>
  )
}

