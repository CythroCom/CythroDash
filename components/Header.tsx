"use client"

import React, { memo, useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Icon from "@/components/IconProvider"
import { useAuthStore } from "@/stores/user-store"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import CreditsDisplay from "@/components/CreditsDisplay"

interface HeaderProps {
  title?: string
  subtitle?: string
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onMenuClick?: () => void
  onNotificationClick?: () => void
  user?: {
    name: string
    initials: string
    email?: string
    role?: number
    avatar_url?: string
  }
  showMobileMenu?: boolean
}

// Memoized search component
const SearchBar = memo(({ searchQuery = "", onSearchChange }: { 
  searchQuery?: string
  onSearchChange?: (query: string) => void 
}) => {
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(e.target.value)
  }, [onSearchChange])

  return (
    <div className="relative hidden md:block">
      <Icon name="Search" className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
      <Input
        placeholder="Search servers, users..."
        className="pl-12 w-96 h-12 bg-neutral-800/50 border-neutral-700/50 rounded-xl text-base text-white placeholder:text-neutral-500 focus:border-neutral-500/50 focus:ring-1 focus:ring-neutral-500/20 focus:ring-offset-0 focus:outline-none transition-colors duration-200"
        value={searchQuery}
        onChange={handleSearchChange}
      />
    </div>
  )
})
SearchBar.displayName = "SearchBar"

// Memoized user profile component
const UserProfile = memo(({ user }: { user?: HeaderProps["user"] }) => {
  if (!user) return null

  return (
    <div className="flex items-center gap-3 p-2 rounded-xl bg-neutral-700/30 border border-neutral-600/20">
      <div className="w-10 h-10 bg-gradient-to-br from-neutral-600 to-neutral-700 rounded-full flex items-center justify-center border border-neutral-500/30 overflow-hidden">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-white">{user.initials}</span>
        )}
      </div>
      <div className="hidden sm:block">
        <div className="text-sm font-medium text-white leading-tight">{user.name}</div>
        {user.email && <div className="text-xs text-neutral-400 leading-tight">{user.email}</div>}
      </div>
    </div>
  )
})
UserProfile.displayName = "UserProfile"

// Main Header component with optimizations
const Header = memo(({ 
  title = "Servers",
  subtitle = "Create and manage game servers",
  searchQuery = "",
  onSearchChange,
  onMenuClick,
  onNotificationClick,
  user,
  showMobileMenu = true
}: HeaderProps) => {
  const { currentUser, logout } = useAuthStore()
  const router = useRouter()
  const computedUser = useMemo(() => {
    if (user) return user
    if (!currentUser) return undefined
    const initials = (currentUser.display_name || currentUser.username || '').slice(0,2).toUpperCase() || 'US'
    return {
      name: currentUser.display_name || `${currentUser.first_name} ${currentUser.last_name}` || currentUser.username,
      initials,
      email: currentUser.email,
      role: currentUser.role,
      avatar_url: currentUser.avatar_url
    }
  }, [user, currentUser])

  const handleMenuClick = useCallback(() => {
    onMenuClick?.()
  }, [onMenuClick])

  const handleNotificationClick = useCallback(() => {
    onNotificationClick?.()
  }, [onNotificationClick])

  return (
    <header className="bg-neutral-800/30 border-b border-neutral-700/30 px-6 py-8 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showMobileMenu && (
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden hover:bg-neutral-700/30 border border-neutral-600/20 h-10 w-10 focus:bg-neutral-700/30 focus:ring-0 focus:outline-none transition-colors duration-200"
              onClick={handleMenuClick}
            >
              <Icon name="Menu" className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-5xl font-bold text-white tracking-tight">{title}</h1>
            <p className="text-neutral-400 text-xl mt-1">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <SearchBar searchQuery={searchQuery} onSearchChange={onSearchChange} />

          {/* Credits Display */}
          <CreditsDisplay
            variant="prominent"
            size="md"
            className="hidden sm:flex"
          />

          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-neutral-700/30 border border-neutral-600/20 h-12 w-12 focus:bg-neutral-700/30 focus:ring-0 focus:outline-none transition-colors duration-200"
            onClick={handleNotificationClick}
          >
            <Icon name="Bell" className="h-5 w-5" />
          </Button>
          
          {computedUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none">
                  <UserProfile user={computedUser} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-neutral-800/95 border border-neutral-700/50 text-white rounded-xl shadow-xl">
                <DropdownMenuLabel className="text-neutral-300">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-neutral-700/60 rounded-full flex items-center justify-center text-sm font-bold">
                      {computedUser.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{computedUser.name}</div>
                      {computedUser.email && <div className="text-xs text-neutral-400 truncate">{computedUser.email}</div>}
                    </div>
                  </div>
                  {/* Mobile Credits Display */}
                  <div className="mt-3 sm:hidden">
                    <CreditsDisplay
                      variant="compact"
                      size="sm"
                      showLabel={true}
                    />
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-neutral-700/60" />
                <DropdownMenuItem onClick={() => router.push('/settings')} className="focus:bg-neutral-700/50 focus:text-white">
                  <Icon name="Settings" className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                {computedUser.role === 0 && (
                  <DropdownMenuItem onClick={() => router.push('/admin')} className="focus:bg-neutral-700/50 focus:text-white">
                    <Icon name="Shield" className="mr-2 h-4 w-4" /> Administration
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-neutral-700/60" />
                <DropdownMenuItem onClick={() => logout()} className="focus:bg-neutral-700/50 focus:text-white">
                  <Icon name="LogIn" className="mr-2 h-4 w-4 rotate-180" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
})

Header.displayName = "Header"

export default Header
