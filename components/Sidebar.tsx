"use client"

import React, { memo, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import Icon, { type IconName } from "@/components/IconProvider"
import { useAuthStore } from "@/stores/user-store"
import { useAppConfig, useNavigationFeatures } from "@/hooks/use-feature-flags"
import LoadingOverlay from "@/components/LoadingOverlay"

export interface SidebarItem {
  icon: IconName
  label: string
  active?: boolean
  onClick?: () => void
}

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  items?: SidebarItem[]
  user?: {
    name: string
    role: string
    initials: string
  }
}

// Memoized navigation item component
const NavigationItem = memo(({ item, isOpen }: { item: SidebarItem; isOpen: boolean }) => {
  const handleClick = useCallback(() => {
    item.onClick?.()
  }, [item])

  return (
    <div className="relative group/item">
      <button
        className={`w-full h-12 transition-colors-fast rounded-lg flex items-center font-medium text-sm btn-optimized ${
          isOpen ? "justify-start px-4" : "justify-center px-0"
        } ${
          item.active
            ? "bg-neutral-600/20 text-neutral-200 border border-neutral-500/30 shadow-soft"
            : "text-neutral-400 hover:bg-neutral-700/30 hover:text-white hover:border-neutral-600/20 border border-transparent"
        } focus:bg-neutral-600/20 focus:text-neutral-200 focus:border-neutral-500/30 focus:ring-0 focus:outline-none active:bg-neutral-600/20`}
        onClick={handleClick}
      >
        <Icon name={item.icon} className={`h-5 w-5 flex-shrink-0 stroke-2 ${item.active ? 'text-white' : ''}`} />
        {isOpen && <span className={`ml-3 font-medium ${item.active ? 'text-white' : ''}`}>{item.label}</span>}
      </button>

      {!isOpen && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-neutral-800 text-white text-sm rounded-lg tooltip-optimized group-hover/item:visible whitespace-nowrap z-50 border border-neutral-700/50 shadow-medium">
          {item.label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-neutral-800"></div>
        </div>
      )}
    </div>
  )
})
NavigationItem.displayName = "NavigationItem"

