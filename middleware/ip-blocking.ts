/**
 * CythroDash - IP Blocking Middleware (Edge-compatible)
 * Delegates IP check to a Node.js API route to avoid MongoDB in Edge runtime.
 */

import { NextRequest, NextResponse } from 'next/server'

const EXEMPT_PATHS = [
  '/api/admin/security/unblock-ip',
  '/api/admin/security/blocked-ips',
  '/api/internal/ip-block-check',
]

function getClientIP(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for') || ''
  const parts = xf.split(',').map(s => s.trim()).filter(Boolean)
  return parts[0] || req.headers.get('x-real-ip') || (req as any).ip || 'unknown'
}

function isWhitelisted(ip: string): boolean {
  const list = process.env.ADMIN_IP_WHITELIST || ''
  const ips = list.split(',').map(s => s.trim()).filter(Boolean)
  return ips.includes(ip)
}

export async function checkIPBlocked(req: NextRequest): Promise<NextResponse | undefined> {
  const url = new URL(req.url)
  if (!url.pathname.startsWith('/api/')) return undefined
  if (EXEMPT_PATHS.includes(url.pathname)) return undefined

  const ip = getClientIP(req)
  if (!ip || ip === 'unknown') return undefined
  if (isWhitelisted(ip)) return undefined

  // Delegate to internal API (Node runtime) to check block status
  const origin = url.origin
  const checkUrl = `${origin}/api/internal/ip-block-check?ip=${encodeURIComponent(ip)}`
  try {
    const res = await fetch(checkUrl, { method: 'GET', headers: { 'x-forwarded-for': ip, 'x-real-ip': ip }, cache: 'no-store' as any })
    if (!res.ok) return undefined
    const json = await res.json()
    if (json?.blocked) {
      return NextResponse.json({ success: false, message: 'Access from this IP is blocked', reason: json?.reason, expires_at: json?.expires_at }, { status: 403 })
    }
  } catch {
    // Fail open to avoid taking down API
    return undefined
  }

  return undefined
}

