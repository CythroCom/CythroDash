"use client"

import React, { memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Gift } from 'lucide-react'

interface Tier {
  name: string
  minReferrals: number
  maxReferrals: number
  bonus: number
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  icon: React.ComponentType<any>
  perks: string[]
}

interface CurrentTierCardProps {
  currentTier: Tier
  nextTier?: Tier
  totalReferrals: number
  pendingEarnings: number
  onClaimRewards: () => void
  isClaimingRewards: boolean
}

const CurrentTierCard = memo(({ 
  currentTier, 
  nextTier, 
  totalReferrals, 
  pendingEarnings, 
  onClaimRewards, 
  isClaimingRewards 
}: CurrentTierCardProps) => {
  const TierIcon = currentTier.icon
  const progressToNext = nextTier 
    ? ((totalReferrals - currentTier.minReferrals) / (nextTier.minReferrals - currentTier.minReferrals)) * 100
    : 100

  return (
    <Card className={`border-neutral-700/50 bg-neutral-800/40 ${currentTier.borderColor}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <TierIcon className={`h-5 w-5 mr-2 ${currentTier.textColor}`} />
          {currentTier.name} Tier
        </CardTitle>
        <CardDescription className="text-neutral-400">
          {currentTier.bonus}% bonus on all referral rewards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress to Next Tier */}
        {nextTier && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-400">Progress to {nextTier.name}</span>
              <span className="text-white">{totalReferrals}/{nextTier.minReferrals}</span>
            </div>
            <Progress 
              value={progressToNext} 
              className="h-2 bg-neutral-700"
            />
            <p className="text-xs text-neutral-500 mt-1">
              {nextTier.minReferrals - totalReferrals} more referrals needed
            </p>
          </div>
        )}

        {/* Pending Earnings */}
        <div className="p-4 bg-neutral-900/50 rounded-lg border border-neutral-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-400">Pending Earnings</span>
            <Gift className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-white">{pendingEarnings}</span>
            <Button
              onClick={onClaimRewards}
              disabled={pendingEarnings === 0 || isClaimingRewards}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isClaimingRewards ? 'Claiming...' : 'Claim'}
            </Button>
          </div>
        </div>

        {/* Tier Perks */}
        <div>
          <h4 className="text-sm font-medium text-white mb-3">Tier Benefits</h4>
          <ul className="space-y-2">
            {currentTier.perks.map((perk, index) => (
              <li key={index} className="text-sm text-neutral-400 flex items-start">
                <span className="text-green-400 mr-2">•</span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
})

CurrentTierCard.displayName = 'CurrentTierCard'
export default CurrentTierCard
