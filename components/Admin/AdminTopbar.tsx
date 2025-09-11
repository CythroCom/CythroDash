"use client"

import React, { memo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/user-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import Icon from '@/components/IconProvider'
import CreditsDisplay from '@/components/CreditsDisplay'

interface AdminTopbarProps {
  title: string
  subtitle?: string
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onMenuClick: () => void
  sidebarOpen: boolean
}

const AdminTopbar = memo(({ 
  title, 
  subtitle, 
  searchQuery = "", 
  onSearchChange, 
  onMenuClick,
  sidebarOpen 
}: AdminTopbarProps) => {
  const router = useRouter()
  const { currentUser, logout } = useAuthStore()
  const [notifications] = useState([
    { id: 1, title: 'New user registration', time: '2 min ago', type: 'info' },
    { id: 2, title: 'Server maintenance scheduled', time: '1 hour ago', type: 'warning' },
    { id: 3, title: 'Payment received', time: '3 hours ago', type: 'success' }
  ])

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/auth/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleBackToApp = () => {
    router.push('/')
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return 'CheckCircle'
      case 'warning': return 'AlertTriangle'
      case 'error': return 'XCircle'
      default: return 'Info'
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-400'
      case 'warning': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      default: return 'text-blue-400'
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-700/50 h-16">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden hover:bg-neutral-700/30 h-10 w-10 p-0"
          >
            <Icon name="Menu" className="h-5 w-5" />
          </Button>

          {/* Title and subtitle */}
          <div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            {subtitle && (
              <p className="text-sm text-neutral-400">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Center section - Search */}
        {onSearchChange && (
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Icon name="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search admin panel..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-neutral-800/50 border-neutral-700/50 focus:border-neutral-600"
              />
            </div>
          </div>
        )}

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Credits Display */}
          <CreditsDisplay 
            variant="compact" 
            size="sm"
            className="hidden sm:flex"
          />

          {/* Quick Actions */}
          <div className="hidden lg:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToApp}
              className="border-neutral-600 hover:bg-neutral-700 text-neutral-300"
            >
              <Icon name="ArrowLeft" className="h-4 w-4 mr-2" />
              Back to App
            </Button>
          </div>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="relative hover:bg-neutral-700/30 h-10 w-10 p-0"
              >
                <Icon name="Bell" className="h-5 w-5" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-red-500 text-white text-xs flex items-center justify-center">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-neutral-800 border-neutral-700">
              <DropdownMenuLabel className="text-neutral-200">
                Notifications ({notifications.length})
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-neutral-700" />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-neutral-400">
                  No new notifications
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem key={notification.id} className="p-3 hover:bg-neutral-700/50">
                    <div className="flex items-start gap-3 w-full">
                      <Icon 
                        name={getNotificationIcon(notification.type) as any} 
                        className={`h-4 w-4 mt-0.5 ${getNotificationColor(notification.type)}`} 
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-200 truncate">{notification.title}</p>
                        <p className="text-xs text-neutral-400">{notification.time}</p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator className="bg-neutral-700" />
              <DropdownMenuItem className="p-3 hover:bg-neutral-700/50 text-center">
                <span className="text-sm text-neutral-300">View all notifications</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 hover:bg-neutral-700/30 h-10 px-3"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-neutral-600 to-neutral-800 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {currentUser?.username?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-white truncate max-w-24">
                    {currentUser?.username || 'Admin'}
                  </p>
                  <p className="text-xs text-neutral-400">Administrator</p>
                </div>
                <Icon name="ChevronDown" className="h-4 w-4 text-neutral-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-neutral-800 border-neutral-700">
              <DropdownMenuLabel className="text-neutral-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-neutral-600 to-neutral-800 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {currentUser?.username?.charAt(0).toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{currentUser?.username || 'Administrator'}</div>
                    <div className="text-xs text-neutral-400 truncate">{currentUser?.email || 'admin@example.com'}</div>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-neutral-700" />
              
              <DropdownMenuItem 
                onClick={handleBackToApp}
                className="hover:bg-neutral-700/50 text-neutral-200"
              >
                <Icon name="ArrowLeft" className="h-4 w-4 mr-2" />
                Back to Dashboard
              </DropdownMenuItem>
              
              <DropdownMenuItem className="hover:bg-neutral-700/50 text-neutral-200">
                <Icon name="User" className="h-4 w-4 mr-2" />
                Profile Settings
              </DropdownMenuItem>
              
              <DropdownMenuItem className="hover:bg-neutral-700/50 text-neutral-200">
                <Icon name="Settings" className="h-4 w-4 mr-2" />
                Admin Settings
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-neutral-700" />
              
              <DropdownMenuItem 
                onClick={handleLogout}
                className="hover:bg-red-700/50 text-red-400"
              >
                <Icon name="LogOut" className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
})

AdminTopbar.displayName = 'AdminTopbar'

export default AdminTopbar
