"use client"

import React, { memo } from 'react'
import { useCreditsStore } from '@/stores/credits-store'
import { useAuthStore } from '@/stores/user-store'

/**
 * Debug component to help troubleshoot credits display issues
 * Remove this component in production
 */
const CreditsDebug = memo(() => {
  const { credits, isLoading, error, lastFetch, isPolling } = useCreditsStore()
  const { currentUser, isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-black/80 text-white text-xs rounded-lg border border-neutral-600 max-w-sm">
      <h4 className="font-bold mb-2">Credits Debug Info</h4>
      <div className="space-y-1">
        <div>
          <strong>Credits Store:</strong>
          <div className="ml-2">
            <div>Credits: {credits}</div>
            <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
            <div>Error: {error || 'None'}</div>
            <div>Polling: {isPolling ? 'Yes' : 'No'}</div>
            <div>Last Fetch: {lastFetch ? new Date(lastFetch).toLocaleTimeString() : 'Never'}</div>
          </div>
        </div>
        <div>
          <strong>User Store:</strong>
          <div className="ml-2">
            <div>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</div>
            <div>User Coins: {currentUser?.coins ?? 'undefined'}</div>
            <div>Username: {currentUser?.username || 'N/A'}</div>
          </div>
        </div>
        <div>
          <strong>Expected Display:</strong>
          <div className="ml-2">
            <div>Should Show: {
              isLoading && credits === 0 ? 'Loading (---)'
              : error && credits === 0 ? 'Error'
              : credits.toLocaleString()
            }</div>
          </div>
        </div>
      </div>
    </div>
  )
})

CreditsDebug.displayName = 'CreditsDebug'

export default CreditsDebug
