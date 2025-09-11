/**
 * Admin Settings - List by Category
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import AdminSettingsController from '@/hooks/managers/controller/Admin/SettingsController'
import { requireAdmin } from '@/lib/auth/middleware'

const paramsSchema = z.object({ category: z.enum(['general','oauth','features','security','appearance']) })



export async function GET(request: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin.success) return admin.response!

  const { category } = await params
  const parsed = paramsSchema.safeParse({ category })
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid category' }, { status: 400 })

  const items = await AdminSettingsController.listByCategory(parsed.data.category)
  return NextResponse.json({ success: true, items })
}

