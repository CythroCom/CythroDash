"use client"

import React, { memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, User } from 'lucide-react'

interface Referral {
  id: string
  username: string
  email: string
  joinedAt: string
  status: 'completed' | 'pending'
  reward: number
}

interface RecentReferralsCardProps {
  referrals: Referral[]
  isLoading: boolean
}

const RecentReferralsCard = memo(({ referrals, isLoading }: RecentReferralsCardProps) => {
  if (isLoading) {
    return (
      <Card className="border-neutral-700/50 bg-neutral-800/40">
        <CardHeader>
          <CardTitle className="text-white">Recent Referrals</CardTitle>
          <CardDescription className="text-neutral-400">
            Your latest successful referrals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 bg-neutral-900/50 rounded-lg animate-pulse">
                <div className="w-10 h-10 bg-neutral-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-700 rounded w-1/4"></div>
                  <div className="h-3 bg-neutral-700 rounded w-1/3"></div>
                </div>
                <div className="h-6 bg-neutral-700 rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-neutral-700/50 bg-neutral-800/40">
      <CardHeader>
        <CardTitle className="text-white">Recent Referrals</CardTitle>
        <CardDescription className="text-neutral-400">
          Your latest successful referrals
        </CardDescription>
      </CardHeader>
      <CardContent>
        {referrals.length === 0 ? (
          <div className="text-center py-8">
            <User className="h-12 w-12 text-neutral-500 mx-auto mb-4" />
            <p className="text-neutral-400">No referrals yet</p>
            <p className="text-sm text-neutral-500 mt-1">
              Share your referral code to start earning rewards!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {referrals.slice(0, 5).map((referral) => (
              <div key={referral.id} className="flex items-center justify-between p-4 bg-neutral-900/50 rounded-lg border border-neutral-700/30">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-neutral-700/50 border border-neutral-600/40 flex items-center justify-center">
                    <User className="h-5 w-5 text-neutral-300" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{referral.username}</p>
                    <p className="text-sm text-neutral-400">{referral.email}</p>
                    <p className="text-xs text-neutral-500">
                      Joined {new Date(referral.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge
                    variant={referral.status === 'completed' ? 'default' : 'secondary'}
                    className={
                      referral.status === 'completed'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    }
                  >
                    {referral.status === 'completed' ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {referral.status === 'completed' ? 'Completed' : 'Pending'}
                  </Badge>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">+{referral.reward}</p>
                    <p className="text-xs text-neutral-400">coins</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

RecentReferralsCard.displayName = 'RecentReferralsCard'
export default RecentReferralsCard
