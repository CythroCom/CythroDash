"use client"

import React, { memo, useEffect, useCallback, useState } from 'react'
import { useCreditsStore } from '@/stores/credits-store'
import { useAuthStore } from '@/stores/user-store'
import Icon from '@/components/IconProvider'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CreditsDisplayProps {
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'prominent' | 'compact'
}

const CreditsDisplay = memo(({ 
  className = "", 
  showLabel = true, 
  size = 'md',
  variant = 'prominent'
}: CreditsDisplayProps) => {
  const { credits, isLoading, error, fetchCredits, startPolling, stopPolling } = useCreditsStore()
  const { isAuthenticated, currentUser } = useAuthStore()
  const [animateChange, setAnimateChange] = useState(false)
  const [previousCredits, setPreviousCredits] = useState(credits)

  // Initialize credits from user store immediately, then start polling
  useEffect(() => {
    if (isAuthenticated) {
      // Immediately sync with user store if available
      if (currentUser?.coins !== undefined) {
        useCreditsStore.getState().updateCredits(currentUser.coins)
        useCreditsStore.getState().setError(null)
      }

      // Start polling for updates
      startPolling()
      return () => stopPolling()
    }
  }, [isAuthenticated, currentUser?.coins, startPolling, stopPolling])

  // Sync with user store on mount and prioritize user store data
  useEffect(() => {
    if (currentUser?.coins !== undefined) {
      // Always sync with user store data
      useCreditsStore.getState().updateCredits(currentUser.coins)
      // Clear any errors if we have valid data from user store
      if (error && currentUser.coins > 0) {
        useCreditsStore.getState().setError(null)
      }
    }
  }, [currentUser?.coins, error])

  // Animate credits changes
  useEffect(() => {
    if (credits !== previousCredits && previousCredits !== 0) {
      setAnimateChange(true)
      const timer = setTimeout(() => setAnimateChange(false), 1000)
      setPreviousCredits(credits)
      return () => clearTimeout(timer)
    }
    setPreviousCredits(credits)
  }, [credits, previousCredits])

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    fetchCredits()
  }, [fetchCredits])

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'h-8 px-3',
      icon: 'h-3 w-3',
      text: 'text-sm',
      label: 'text-xs'
    },
    md: {
      container: 'h-10 px-4',
      icon: 'h-4 w-4',
      text: 'text-base',
      label: 'text-sm'
    },
    lg: {
      container: 'h-12 px-5',
      icon: 'h-5 w-5',
      text: 'text-lg',
      label: 'text-base'
    }
  }

  // Variant configurations
  const variantConfig = {
    default: {
      container: 'bg-neutral-800/50 border-neutral-700/50 text-white',
      highlight: 'text-yellow-400',
      glow: ''
    },
    prominent: {
      container: 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30 text-white shadow-lg',
      highlight: 'text-yellow-400',
      glow: 'shadow-yellow-500/20'
    },
    compact: {
      container: 'bg-neutral-700/40 border-neutral-600/40 text-neutral-200',
      highlight: 'text-yellow-300',
      glow: ''
    }
  }

  const config = sizeConfig[size]
  const variantStyle = variantConfig[variant]

  // Format credits with commas
  const formatCredits = (amount: number) => {
    return amount.toLocaleString()
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`
            flex items-center gap-2 rounded-xl border transition-all duration-300
            ${config.container} ${variantStyle.container} ${variantStyle.glow}
            ${animateChange ? 'scale-105 ring-2 ring-yellow-400/50' : ''}
            ${className}
          `}>
            {/* Coin Icon */}
            <div className={`
              flex items-center justify-center rounded-full 
              ${variant === 'prominent' ? 'bg-yellow-500/20 p-1' : ''}
            `}>
              <Icon
                name="DollarSign"
                className={`${config.icon} ${variantStyle.highlight} ${animateChange ? 'animate-spin' : ''}`}
              />
            </div>

            {/* Credits Amount */}
            <div className="flex flex-col items-start min-w-0">
              {showLabel && (
                <span className={`${config.label} text-neutral-400 leading-none`}>
                  Credits
                </span>
              )}
              <span className={`
                ${config.text} font-bold leading-none
                ${animateChange ? variantStyle.highlight : 'text-white'}
                transition-colors duration-300
              `}>
                {isLoading && credits === 0 ? (
                  <span className="animate-pulse">---</span>
                ) : error && credits === 0 ? (
                  <span className="text-red-400">Error</span>
                ) : (
                  formatCredits(credits)
                )}
              </span>
            </div>

            {/* Refresh Button (only show on error when no credits data available) */}
            {error && credits === 0 && (
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-neutral-600/50"
              >
                <Icon name="RefreshCw" className="h-3 w-3" />
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-neutral-800 border-neutral-700">
          <div className="text-center">
            <p className="font-medium">Current Balance</p>
            <p className="text-sm text-neutral-400">
              {formatCredits(credits)} credits
            </p>
            {error && credits === 0 && (
              <p className="text-xs text-red-400 mt-1">
                Click to refresh
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

CreditsDisplay.displayName = 'CreditsDisplay'

export default CreditsDisplay

// Export hook for manual credit updates from other components
export const useCreditsUpdate = () => {
  const { addCredits, subtractCredits, updateCredits, fetchCredits } = useCreditsStore()
  
  return {
    addCredits,
    subtractCredits, 
    updateCredits,
    refreshCredits: fetchCredits
  }
}