// Memoized user profile component
const UserProfile = memo(({ user, isOpen }: { user?: SidebarProps["user"]; isOpen: boolean }) => {
  if (!user) return null

  if (isOpen) {
    return (
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-700/30">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-700/30 border border-neutral-600/20 hover:bg-neutral-700/40 transition-colors duration-200">
          <div className="w-8 h-8 bg-gradient-to-br from-neutral-600 to-neutral-700 rounded-full flex items-center justify-center border border-neutral-500/30 flex-shrink-0">
            <span className="text-sm font-bold text-white">{user.initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-neutral-400">{user.role}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-neutral-700/30">
      <div className="flex justify-center">
        <div className="w-10 h-10 bg-gradient-to-br from-neutral-600 to-neutral-700 rounded-full flex items-center justify-center border border-neutral-500/30 hover:bg-gradient-to-br hover:from-neutral-500 hover:to-neutral-600 transition-all duration-200 cursor-pointer">
          <span className="text-sm font-bold text-white">{user.initials}</span>
        </div>
      </div>
    </div>
  )
})
UserProfile.displayName = "UserProfile"

// Main Sidebar component with optimizations
const Sidebar = memo(({ isOpen, onToggle, items = [], user }: SidebarProps) => {
  const { appName, description, loading: configLoading } = useAppConfig()
  const { showServers, showReferrals, showRedeemCodes, showTransfers, loading: featuresLoading } = useNavigationFeatures()

  // Prevent rendering errors during initial load
  const isLoading = configLoading || featuresLoading

  const defaultItems: SidebarItem[] = useMemo(() => {
    const baseItems: SidebarItem[] = [
      { icon: "Activity", label: "Dashboard", active: true },
      { icon: "DollarSign", label: "Earn" },
    ]

    // Add conditional items based on feature flags
    if (showReferrals) {
      baseItems.push({ icon: "Gift", label: "Referrals" })
    }

    if (showRedeemCodes) {
      baseItems.push({ icon: "RefreshCw", label: "Redeem" })
    }

    if (showTransfers) {
      baseItems.push({ icon: "ArrowRight", label: "Transfers" })
    }

    if (showServers) {
      

      baseItems.push({ icon: "Plus", label: "Create Server" })
    }

    return baseItems
  }, [showServers, showReferrals, showRedeemCodes, showTransfers])

  const sidebarItems = items.length > 0 ? items : defaultItems

  const { currentUser } = useAuthStore()
  const defaultUser = useMemo(() => {
    if (user) return user
    if (!currentUser) return undefined
    const initials = (currentUser.display_name || currentUser.username || '').slice(0,2).toUpperCase() || 'US'
    return {
      name: currentUser.display_name || `${currentUser.first_name} ${currentUser.last_name}` || currentUser.username,
      role: currentUser.role === 0 ? 'Administrator' : 'User',
      initials,
    }
  }, [user, currentUser])

  const handleToggle = useCallback(() => {
    onToggle()
  }, [onToggle])

  const handleLogoClick = useCallback(() => {
    if (!isOpen) {
      onToggle()
    }
  }, [isOpen, onToggle])

  const isActive = (label: string) => {
    if (typeof window === 'undefined') return false
    const path = window.location.pathname
    if (label === 'Dashboard') return path === '/'
    if (label === 'Referrals') return path.startsWith('/referral')
  
    if (label === 'Redeem') return path.startsWith('/redeem')
    if (label === 'Transfers') return path.startsWith('/transfers')
    if (label === 'Earn') return path.startsWith('/earn')
    if (label === 'Create Server') return path.startsWith('/create-server')
    return false
  }

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') window.location.href = path
  }

  const finalItems = sidebarItems.map(it => {
    if (it.label === 'Referrals') return { ...it, active: isActive('Referrals'), onClick: () => navigate('/referral') }
    if (it.label === 'Dashboard') return { ...it, active: isActive('Dashboard'), onClick: () => navigate('/') }
    if (it.label === 'Redeem') return { ...it, active: isActive('Redeem'), onClick: () => navigate('/redeem') }
    if (it.label === 'Transfers') return { ...it, active: isActive('Transfers'), onClick: () => navigate('/transfers') }
    if (it.label === 'Earn') return { ...it, active: isActive('Earn'), onClick: () => navigate('/earn') }
    if (it.label === 'Create Server') return { ...it, active: isActive('Create Server'), onClick: () => navigate('/create-server') }
    return { ...it, active: typeof it.active === 'boolean' ? it.active : isActive(it.label) }
  })

  return (
    <>
      {/* Global loading overlay to coordinate with main content */}
      {isLoading && <LoadingOverlay message="Preparing your dashboard..." />}

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 backdrop-solid border-r border-neutral-700/50 transition-transform-fast shadow-strong sidebar-optimized ${
          isOpen ? "w-72" : "w-16"
        } ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700/30">
          {isOpen ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-neutral-600 to-neutral-700 rounded-xl flex items-center justify-center border border-neutral-500/30 shadow-lg">
                  <Icon name="Gamepad2" className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    {isLoading ? '' : (appName || 'CythroDash')}
                  </h1>
                  <p className="text-xs text-neutral-400">
                    {isLoading ? '' : (description || 'Advanced Pterodactyl Panel Dashboard')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-neutral-700/50 text-neutral-300 hover:text-white transition-colors duration-200 h-9 w-9 rounded-lg border border-neutral-600/20"
                onClick={handleToggle}
              >
                <Icon name="ChevronLeft" className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="w-full flex justify-center">
              <div
                className="w-10 h-10 bg-gradient-to-br from-neutral-600 to-neutral-700 rounded-xl flex items-center justify-center border border-neutral-500/30 shadow-lg cursor-pointer hover:bg-gradient-to-br hover:from-neutral-500 hover:to-neutral-600 transition-all duration-200"
                onClick={handleLogoClick}
              >
                <Icon name="Gamepad2" className="h-6 w-6 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`p-3 space-y-2 ${!isOpen ? "px-2" : ""}`}>
          {sidebarItems.map((it, index) => {
            const item = (it.label === 'Referrals') ? { ...it, active: isActive('Referrals'), onClick: () => navigate('/referral') }
              : (it.label === 'Dashboard') ? { ...it, active: isActive('Dashboard'), onClick: () => navigate('/') }
             
              : (it.label === 'Redeem') ? { ...it, active: isActive('Redeem'), onClick: () => navigate('/redeem') }
              : (it.label === 'Transfers') ? { ...it, active: isActive('Transfers'), onClick: () => navigate('/transfers') }
              : (it.label === 'Earn') ? { ...it, active: isActive('Earn'), onClick: () => navigate('/earn') }
              : (it.label === 'Admin') ? { ...it, active: isActive('Admin'), onClick: () => navigate('/admin') }
              : (it.label === 'Create Server') ? { ...it, active: isActive('Create Server'), onClick: () => navigate('/create-server') }
              : { ...it, active: typeof it.active === 'boolean' ? it.active : isActive(it.label) }
            return (
              <NavigationItem key={`${item.label}-${index}`} item={item} isOpen={isOpen} />
            )
          })}

        </nav>

        {/* User Profile */}
        {defaultUser && <UserProfile user={defaultUser} isOpen={isOpen} />}
      </div>
    </>
  )
})

Sidebar.displayName = "Sidebar"

export default Sidebar
