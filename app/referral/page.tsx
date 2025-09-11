"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/user-store'
import { useReferralStats } from '@/hooks/useReferralStats'
import { useToast } from '@/hooks/use-toast'
import PerformanceMonitor from '@/components/PerformanceMonitor'
import { preloadCriticalComponents } from '@/components/LazyComponents'
import { Sidebar, Header } from '@/components/LazyComponents'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Star, Trophy, Crown, Gem } from 'lucide-react'
import LoadingOverlay from '@/components/LoadingOverlay'
import { useAppBootstrap } from '@/hooks/use-bootstrap'

// Import referral components (will create these to match backup)
import ReferralHero from '@/components/Referral/ReferralHero'
import ReferralCodeCard from '@/components/Referral/ReferralCode'
import HowItWorksCard from '@/components/Referral/HowItWorksCard'
import RecentReferralsCard from '@/components/Referral/RecentReferralsCard'
import CurrentTierCard from '@/components/Referral/CurrentTierCard'
import AllTiersCard from '@/components/Referral/AllTiersCard'

// Tier definitions (matching backup)
const referralTiers = [
  {
    name: "Bronze",
    minReferrals: 0,
    maxReferrals: 4,
    bonus: 10,
    color: "from-amber-600 to-amber-800",
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
    borderColor: "border-amber-500/20",
    icon: Star,
    perks: ["10% bonus on referral rewards", "Basic referral tracking"],
  },
  {
    name: "Silver",
    minReferrals: 5,
    maxReferrals: 14,
    bonus: 25,
    color: "from-gray-400 to-gray-600",
    bgColor: "bg-gray-500/10",
    textColor: "text-gray-400",
    borderColor: "border-gray-500/20",
    icon: Trophy,
    perks: ["25% bonus on referral rewards", "Priority support", "Custom referral code"],
  },
  {
    name: "Gold",
    minReferrals: 15,
    maxReferrals: 49,
    bonus: 50,
    color: "from-yellow-400 to-yellow-600",
    bgColor: "bg-yellow-500/10",
    textColor: "text-yellow-400",
    borderColor: "border-yellow-500/20",
    icon: Crown,
    perks: ["50% bonus on referral rewards", "VIP support", "Exclusive events", "Monthly bonus"],
  },
  {
    name: "Diamond",
    minReferrals: 50,
    maxReferrals: Number.POSITIVE_INFINITY,
    bonus: 100,
    color: "from-cyan-400 to-blue-600",
    bgColor: "bg-cyan-500/10",
    textColor: "text-cyan-400",
    borderColor: "border-cyan-500/20",
    icon: Gem,
    perks: ["100% bonus on referral rewards", "Personal account manager", "Beta access", "Revenue sharing"],
  },
]

export default function ReferralPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentUser, isAuthenticated, checkSession } = useAuthStore()
  const { stats, referrals, error, claimRewards, isClaimingRewards } = useReferralStats()
  const [checking, setChecking] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    preloadCriticalComponents()
  }, [])

  // Auth guard
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await checkSession()
      if (!ok && !cancelled) router.replace('/login')
      setChecking(false)
    })()
    return () => { cancelled = true }
  }, [checkSession, router])

  const handleSidebarToggle = useCallback(() => setSidebarOpen(prev => !prev), [])
  const handleMenuClick = useCallback(() => setSidebarOpen(true), [])
  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])

  // Global bootstrap (session + public settings) must be before any early returns
  const { isLoading: bootLoading } = useAppBootstrap()

  // Handle claim rewards (matching backup implementation)
  const handleClaimRewards = async () => {
    const result = await claimRewards()
    if (result.success) {
      const claimedAmount = result.data?.total_claimed || 0
      toast({
        title: "Rewards Claimed! 🎉",
        description: claimedAmount > 0
          ? `Successfully claimed ${claimedAmount} coins! Your balance has been updated.`
          : result.message || "No rewards available to claim",
      })
    } else {
      toast({
        title: "Claim Failed",
        description: result.message || "Failed to claim rewards. Please try again.",
        variant: "destructive"
      })
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-900">
        <Sidebar isOpen={sidebarOpen} onToggle={handleSidebarToggle} />
        <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'}`}>
          <Header searchQuery={searchQuery} onSearchChange={handleSearchChange} onMenuClick={handleMenuClick} />
          <main className="p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <Alert className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please log in to access the referral program.
                </AlertDescription>
              </Alert>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-900">
        <Sidebar isOpen={sidebarOpen} onToggle={handleSidebarToggle} />
        <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'}`}>
          <Header searchQuery={searchQuery} onSearchChange={handleSearchChange} onMenuClick={handleMenuClick} />
          <main className="p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Get data from stats or use defaults (matching backup)
  const totalReferrals = stats?.total_signups || 0
  const totalEarned = stats?.total_earnings || 0
  const thisMonthEarned = stats?.earnings_this_month || 0
  const pendingEarnings = stats?.pending_earnings || 0

  // Calculate current tier (matching backup)
  const currentTier = referralTiers.find((tier) =>
    totalReferrals >= tier.minReferrals &&
    (tier.maxReferrals === Number.POSITIVE_INFINITY || totalReferrals <= tier.maxReferrals)
  ) || referralTiers[0]

  const nextTier = referralTiers.find((tier) => tier.minReferrals > totalReferrals)

  return (
    <div className="min-h-screen bg-neutral-900">
      {bootLoading && <LoadingOverlay message="Preparing your dashboard..." />}
      <Sidebar isOpen={sidebarOpen} onToggle={handleSidebarToggle} />

      <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'}`}>
        <Header
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onMenuClick={handleMenuClick}
        />

        <main className="p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Hero Section */}
            <ReferralHero
              totalReferrals={totalReferrals}
              totalEarned={totalEarned}
              thisMonthEarned={thisMonthEarned}
              currentTier={currentTier}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Referral Code */}
                <ReferralCodeCard
                  referralCode={currentUser?.referral_code || 'GENERATING...'}
                />

                {/* How It Works */}
                <HowItWorksCard />

                {/* Recent Referrals */}
                <RecentReferralsCard
                  referrals={referrals}
                  isLoading={false}
                />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Current Tier */}
                <CurrentTierCard
                  currentTier={currentTier}
                  nextTier={nextTier}
                  totalReferrals={totalReferrals}
                  pendingEarnings={pendingEarnings}
                  onClaimRewards={handleClaimRewards}
                  isClaimingRewards={isClaimingRewards}
                />

                {/* All Tiers */}
                <AllTiersCard
                  tiers={referralTiers}
                  currentTierName={currentTier.name}
                  totalReferrals={totalReferrals}
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      <PerformanceMonitor />
    </div>
  )
}

