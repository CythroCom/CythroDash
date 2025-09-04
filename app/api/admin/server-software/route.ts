import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { 
  CythroDashServerSoftware, 
  SoftwareStability, 
  SoftwareStatus,
  ServerSoftwareHelpers,
  VersionInfo,
  DockerConfig,
  EnvironmentVariable,
  SERVER_SOFTWARE_COLLECTION 
} from '@/database/tables/cythro_dash_server_software'
import { serverSoftwareGetAll, serverSoftwareCreate } from '@/hooks/managers/database/server-software'

// Validation schemas
const environmentVariableSchema = z.object({
  name: z.string().min(1),
  display_name: z.string().min(1),
  description: z.string().optional(),
  default_value: z.string(),
  user_viewable: z.boolean().default(true),
  user_editable: z.boolean().default(true),
  validation_rules: z.string().optional(),
  field_type: z.enum(['text', 'number', 'boolean', 'select', 'textarea']).default('text'),
  select_options: z.array(z.string()).optional(),
})

const versionInfoSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  minecraft_version: z.string().optional(),
  build_number: z.string().optional(),
  release_date: z.string().transform(str => new Date(str)).optional(),
  changelog_url: z.string().optional(),
})

const dockerConfigSchema = z.object({
  image: z.string().min(1, 'Docker image is required'),
  alternative_images: z.record(z.string()).optional(),
  startup_command: z.string().optional(),
  stop_command: z.string().optional(),
})

const createServerSoftwareSchema = z.object({
  id: z.string().min(1, 'Software ID is required'),
  name: z.string().min(1, 'Software name is required'),
  description: z.string().optional(),
  short_description: z.string().optional(),
  server_type_id: z.string().min(1, 'Server type ID is required'),
  pterodactyl_egg_id: z.number().min(1, 'Valid Pterodactyl egg ID is required'),
  version_info: versionInfoSchema,
  stability: z.nativeEnum(SoftwareStability).default(SoftwareStability.STABLE),
  status: z.nativeEnum(SoftwareStatus).default(SoftwareStatus.ACTIVE),
  recommended: z.boolean().default(false),
  latest: z.boolean().default(false),
  docker_config: dockerConfigSchema,
  environment_variables: z.array(environmentVariableSchema).default([]),
  display_order: z.number().min(0).default(100),
  icon: z.string().optional(),
  color: z.string().optional(),
  resource_overrides: z.object({
    min_memory: z.number().optional(),
    min_disk: z.number().optional(),
    min_cpu: z.number().optional(),
    recommended_memory: z.number().optional(),
    recommended_disk: z.number().optional(),
    recommended_cpu: z.number().optional(),
  }).optional(),
  compatibility: z.object({
    min_java_version: z.number().optional(),
    max_java_version: z.number().optional(),
    supported_architectures: z.array(z.string()).optional(),
    requires_specific_os: z.array(z.string()).optional(),
  }).default({}),
  features: z.object({
    supports_plugins: z.boolean().default(false),
    supports_mods: z.boolean().default(false),
    supports_datapacks: z.boolean().default(false),
    supports_custom_worlds: z.boolean().default(true),
    supports_backups: z.boolean().default(true),
    supports_console_commands: z.boolean().default(true),
    supports_file_manager: z.boolean().default(true),
  }).default({}),
  documentation: z.object({
    installation_guide: z.string().optional(),
    configuration_guide: z.string().optional(),
    plugin_guide: z.string().optional(),
    troubleshooting_guide: z.string().optional(),
    official_website: z.string().optional(),
    github_repository: z.string().optional(),
  }).default({}),
  update_info: z.object({
    auto_update_available: z.boolean().optional(),
    update_frequency: z.string().optional(),
    last_updated: z.string().transform(str => new Date(str)).optional(),
    next_update_eta: z.string().transform(str => new Date(str)).optional(),
    security_updates: z.boolean().optional(),
  }).default({}),
  created_by: z.number(),
})

const getServerSoftwareSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('25'),
  search: z.string().optional(),
  server_type_id: z.string().optional(),
  stability: z.nativeEnum(SoftwareStability).optional(),
  status: z.nativeEnum(SoftwareStatus).optional(),
  sort_by: z.enum(['name', 'version', 'display_order', 'created_at', 'status']).default('display_order'),
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

// GET /api/admin/server-software - Get all server software with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = checkAdminAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: 401 }
      )
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    const validatedParams = getServerSoftwareSchema.parse(queryParams)

    // Build filters for database query
    const filters: any = {}
    
    if (validatedParams.search) {
      filters.$or = [
        { name: { $regex: validatedParams.search, $options: 'i' } },
        { description: { $regex: validatedParams.search, $options: 'i' } },
        { short_description: { $regex: validatedParams.search, $options: 'i' } },
        { 'version_info.version': { $regex: validatedParams.search, $options: 'i' } }
      ]
    }

    if (validatedParams.server_type_id) {
      filters.server_type_id = validatedParams.server_type_id
    }

    if (validatedParams.stability) {
      filters.stability = validatedParams.stability
    }

    if (validatedParams.status) {
      filters.status = validatedParams.status
    }

    // Build sort options
    const sortOptions: any = {}
    if (validatedParams.sort_by === 'version') {
      sortOptions['version_info.version'] = validatedParams.sort_order === 'asc' ? 1 : -1
    } else {
      sortOptions[validatedParams.sort_by] = validatedParams.sort_order === 'asc' ? 1 : -1
    }

    // Get server software from database
    const result = await serverSoftwareGetAll({
      filters,
      sort: sortOptions,
      page: validatedParams.page,
      limit: validatedParams.limit,
      include_stats: validatedParams.include_stats
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to fetch server software' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        server_software: result.data?.server_software || [],
        pagination: result.data?.pagination || {
          current_page: validatedParams.page,
          total_pages: 1,
          total_items: 0,
          items_per_page: validatedParams.limit
        },
        stats: validatedParams.include_stats ? result.data?.stats : undefined
      }
    })

  } catch (error) {
    console.error('Error in GET /api/admin/server-software:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid request parameters',
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

// POST /api/admin/server-software - Create new server software
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
    const validatedData = createServerSoftwareSchema.parse(body)

    // Validate software data using helper
    const validation = ServerSoftwareHelpers.validateSoftwareData(validatedData)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid server software data',
          errors: validation.errors 
        },
        { status: 400 }
      )
    }

    // Prepare server software data
    const serverSoftwareData: CythroDashServerSoftware = {
      ...validatedData,
      created_at: new Date(),
      updated_at: new Date(),
    }

    // Create server software in database
    const result = await serverSoftwareCreate(serverSoftwareData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to create server software' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Server software created successfully',
      data: result.data
    }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/admin/server-software:', error)
    
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
