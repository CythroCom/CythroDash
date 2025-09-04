/**
 * Internal: IP Block Check (Node runtime)
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import blockedIPsOperations from '@/hooks/managers/database/blocked-ips'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const ip = url.searchParams.get('ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || ''
    if (!ip) return NextResponse.json({ blocked: false })
    const check = await blockedIPsOperations.isIPBlocked(String(ip))
    if (check.blocked) {
      try { await blockedIPsOperations.incrementHit(check.record?.ip_address || String(ip)) } catch {}
      return NextResponse.json({ blocked: true, reason: check.record?.reason, expires_at: check.record?.expires_at })
    }
    return NextResponse.json({ blocked: false })
  } catch (e: any) {
    return NextResponse.json({ blocked: false })
  }
}

