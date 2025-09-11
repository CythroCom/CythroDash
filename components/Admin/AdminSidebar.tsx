"use client"

import React, { memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import Icon from '@/components/IconProvider'
import { Button } from '@/components/ui/button'
import { useAppConfig } from '@/hooks/use-feature-flags'

interface AdminSidebarProps {
  isOpen: boolean
  onToggle: () => void
}

const AdminSidebar = memo(({ isOpen, onToggle }: AdminSidebarProps) => {
  const pathname = usePathname()
  const { appName, loading: configLoading } = useAppConfig()

  const navigationItems = [
    {
      title: 'Dashboard',
      href: '/admin',
      icon: 'BarChart3',
      exact: true
    },
    {
      title: 'User Management',
      href: '/admin/users',
      icon: 'Users'
    },
    {
      title: 'Server Management',
      href: '/admin/servers',
      icon: 'Server'
    },
    {
      title: 'Location Management',
      href: '/admin/locations',
      icon: 'MapPin'
    },
    {
      title: 'Server Types',
      href: '/admin/server-types',
      icon: 'Package'
    },
    {
      title: 'Server Software',
      href: '/admin/server-software',
      icon: 'Code'
    },
    {
      title: 'Plans Management',
      href: '/admin/plans',
      icon: 'CreditCard'
    },
    {
      title: 'Redeem Codes',
      href: '/admin/codes',
      icon: 'Gift'
    },
    {
      title: 'Settings',
      href: '/admin/settings',
      icon: 'Settings'
    },
    {
      title: 'Security & Logs',
      href: '/admin/security-logs',
      icon: 'Shield'
    }
  ]

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed top-0 left-0 z-50 h-full bg-neutral-900/95 backdrop-blur-sm border-r border-neutral-700/50 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:fixed lg:z-50",
        isOpen ? "w-72" : "lg:w-16"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-700/50">
            <div className={cn(
              "flex items-center gap-3 transition-opacity duration-200",
              !isOpen && "lg:opacity-0 lg:pointer-events-none"
            )}>
              <div className="w-8 h-8 bg-gradient-to-br from-neutral-600 to-neutral-800 rounded-lg flex items-center justify-center">
                <Icon name="Shield" className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {configLoading ? 'Admin Panel' : `${appName || 'CythroDash'} Admin`}
                </h2>
                <p className="text-xs text-neutral-400">Management Console</p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="lg:hidden hover:bg-neutral-700/30 h-8 w-8 p-0"
            >
              <Icon name="X" className="h-4 w-4" /> 
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  isActive(item.href, item.exact)
                    ? "bg-neutral-700/50 text-white border border-neutral-600/30"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-700/30",
                  !isOpen && "lg:justify-center lg:px-2"
                )}
              >
                <Icon 
                  name={item.icon as any} 
                  className={cn(
                    "h-5 w-5 flex-shrink-0",
                    isActive(item.href, item.exact) ? "text-white" : "text-neutral-400 group-hover:text-white"
                  )} 
                />
                
                <span className={cn(
                  "font-medium transition-opacity duration-200 truncate",
                  !isOpen && "lg:opacity-0 lg:pointer-events-none"
                )}>
                  {item.title}
                </span>
                {/* Tooltip for collapsed state */}
                {!isOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-800 text-white text-sm rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 hidden lg:block">
                    {item.title}
                  </div>
                )}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-700/50">
            <div className={cn(
              "flex items-center gap-3 transition-opacity duration-200",
              !isOpen && "lg:opacity-0 lg:pointer-events-none lg:justify-center"
            )}>
              <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center">
                <Icon name="Activity" className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">System Status</p>
                <p className="text-xs text-green-400">All systems operational</p>
              </div>
            </div>
          </div>

          {/* Toggle button for desktop */}
          <div className="hidden lg:block p-2 border-t border-neutral-700/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="w-full hover:bg-neutral-700/30 h-8"
            >
              <Icon 
                name={isOpen ? "ChevronLeft" : "ChevronRight"} 
                className="h-4 w-4" 
              />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
})

AdminSidebar.displayName = 'AdminSidebar'

export default AdminSidebar
