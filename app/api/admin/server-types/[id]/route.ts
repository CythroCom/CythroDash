import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { 
  ServerTypeCategory, 
  ServerTypeStatus,
  ServerTypeHelpers 
} from '@/database/tables/cythro_dash_server_types'
import { 
  serverTypesGetById, 
  serverTypesUpdate, 
  serverTypesDelete 
} from '@/hooks/managers/database/server-type'

// Validation schemas
const updateServerTypeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  short_description: z.string().optional(),
  category: z.nativeEnum(ServerTypeCategory).optional(),
  pterodactyl_nest_id: z.number().min(1).optional(),
  display_order: z.number().min(0).optional(),
  featured: z.boolean().optional(),
  popular: z.boolean().optional(),
  status: z.nativeEnum(ServerTypeStatus).optional(),
  resource_requirements: z.object({
    min_memory: z.number().min(1).optional(),
    min_disk: z.number().min(1).optional(),
    min_cpu: z.number().min(0.1).optional(),
    recommended_memory: z.number().optional(),
    recommended_disk: z.number().optional(),
    recommended_cpu: z.number().optional(),
  }).optional(),
  display_config: z.object({
    icon: z.string().optional(),
    color: z.string().optional(),
    banner_image: z.string().optional(),
    thumbnail: z.string().optional(),
  }).optional(),
  access_restrictions: z.object({
    min_user_role: z.number().optional(),
    requires_verification: z.boolean().optional(),
    max_servers_per_user: z.number().optional(),
    whitelist_users: z.array(z.number()).optional(),
  }).optional(),
  configuration: z.object({
    supports_custom_jar: z.boolean().optional(),
    supports_plugins: z.boolean().optional(),
    supports_mods: z.boolean().optional(),
    supports_custom_startup: z.boolean().optional(),
    auto_start: z.boolean().optional(),
    crash_detection: z.boolean().optional(),
  }).optional(),
  documentation: z.object({
    setup_guide_url: z.string().optional(),
    wiki_url: z.string().optional(),
    support_forum_url: z.string().optional(),
    video_tutorial_url: z.string().optional(),
  }).optional(),
  last_modified_by: z.number().optional(),
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

// GET /api/admin/server-types/[id] - Get a specific server type
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const authResult = checkAdminAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: 401 }
      )
    }

    const serverTypeId = params.id

    // Get server type from database
    const result = await serverTypesGetById(serverTypeId)

    if (!result.success) {
      if (result.message?.includes('not found')) {
        return NextResponse.json(
          { success: false, message: 'Server type not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to fetch server type' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })

  } catch (error) {
    console.error('Error in GET /api/admin/server-types/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/server-types/[id] - Update a server type
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const authResult = checkAdminAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: 401 }
      )
    }

    const serverTypeId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateServerTypeSchema.parse(body)

    // Prepare update data with proper nested object handling
    const updateData: any = {
      updated_at: new Date(),
      last_modified_by: authResult.user.id
    }

    // Handle top-level fields
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.short_description !== undefined) updateData.short_description = validatedData.short_description
    if (validatedData.category !== undefined) updateData.category = validatedData.category
    if (validatedData.pterodactyl_nest_id !== undefined) updateData.pterodactyl_nest_id = validatedData.pterodactyl_nest_id
    if (validatedData.display_order !== undefined) updateData.display_order = validatedData.display_order
    if (validatedData.featured !== undefined) updateData.featured = validatedData.featured
    if (validatedData.popular !== undefined) updateData.popular = validatedData.popular
    if (validatedData.status !== undefined) updateData.status = validatedData.status

    // Handle nested objects with partial updates
    if (validatedData.resource_requirements !== undefined) {
      // Get current server type to merge with existing resource_requirements
      const currentServerType = await serverTypesGetById(serverTypeId)
      if (currentServerType.success && currentServerType.data) {
        updateData.resource_requirements = {
          ...currentServerType.data.resource_requirements,
          ...validatedData.resource_requirements
        }
      } else {
        // If we can't get current data, ensure required fields are present
        const requirements = validatedData.resource_requirements
        if (!requirements.min_memory || !requirements.min_disk || !requirements.min_cpu) {
          return NextResponse.json(
            { success: false, message: 'min_memory, min_disk, and min_cpu are required when updating resource_requirements' },
            { status: 400 }
          )
        }
        updateData.resource_requirements = validatedData.resource_requirements
      }
    }

    if (validatedData.display_config !== undefined) {
      const currentServerType = await serverTypesGetById(serverTypeId)
      if (currentServerType.success && currentServerType.data) {
        updateData.display_config = {
          ...currentServerType.data.display_config,
          ...validatedData.display_config
        }
      } else {
        updateData.display_config = validatedData.display_config
      }
    }

    if (validatedData.access_restrictions !== undefined) {
      const currentServerType = await serverTypesGetById(serverTypeId)
      if (currentServerType.success && currentServerType.data) {
        updateData.access_restrictions = {
          ...currentServerType.data.access_restrictions,
          ...validatedData.access_restrictions
        }
      } else {
        updateData.access_restrictions = validatedData.access_restrictions
      }
    }

    if (validatedData.configuration !== undefined) {
      const currentServerType = await serverTypesGetById(serverTypeId)
      if (currentServerType.success && currentServerType.data) {
        updateData.configuration = {
          ...currentServerType.data.configuration,
          ...validatedData.configuration
        }
      } else {
        updateData.configuration = validatedData.configuration
      }
    }

    if (validatedData.documentation !== undefined) {
      const currentServerType = await serverTypesGetById(serverTypeId)
      if (currentServerType.success && currentServerType.data) {
        updateData.documentation = {
          ...currentServerType.data.documentation,
          ...validatedData.documentation
        }
      } else {
        updateData.documentation = validatedData.documentation
      }
    }

    // Update server type in database
    const result = await serverTypesUpdate(serverTypeId, updateData)

    if (!result.success) {
      if (result.message?.includes('not found')) {
        return NextResponse.json(
          { success: false, message: 'Server type not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to update server type' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Server type updated successfully',
      data: result.data
    })

  } catch (error) {
    console.error('Error in PATCH /api/admin/server-types/[id]:', error)
    
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

// DELETE /api/admin/server-types/[id] - Delete a server type
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const authResult = checkAdminAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: 401 }
      )
    }

    const serverTypeId = params.id

    // Check if server type exists first
    const existsResult = await serverTypesGetById(serverTypeId)
    if (!existsResult.success) {
      return NextResponse.json(
        { success: false, message: 'Server type not found' },
        { status: 404 }
      )
    }

    // TODO: Check if server type is being used by any servers
    // This should prevent deletion if there are active servers using this type

    // Delete server type from database
    const result = await serverTypesDelete(serverTypeId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to delete server type' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Server type deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/admin/server-types/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
