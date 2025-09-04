"use client"

import React, { memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Share2, UserPlus, Gift } from 'lucide-react'

const HowItWorksCard = memo(() => {
  const steps = [
    {
      icon: Share2,
      title: "Share Your Link",
      description: "Send your referral code or link to friends via social media, email, or messaging apps."
    },
    {
      icon: UserPlus,
      title: "Friend Signs Up",
      description: "When your friend registers using your referral code, they become your referral."
    },
    {
      icon: Gift,
      title: "Earn Rewards",
      description: "You earn coins for each successful referral. Higher tiers unlock bigger bonuses!"
    }
  ]

  return (
    <Card className="border-neutral-700/50 bg-neutral-800/40">
      <CardHeader>
        <CardTitle className="text-white">How It Works</CardTitle>
        <CardDescription className="text-neutral-400">
          Start earning rewards in three simple steps
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, index) => {
            const StepIcon = step.icon
            return (
              <div key={index} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-700/50 border border-neutral-600/40 flex items-center justify-center">
                  <StepIcon className="h-8 w-8 text-neutral-300" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-neutral-400">{step.description}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})

HowItWorksCard.displayName = 'HowItWorksCard'
export default HowItWorksCard
