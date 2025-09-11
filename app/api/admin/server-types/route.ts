import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  CythroDashServerType,
  ServerTypeCategory,
  ServerTypeStatus,
  ServerTypeHelpers,
  SERVER_TYPES_COLLECTION
} from '@/database/tables/cythro_dash_server_types'
import { serverTypesGetAll, serverTypesCreate } from '@/hooks/managers/database/server-type'
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache'
import { compressedJson } from '@/lib/compress'

// Validation schemas
const createServerTypeSchema = z.object({
  id: z.string().min(1, 'Server type ID is required'),
  name: z.string().min(1, 'Server type name is required'),
  description: z.string().optional(),
  short_description: z.string().optional(),
  category: z.nativeEnum(ServerTypeCategory),
  pterodactyl_nest_id: z.number().min(1, 'Valid Pterodactyl nest ID is required'),
  display_order: z.number().min(0).default(100),
  featured: z.boolean().default(false),
  popular: z.boolean().default(false),
  status: z.nativeEnum(ServerTypeStatus).default(ServerTypeStatus.ACTIVE),
  resource_requirements: z.object({
    min_memory: z.number().min(1, 'Minimum memory must be greater than 0'),
    min_disk: z.number().min(1, 'Minimum disk must be greater than 0'),
    min_cpu: z.number().min(0.1, 'Minimum CPU must be greater than 0'),
    recommended_memory: z.number().optional(),
    recommended_disk: z.number().optional(),
    recommended_cpu: z.number().optional(),
  }),
  display_config: z.object({
    icon: z.string().optional(),
    color: z.string().optional(),
    banner_image: z.string().optional(),
    thumbnail: z.string().optional(),
  }).default({}),
  access_restrictions: z.object({
    min_user_role: z.number().optional(),
    requires_verification: z.boolean().optional(),
    max_servers_per_user: z.number().optional(),
    whitelist_users: z.array(z.number()).optional(),
  }).default({}),
  configuration: z.object({
    supports_custom_jar: z.boolean().default(false),
    supports_plugins: z.boolean().default(false),
    supports_mods: z.boolean().default(false),
    supports_custom_startup: z.boolean().default(false),
    auto_start: z.boolean().default(true),
    crash_detection: z.boolean().default(true),
  }).default({}),
  documentation: z.object({
    setup_guide_url: z.string().optional(),
    wiki_url: z.string().optional(),
    support_forum_url: z.string().optional(),
    video_tutorial_url: z.string().optional(),
  }).default({}),
  created_by: z.number(),
})

const getServerTypesSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('25'),
  search: z.string().optional(),
  category: z.nativeEnum(ServerTypeCategory).optional(),
  status: z.nativeEnum(ServerTypeStatus).optional(),
  sort_by: z.enum(['name', 'category', 'display_order', 'created_at', 'status']).default('display_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
  include_stats: z.string().transform(val => val === 'true').default('false'),
})

// Helper function to check admin authentication
function checkAdminAuth(request: NextRequest) {
  try {
    const userDataHeader = request.headers.get('x-user-data')
    if (!userDataHeader) {
      return { success: false, error: 'Authentication required' }
    }

    const userData = JSON.parse(decodeURIComponent(userDataHeader))
    if (!userData || userData.role !== 0) {
      return { success: false, error: 'Admin access required' }
    }

    return { success: true, user: userData }
  } catch (error) {
    return { success: false, error: 'Invalid authentication data' }
  }
}

// GET /api/admin/server-types - Get all server types with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = checkAdminAuth(request)
    if (!authResult.success) {
      return compressedJson(request, { success: false, message: authResult.error }, 401)
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validatedParams = getServerTypesSchema.parse(queryParams)

    // Build filters for database query
    const filters: any = {}

    if (validatedParams.search) {
      filters.$or = [
        { name: { $regex: validatedParams.search, $options: 'i' } },
        { description: { $regex: validatedParams.search, $options: 'i' } },
        { short_description: { $regex: validatedParams.search, $options: 'i' } }
      ]
    }

    if (validatedParams.category) {
      filters.category = validatedParams.category
    }

    if (validatedParams.status) {
      filters.status = validatedParams.status
    }

    // Build sort options
    const sortOptions: any = {}
    sortOptions[validatedParams.sort_by] = validatedParams.sort_order === 'asc' ? 1 : -1

    // Cache lookup
    const t0 = Date.now()
    const bypass = shouldBypassCache(request.url)
    const cacheKey = makeKey(['admin_server_types', authResult.success ? 'admin' : 'anon', JSON.stringify({ filters, sortOptions, page: validatedParams.page, limit: validatedParams.limit, include_stats: validatedParams.include_stats })])
    if (!bypass) {
      const cached = getCache<any>(cacheKey)
      const ifNoneMatch = request.headers.get('if-none-match') || ''
      if (cached.hit && cached.value) {
        const etag = cached.etag || makeETagFromObject(cached.value)
        if (etag && ifNoneMatch && ifNoneMatch === etag) {
          return new NextResponse(null, { status: 304, headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } })
        }
        return compressedJson(request, cached.value, 200, { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` })
      }
    }

    // Get server types from database
    const result = await serverTypesGetAll({
      filters,
      sort: sortOptions,
      page: validatedParams.page,
      limit: validatedParams.limit,
      include_stats: validatedParams.include_stats
    })

    if (!result.success) {
      return compressedJson(request, { success: false, message: result.message || 'Failed to fetch server types' }, 500)
    }

    const payload = {
      success: true,
      data: {
        server_types: result.data?.server_types || [],
        pagination: result.data?.pagination || {
          current_page: validatedParams.page,
          total_pages: 1,
          total_items: 0,
          items_per_page: validatedParams.limit
        },
        stats: validatedParams.include_stats ? result.data?.stats : undefined
      }
    }

    const etag = makeETagFromObject(payload)
    if (!bypass) setCache(cacheKey, payload, 20_000, { ETag: etag }, etag)
    return compressedJson(request, payload, 200, { ETag: etag, 'X-Cache': bypass ? 'BYPASS' : 'MISS', 'X-Response-Time': `${Date.now()-t0}ms` })

  } catch (error) {
    console.error('Error in GET /api/admin/server-types:', error)

    if (error instanceof z.ZodError) {
      return compressedJson(request, { success: false, message: 'Invalid request parameters', errors: error.errors }, 400)
    }

    return compressedJson(request, { success: false, message: 'Internal server error' }, 500)
  }
}

// POST /api/admin/server-types - Create a new server type
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authResult = checkAdminAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createServerTypeSchema.parse(body)

    // Validate server type data using helper
    const validation = ServerTypeHelpers.validateServerTypeData(validatedData)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid server type data',
          errors: validation.errors 
        },
        { status: 400 }
      )
    }

    // Prepare server type data
    const serverTypeData: CythroDashServerType = {
      ...validatedData,
      created_at: new Date(),
      updated_at: new Date(),
    }

    // Create server type in database
    const result = await serverTypesCreate(serverTypeData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to create server type' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Server type created successfully',
      data: result.data
    }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/admin/server-types:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid request data',
          errors: error.errors 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
