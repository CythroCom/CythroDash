"use client"

import React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export type UserDetailLayoutProps = {
  userId: number
  initialTab?: string
  tabs: Array<{ key: string; label: string; content: React.ReactNode }>
}

export default function UserDetailLayout({ userId, initialTab = 'general', tabs }: UserDetailLayoutProps) {
  const [active, setActive] = React.useState(initialTab)

  return (
    <Tabs value={active} onValueChange={setActive} className="w-full">
      <TabsList className="grid grid-cols-5 w-full">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key} className="mt-4">
          {active === t.key ? t.content : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}

