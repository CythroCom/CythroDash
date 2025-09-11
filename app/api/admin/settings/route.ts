/**
 * Admin Settings - List/Update
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import AdminSettingsController from '@/hooks/managers/controller/Admin/SettingsController'
import { requireAdmin } from '@/lib/auth/middleware'

const listSchema = z.object({})
const updateSchema = z.object({ key: z.string().min(1), value: z.any() })



export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.success) return admin.response!

  const items = await AdminSettingsController.listAll()
  return NextResponse.json({ success: true, items })
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.success) return admin.response!

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid payload', errors: parsed.error.errors }, { status: 400 })

  const ok = await AdminSettingsController.update(parsed.data.key, parsed.data.value, admin.user!.id)
  return NextResponse.json({ success: ok })
}

