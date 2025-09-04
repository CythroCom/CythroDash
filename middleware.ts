/**
 * Root Middleware - applies IP blocking checks to all API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkIPBlocked } from './middleware/ip-blocking'

export async function middleware(req: NextRequest) {
  const blocked = await checkIPBlocked(req)
  if (blocked) return blocked
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*']
}

