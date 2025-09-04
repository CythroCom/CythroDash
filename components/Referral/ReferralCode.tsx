"use client"

import React, { memo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Share2, ExternalLink } from 'lucide-react'
import { showError, showSuccess } from '@/lib/toast'

interface ReferralCodeCardProps {
  referralCode: string
  className?: string
}

const ReferralCodeCard = memo(({ referralCode, className = "" }: ReferralCodeCardProps) => {
  const referralUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${referralCode}`

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      showSuccess('Referral code copied to clipboard!')
    } catch (e) {
      showError('Failed to copy referral code')
    }
  }, [referralCode])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralUrl)
      showSuccess('Referral link copied to clipboard!')
    } catch (e) {
      showError('Failed to copy referral link')
    }
  }, [referralUrl])

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join CythroDash',
          text: 'Join me on CythroDash and we both earn rewards!',
          url: referralUrl,
        })
      } catch (e) {
        // User cancelled sharing or sharing failed
        handleCopyLink()
      }
    } else {
      handleCopyLink()
    }
  }, [referralUrl, handleCopyLink])

  return (
    <Card className={`border-neutral-700/50 bg-neutral-800/40 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white">Your Referral Code</CardTitle>
        <CardDescription className="text-neutral-400">
          Share this code or link with friends to earn rewards when they sign up
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Referral Code */}
        <div className="flex items-center justify-between p-4 bg-neutral-900/50 rounded-lg border border-neutral-700/30">
          <div>
            <div className="text-sm text-neutral-400 mb-1">Referral Code</div>
            <div className="text-2xl font-mono font-bold text-white tracking-wider">
              {referralCode}
            </div>
          </div>
          <Button
            onClick={handleCopyCode}
            variant="outline"
            size="sm"
            className="border-neutral-600 hover:bg-neutral-700"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Code
          </Button>
        </div>

        {/* Referral Link */}
        <div className="flex items-center justify-between p-4 bg-neutral-900/50 rounded-lg border border-neutral-700/30">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-neutral-400 mb-1">Referral Link</div>
            <div className="text-sm text-neutral-300 font-mono truncate">
              {referralUrl}
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            <Button
              onClick={handleCopyLink}
              variant="outline"
              size="sm"
              className="border-neutral-600 hover:bg-neutral-700"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button
              onClick={handleShare}
              variant="outline"
              size="sm"
              className="border-neutral-600 hover:bg-neutral-700"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

ReferralCodeCard.displayName = 'ReferralCodeCard'
export default ReferralCodeCard

