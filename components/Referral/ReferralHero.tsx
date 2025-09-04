"use client"

import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Users, DollarSign } from 'lucide-react'

interface ReferralHeroProps {
  totalReferrals: number
  totalEarned: number
  thisMonthEarned: number
  currentTier: {
    name: string
    color: string
    textColor: string
    icon: React.ComponentType<any>
  }
}

const ReferralHero = memo(({ totalReferrals, totalEarned, thisMonthEarned, currentTier }: ReferralHeroProps) => {
  const TierIcon = currentTier.icon

  return (
    <div className="space-y-6">
      {/* Main Hero */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Referral Program</h1>
        <p className="text-xl text-neutral-400">Invite friends and earn coins together</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-400 mb-1">Total Referrals</p>
                <p className="text-3xl font-bold text-white">{totalReferrals}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-400 mb-1">Total Earned</p>
                <p className="text-3xl font-bold text-white">{totalEarned}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-700/50 bg-neutral-800/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-400 mb-1">This Month</p>
                <p className="text-3xl font-bold text-white">{thisMonthEarned}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Tier Badge */}
      <div className="flex justify-center">
        <div className={`inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r ${currentTier.color} text-white font-semibold`}>
          <TierIcon className="h-5 w-5 mr-2" />
          {currentTier.name} Tier
        </div>
      </div>
    </div>
  )
})

ReferralHero.displayName = 'ReferralHero'
export default ReferralHero
