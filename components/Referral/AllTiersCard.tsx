"use client"

import React, { memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle } from 'lucide-react'

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

interface AllTiersCardProps {
  tiers: Tier[]
  currentTierName: string
  totalReferrals: number
}

const AllTiersCard = memo(({ tiers, currentTierName, totalReferrals }: AllTiersCardProps) => {
  return (
    <Card className="border-neutral-700/50 bg-neutral-800/40">
      <CardHeader>
        <CardTitle className="text-white">All Tiers</CardTitle>
        <CardDescription className="text-neutral-400">
          Unlock higher rewards as you refer more friends
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tiers.map((tier) => {
            const TierIcon = tier.icon
            const isCurrentTier = tier.name === currentTierName
            const isUnlocked = totalReferrals >= tier.minReferrals
            const requirementText = tier.maxReferrals === Number.POSITIVE_INFINITY 
              ? `${tier.minReferrals}+ referrals`
              : `${tier.minReferrals}-${tier.maxReferrals} referrals`

            return (
              <div
                key={tier.name}
                className={`p-4 rounded-lg border transition-all ${
                  isCurrentTier
                    ? `${tier.bgColor} ${tier.borderColor} border-2`
                    : isUnlocked
                    ? 'bg-neutral-900/30 border-neutral-600/30'
                    : 'bg-neutral-900/20 border-neutral-700/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full ${tier.bgColor} ${tier.borderColor} border flex items-center justify-center`}>
                      <TierIcon className={`h-4 w-4 ${tier.textColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className={`font-semibold ${isCurrentTier ? tier.textColor : 'text-white'}`}>
                          {tier.name}
                        </h3>
                        {isCurrentTier && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                        {isUnlocked && !isCurrentTier && (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        )}
                      </div>
                      <p className="text-sm text-neutral-400">{requirementText}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${isCurrentTier ? tier.textColor : 'text-white'}`}>
                      +{tier.bonus}%
                    </p>
                    <p className="text-xs text-neutral-400">bonus</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  {tier.perks.slice(0, 2).map((perk, index) => (
                    <p key={index} className="text-xs text-neutral-400 flex items-start">
                      <span className="text-green-400 mr-2">•</span>
                      {perk}
                    </p>
                  ))}
                  {tier.perks.length > 2 && (
                    <p className="text-xs text-neutral-500">
                      +{tier.perks.length - 2} more benefits
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})

AllTiersCard.displayName = 'AllTiersCard'
export default AllTiersCard
