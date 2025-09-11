"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { showError, showSuccess, showInfo } from "@/lib/toast"
import { useAuthStore } from "@/stores/user-store"
import { setAuthHeaders, useUserCodeStore } from "@/stores/code-store"

export default function RedeemCodeCard() {
  const user = useAuthStore(s => s.currentUser)
  const updateCoins = useAuthStore(s => s.updateCoins)

  const { isRedeeming, redeemCode, getRedemptions, redemptions, isLoadingRedemptions } = useUserCodeStore()

  const [code, setCode] = React.useState("")
  const [initialLoaded, setInitialLoaded] = React.useState(false)

  // Provide auth headers to the code store using the existing pattern
  React.useEffect(() => {
    if (!user) return
    setAuthHeaders(() => ({
      'Content-Type': 'application/json',
      'x-user-data': encodeURIComponent(JSON.stringify({ id: user.id, username: user.username, email: user.email, role: user.role }))
    }))
  }, [user])

  // Initial load of redemption history
  React.useEffect(() => {
    ;(async () => {
      if (!user || initialLoaded) return
      await getRedemptions(20, 0, true)
      setInitialLoaded(true)
    })()
  }, [user, initialLoaded, getRedemptions])

  const friendlyError = (code?: string) => {
    switch (code) {
      case 'CODE_NOT_FOUND': return 'Code not found'
      case 'CODE_EXPIRED': return 'This code has expired'
      case 'CODE_INACTIVE': return 'This code is not active'
      case 'CODE_DEPLETED': return 'This code has reached its usage limit'
      case 'USER_ALREADY_REDEEMED': return 'You already redeemed this code'
      case 'USER_NOT_ALLOWED': return 'You are not allowed to redeem this code'
      case 'RATE_LIMITED_USER': return 'Too many attempts. Please try again later'
      case 'RATE_LIMITED_IP': return 'Too many attempts from your IP. Please try again later'
      default: return 'Redemption failed'
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      showError('Not signed in', 'Please log in to redeem a code')
      return
    }
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 4) return

    const res = await redeemCode(trimmed)
    if (res.success) {
      const awarded = res.coins_awarded || 0
      if (awarded > 0) {
        updateCoins?.(awarded)
        showSuccess('Code redeemed', `+${awarded} coins added`)
      } else {
        showInfo('Code redeemed', 'Coins added to your balance')
      }
      setCode("")
      await getRedemptions(20, 0, true)
    } else {
      showError(friendlyError(res.error), res.message)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="bg-neutral-900/60 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">Redeem a Code</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code (e.g. SUMMER2025)"
              className="bg-neutral-800/60 border-neutral-700 text-white placeholder:text-neutral-500"
              maxLength={32}
              autoComplete="off"
            />
            <Button type="submit" disabled={isRedeeming || code.trim().length < 4}>
              {isRedeeming ? 'Redeeming…' : 'Redeem'}
            </Button>
          </form>
          <p className="text-xs text-neutral-500 mt-2">Codes are case-insensitive. Letters, numbers, hyphens and underscores are allowed.</p>
        </CardContent>
      </Card>

      <Card className="bg-neutral-900/60 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">Your Redemptions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRedemptions && (
            <div className="text-neutral-400 text-sm">Loading history…</div>
          )}
          {!isLoadingRedemptions && (!redemptions || redemptions.length === 0) && (
            <div className="text-neutral-400 text-sm">No redemptions yet.</div>
          )}
          <div className="space-y-2">
            {redemptions?.map((r) => (
              <div key={r.id} className="p-3 rounded-lg bg-neutral-800/40 border border-neutral-700/30 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-white truncate">{r.code}</div>
                    <Badge variant={r.status === 'completed' ? 'secondary' : r.status === 'failed' ? 'destructive' : 'outline'}>{r.status}</Badge>
                  </div>
                  <div className="text-xs text-neutral-400 truncate">
                    Redeemed {new Date(r.redeemed_at).toLocaleString()} • Balance {r.user_balance_before} → {r.user_balance_after}
                  </div>
                  {r.error_message && (
                    <div className="text-xs text-red-400 truncate">{r.error_message}</div>
                  )}
                </div>
                <div className="text-sm text-neutral-300">+{r.coins_awarded} coins</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

