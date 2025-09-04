/**
 * Admin Dashboard Summary Endpoint
 * Returns real metrics for the admin overview page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/database/index'
import { SERVERS_COLLECTION, ServerStatus, PowerState } from '@/database/tables/cythro_dash_servers'
import { transfersCollectionName, TransferStatus } from '@/database/tables/cythro_dash_transfers'
import { REFERRAL_CLICKS_COLLECTION, REFERRAL_SIGNUPS_COLLECTION } from '@/database/tables/cythro_dash_referrals'
import { getPublicFlag } from '@/lib/public-settings'

export const runtime = 'nodejs'

async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const sessionToken = request.cookies.get('session_token')?.value
    if (!sessionToken) return { success: false, error: 'No session token found' }
    const userDataHeader = request.headers.get('x-user-data')
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader))
        if (userData && userData.id && userData.username && userData.email) {
          return { success: true, user: userData }
        }
      } catch {}
    }
    const userDataCookie = request.cookies.get('x_user_data')?.value
    if (userDataCookie) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataCookie))
        if (userData && userData.id && userData.username && userData.email) {
          return { success: true, user: userData }
        }
      } catch {}
    }
    return { success: false, error: 'User identification required' }
  } catch (e) {
    return { success: false, error: 'Authentication failed' }
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
  if (auth.user.role !== 0) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 })

  try {
    const db = await connectToDatabase()
    const usersCol = db.collection('cythro_dash_users')
    const serversCol = db.collection(SERVERS_COLLECTION)
    const transfersCol = db.collection(transfersCollectionName)
    const referralClicksCol = db.collection(REFERRAL_CLICKS_COLLECTION)
    const referralSignupsCol = db.collection(REFERRAL_SIGNUPS_COLLECTION)

    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Users
    const [totalUsers, newUsers24h, activeUsers24h, totalCoinsAgg] = await Promise.all([
      usersCol.countDocuments({ deleted: { $ne: true } }),
      usersCol.countDocuments({ deleted: { $ne: true }, created_at: { $gte: last24h } }),
      usersCol.countDocuments({ deleted: { $ne: true }, last_activity: { $gte: last24h } }),
      usersCol.aggregate([
        { $match: { deleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$coins', 0] } } } }
      ]).toArray()
    ])
    const totalCoins = totalCoinsAgg?.[0]?.total || 0

    // Servers
    const [totalServers, activeServers, onlineServers] = await Promise.all([
      serversCol.countDocuments({}),
      serversCol.countDocuments({ status: ServerStatus.ACTIVE }),
      serversCol.countDocuments({ power_state: PowerState.ONLINE })
    ])

    // Average memory utilization across active servers where limits.memory > 0
    const memAgg = await serversCol.aggregate([
      { $match: { status: ServerStatus.ACTIVE, 'limits.memory': { $gt: 0 }, 'current_usage.memory': { $gte: 0 } } },
      { $project: { ratio: { $multiply: [{ $divide: ['$current_usage.memory', '$limits.memory'] }, 100] } } },
      { $group: { _id: null, avg: { $avg: '$ratio' } } }
    ]).toArray()
    const avgMemoryUtilization = Math.round((memAgg?.[0]?.avg || 0) * 10) / 10

    // Transfers (last 24h, completed only)
    const transfers24hAgg = await transfersCol.aggregate([
      { $match: { status: TransferStatus.COMPLETED, created_at: { $gte: last24h } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }
    ]).toArray()
    const transfers24h = { count: transfers24hAgg?.[0]?.count || 0, amount: transfers24hAgg?.[0]?.amount || 0 }

    // Referrals (if enabled)
    let referralMetrics: any = { enabled: false }
    let referralsEnabled = false
    try { referralsEnabled = await getPublicFlag('NEXT_PUBLIC_REFERRAL_PROGRAM', process.env.NEXT_PUBLIC_REFERRAL_PROGRAM === 'true') } catch {}
    if (referralsEnabled) {
      const [clicks24h, signups24h] = await Promise.all([
        referralClicksCol.countDocuments({ clicked_at: { $gte: last24h } }),
        referralSignupsCol.countDocuments({ signed_up_at: { $gte: last24h } })
      ])
      referralMetrics = { enabled: true, clicks24h, signups24h }
    }

    // Recent activity (merge top 10 by date across users, servers, transfers)
    const [recentUsers, recentServers, recentTransfers] = await Promise.all([
      usersCol.find({ deleted: { $ne: true } }).project({ id: 1, email: 1, username: 1, created_at: 1 }).sort({ created_at: -1 }).limit(10).toArray(),
      serversCol.find({}).project({ id: 1, name: 1, created_at: 1, status: 1 }).sort({ created_at: -1 }).limit(10).toArray(),
      transfersCol.find({}).project({ id: 1, amount: 1, from_username: 1, to_username: 1, created_at: 1, status: 1 }).sort({ created_at: -1 }).limit(10).toArray()
    ])

    const activity = [
      ...recentUsers.map((u: any) => ({ type: 'user', date: u.created_at, data: u })),
      ...recentServers.map((s: any) => ({ type: 'server', date: s.created_at, data: s })),
      ...recentTransfers.map((t: any) => ({ type: 'transfer', date: t.created_at, data: t }))
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        users: { total: totalUsers, new24h: newUsers24h, active24h: activeUsers24h, totalCoins },
        servers: { total: totalServers, active: activeServers, online: onlineServers, avgMemoryUtilization },
        transfers24h,
        referrals: referralMetrics,
        activity
      }
    })
  } catch (e: any) {
    console.error('Admin dashboard error:', e)
    return NextResponse.json({ success: false, message: 'Failed to load dashboard data' }, { status: 500 })
  }
}

