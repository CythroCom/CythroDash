"use client"

import React, { memo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useCreditsUpdate, useCreditsSync } from '@/hooks/useCreditsUpdate'
import { showSuccess, showError } from '@/lib/toast'

/**
 * Example component showing how to integrate real-time credit updates
 * Use this pattern in any component that performs actions affecting user credits
 */
const CreditsUpdateExample = memo(() => {
  const { addCredits, subtractCredits, setCredits, refreshCredits } = useCreditsUpdate()
  const { syncCreditsAfterApiCall } = useCreditsSync()

  // Example: Daily login bonus
  const handleDailyLogin = useCallback(async () => {
    try {
      const response = await fetch('/api/user/daily-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'claim' })
      })

      const result = await response.json()

      if (result.success) {
        // Sync credits after successful API call
        await syncCreditsAfterApiCall(result)
        showSuccess(`Daily bonus claimed! +${result.data?.coins_awarded || 0} credits`)
      } else {
        showError(result.message || 'Failed to claim daily bonus')
      }
    } catch (error) {
      showError('Network error while claiming daily bonus')
    }
  }, [syncCreditsAfterApiCall])

  // Example: Redeem code
  const handleRedeemCode = useCallback(async (code: string) => {
    try {
      const response = await fetch('/api/codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code })
      })

      const result = await response.json()

      if (result.success) {
        // Sync credits after successful redemption
        await syncCreditsAfterApiCall(result)
        showSuccess(`Code redeemed! +${result.coins_awarded || 0} credits`)
      } else {
        showError(result.message || 'Failed to redeem code')
      }
    } catch (error) {
      showError('Network error while redeeming code')
    }
  }, [syncCreditsAfterApiCall])

  // Example: Purchase server (subtract credits)
  const handlePurchaseServer = useCallback(async (planId: string, cost: number) => {
    try {
      // Optimistically subtract credits for immediate UI feedback
      await subtractCredits(cost, 'Server purchase')

      const response = await fetch('/api/servers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan_id: planId })
      })

      const result = await response.json()

      if (result.success) {
        // Sync with actual server response
        await syncCreditsAfterApiCall(result)
        showSuccess('Server created successfully!')
      } else {
        // Revert optimistic update on failure
        await addCredits(cost, 'Purchase failed - refund')
        showError(result.message || 'Failed to create server')
      }
    } catch (error) {
      // Revert optimistic update on error
      await addCredits(cost, 'Purchase error - refund')
      showError('Network error while creating server')
    }
  }, [addCredits, subtractCredits, syncCreditsAfterApiCall])

  // Example: Manual credit operations (for testing)
  const handleAddTestCredits = useCallback(() => {
    addCredits(100, 'Test credits')
    showSuccess('Added 100 test credits')
  }, [addCredits])

  const handleSubtractTestCredits = useCallback(() => {
    subtractCredits(50, 'Test deduction')
    showSuccess('Subtracted 50 test credits')
  }, [subtractCredits])

  const handleSetTestCredits = useCallback(() => {
    setCredits(1000, 'Set to test amount')
    showSuccess('Set credits to 1000')
  }, [setCredits])

  const handleRefreshCredits = useCallback(() => {
    refreshCredits()
    showSuccess('Credits refreshed from server')
  }, [refreshCredits])

  return (
    <div className="p-6 bg-neutral-800/40 rounded-xl border border-neutral-700/50">
      <h3 className="text-xl font-bold text-white mb-4">Credits Update Examples</h3>
      <p className="text-neutral-400 mb-6">
        Examples of how to integrate real-time credit updates in your components
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* API Integration Examples */}
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-white">API Integration</h4>
          
          <Button 
            onClick={handleDailyLogin}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Claim Daily Login Bonus
          </Button>
          
          <Button 
            onClick={() => handleRedeemCode('TESTCODE123')}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Redeem Test Code
          </Button>
          
          <Button 
            onClick={() => handlePurchaseServer('plan-1', 200)}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            Purchase Server (200 credits)
          </Button>
        </div>

        {/* Manual Update Examples */}
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-white">Manual Updates</h4>
          
          <Button 
            onClick={handleAddTestCredits}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Add 100 Credits
          </Button>
          
          <Button 
            onClick={handleSubtractTestCredits}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            Subtract 50 Credits
          </Button>
          
          <Button 
            onClick={handleSetTestCredits}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            Set to 1000 Credits
          </Button>
          
          <Button 
            onClick={handleRefreshCredits}
            className="w-full bg-neutral-600 hover:bg-neutral-700"
          >
            Refresh from Server
          </Button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-neutral-900/50 rounded-lg">
        <h5 className="text-sm font-semibold text-white mb-2">Integration Notes:</h5>
        <ul className="text-xs text-neutral-400 space-y-1">
          <li>• Use <code>syncCreditsAfterApiCall()</code> after API calls that change credits</li>
          <li>• Use optimistic updates for better UX (subtract first, then confirm)</li>
          <li>• Always handle errors and revert optimistic updates if needed</li>
          <li>• The credits display will automatically update in real-time</li>
          <li>• Credits are synced between the credits store and user store</li>
        </ul>
      </div>
    </div>
  )
})

CreditsUpdateExample.displayName = 'CreditsUpdateExample'

export default CreditsUpdateExample
