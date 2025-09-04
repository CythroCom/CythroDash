/**
 * Public Redirect: /api/r/[slug]
 */

import { NextRequest, NextResponse } from 'next/server'
import shortLinksOperations from '@/hooks/managers/database/short-links'

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const doc = await shortLinksOperations.getBySlug(params.slug)
    if (!doc || !doc.is_active) {
      return NextResponse.json({ success: false, message: 'Link not found' }, { status: 404 })
    }
    await shortLinksOperations.incrementClickCount(params.slug)
    return NextResponse.redirect(doc.target_url, { status: 302 })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: 'Link not found' }, { status: 404 })
  }
}

