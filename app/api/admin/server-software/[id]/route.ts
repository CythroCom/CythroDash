import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { 
  SoftwareStability, 
  SoftwareStatus,
  ServerSoftwareHelpers 
} from '@/database/tables/cythro_dash_server_software'
import {
  serverSoftwareGetById,
  serverSoftwareUpdate,
  serverSoftwareDelete
} from '@/hooks/managers/database/server-software'
import { panelNestGetAll } from '@/hooks/managers/pterodactyl/nests'
import { panelEggGetAll } from '@/hooks/managers/pterodactyl/eggs'

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

const updateServerSoftwareSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  short_description: z.string().optional(),
  server_type_id: z.string().min(1).optional(),
  pterodactyl_egg_id: z.number().min(1).optional(),
  version_info: z.object({
    version: z.string().min(1).optional(),
    minecraft_version: z.string().optional(),
    build_number: z.string().optional(),
    release_date: z.string().transform(str => new Date(str)).optional(),
    changelog_url: z.string().optional(),
  }).optional(),
  stability: z.nativeEnum(SoftwareStability).optional(),
  status: z.nativeEnum(SoftwareStatus).optional(),
  recommended: z.boolean().optional(),
  latest: z.boolean().optional(),
  docker_config: z.object({
    image: z.string().min(1).optional(),
    alternative_images: z.record(z.string()).optional(),
    startup_command: z.string().optional(),
    stop_command: z.string().optional(),
  }).optional(),
  environment_variables: z.array(environmentVariableSchema).optional(),
  refresh_environment_variables: z.boolean().optional(), // Flag to refresh from Pterodactyl
  display_order: z.number().min(0).optional(),
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
  }).optional(),
  features: z.object({
    supports_plugins: z.boolean().optional(),
    supports_mods: z.boolean().optional(),
    supports_datapacks: z.boolean().optional(),
    supports_custom_worlds: z.boolean().optional(),
    supports_backups: z.boolean().optional(),
    supports_console_commands: z.boolean().optional(),
    supports_file_manager: z.boolean().optional(),
  }).optional(),
  documentation: z.object({
    installation_guide: z.string().optional(),
    configuration_guide: z.string().optional(),
    plugin_guide: z.string().optional(),
    troubleshooting_guide: z.string().optional(),
    official_website: z.string().optional(),
    github_repository: z.string().optional(),
  }).optional(),
  update_info: z.object({
    auto_update_available: z.boolean().optional(),
    update_frequency: z.string().optional(),
    last_updated: z.string().transform(str => new Date(str)).optional(),
    next_update_eta: z.string().transform(str => new Date(str)).optional(),
    security_updates: z.boolean().optional(),
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

// GET /api/admin/server-software/[id] - Get a specific server software
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

    const softwareId = params.id

    // Get server software from database
    const result = await serverSoftwareGetById(softwareId)

    if (!result.success) {
      if (result.message?.includes('not found')) {
        return NextResponse.json(
          { success: false, message: 'Server software not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to fetch server software' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })

  } catch (error) {
    console.error('Error in GET /api/admin/server-software/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/server-software/[id] - Update server software
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

    const softwareId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateServerSoftwareSchema.parse(body)

    // Prepare update data with proper nested object handling
    const updateData: any = {
      updated_at: new Date(),
      last_modified_by: authResult.user.id
    }

    // Handle top-level fields
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.short_description !== undefined) updateData.short_description = validatedData.short_description
    if (validatedData.server_type_id !== undefined) updateData.server_type_id = validatedData.server_type_id
    if (validatedData.pterodactyl_egg_id !== undefined) updateData.pterodactyl_egg_id = validatedData.pterodactyl_egg_id
    if (validatedData.stability !== undefined) updateData.stability = validatedData.stability
    if (validatedData.status !== undefined) updateData.status = validatedData.status
    if (validatedData.recommended !== undefined) updateData.recommended = validatedData.recommended
    if (validatedData.latest !== undefined) updateData.latest = validatedData.latest
    if (validatedData.display_order !== undefined) updateData.display_order = validatedData.display_order
    if (validatedData.icon !== undefined) updateData.icon = validatedData.icon
    if (validatedData.color !== undefined) updateData.color = validatedData.color
    if (validatedData.environment_variables !== undefined) updateData.environment_variables = validatedData.environment_variables

    // Handle refresh environment variables from Pterodactyl
    if (validatedData.refresh_environment_variables === true) {
      console.log('Refreshing environment variables from Pterodactyl for software:', softwareId)

      try {
        // Get current software to get the pterodactyl_egg_id
        const currentSoftware = await serverSoftwareGetById(softwareId)
        if (!currentSoftware.success || !currentSoftware.data) {
          return NextResponse.json(
            { success: false, message: 'Server software not found' },
            { status: 404 }
          )
        }

        const eggId = currentSoftware.data.pterodactyl_egg_id
        console.log('Fetching environment variables for egg ID:', eggId)

        // Search through all nests to find the egg
        const nestsResponse = await panelNestGetAll({ per_page: 100 })
        let environmentVariables: any[] = []

        for (const nestResponse of nestsResponse.data) {
          if (nestResponse.attributes) {
            const nestId = nestResponse.attributes.id
            const eggsResponse = await panelEggGetAll(nestId, {
              include: 'variables',
              per_page: 100
            })

            for (const eggResponse of eggsResponse.data) {
              if (eggResponse.attributes && eggResponse.attributes.id === eggId) {
                // Found the egg, extract environment variables
                const variables = eggResponse.relationships?.variables?.data?.map((variable: any) => ({
                  name: variable.attributes.env_variable,
                  display_name: variable.attributes.name,
                  description: variable.attributes.description,
                  default_value: variable.attributes.default_value,
                  user_viewable: variable.attributes.user_viewable,
                  user_editable: variable.attributes.user_editable,
                  validation_rules: variable.attributes.rules,
                  field_type: 'text' as const, // Default to text, can be enhanced later
                })) || []

                environmentVariables = variables
                console.log(`Found ${variables.length} environment variables for egg ${eggId}`)
                break
              }
            }

            if (environmentVariables.length > 0) break
          }
        }

        if (environmentVariables.length > 0) {
          updateData.environment_variables = environmentVariables
          console.log('Successfully refreshed environment variables from Pterodactyl')
        } else {
          console.warn(`No environment variables found for egg ${eggId}`)
        }
      } catch (pterodactylError) {
        console.error('Error fetching environment variables from Pterodactyl:', pterodactylError)
        return NextResponse.json(
          {
            success: false,
            message: `Failed to refresh environment variables: ${pterodactylError instanceof Error ? pterodactylError.message : 'Unknown error'}`
          },
          { status: 500 }
        )
      }
    }

    // Handle nested objects with partial updates
    if (validatedData.version_info !== undefined) {
      // Get current software to merge with existing version_info
      const currentSoftware = await serverSoftwareGetById(softwareId)
      if (currentSoftware.success && currentSoftware.data) {
        updateData.version_info = {
          ...currentSoftware.data.version_info,
          ...validatedData.version_info
        }
      } else {
        // If we can't get current data, ensure required fields are present
        if (!validatedData.version_info.version) {
          return NextResponse.json(
            { success: false, message: 'Version is required when updating version_info' },
            { status: 400 }
          )
        }
        updateData.version_info = validatedData.version_info
      }
    }

    if (validatedData.docker_config !== undefined) {
      const currentSoftware = await serverSoftwareGetById(softwareId)
      if (currentSoftware.success && currentSoftware.data) {
        updateData.docker_config = {
          ...currentSoftware.data.docker_config,
          ...validatedData.docker_config
        }
      } else {
        updateData.docker_config = validatedData.docker_config
      }
    }

    if (validatedData.resource_overrides !== undefined) {
      updateData.resource_overrides = validatedData.resource_overrides
    }

    if (validatedData.compatibility !== undefined) {
      const currentSoftware = await serverSoftwareGetById(softwareId)
      if (currentSoftware.success && currentSoftware.data) {
        updateData.compatibility = {
          ...currentSoftware.data.compatibility,
          ...validatedData.compatibility
        }
      } else {
        updateData.compatibility = validatedData.compatibility
      }
    }

    if (validatedData.features !== undefined) {
      const currentSoftware = await serverSoftwareGetById(softwareId)
      if (currentSoftware.success && currentSoftware.data) {
        updateData.features = {
          ...currentSoftware.data.features,
          ...validatedData.features
        }
      } else {
        updateData.features = validatedData.features
      }
    }

    if (validatedData.documentation !== undefined) {
      const currentSoftware = await serverSoftwareGetById(softwareId)
      if (currentSoftware.success && currentSoftware.data) {
        updateData.documentation = {
          ...currentSoftware.data.documentation,
          ...validatedData.documentation
        }
      } else {
        updateData.documentation = validatedData.documentation
      }
    }

    if (validatedData.update_info !== undefined) {
      const currentSoftware = await serverSoftwareGetById(softwareId)
      if (currentSoftware.success && currentSoftware.data) {
        updateData.update_info = {
          ...currentSoftware.data.update_info,
          ...validatedData.update_info
        }
      } else {
        updateData.update_info = validatedData.update_info
      }
    }

    // Update server software in database
    const result = await serverSoftwareUpdate(softwareId, updateData)

    if (!result.success) {
      if (result.message?.includes('not found')) {
        return NextResponse.json(
          { success: false, message: 'Server software not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to update server software' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Server software updated successfully',
      data: result.data
    })

  } catch (error) {
    console.error('Error in PATCH /api/admin/server-software/[id]:', error)
    
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

// DELETE /api/admin/server-software/[id] - Delete server software
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

    const softwareId = params.id

    // Check if server software exists first
    const existsResult = await serverSoftwareGetById(softwareId)
    if (!existsResult.success) {
      return NextResponse.json(
        { success: false, message: 'Server software not found' },
        { status: 404 }
      )
    }

    // TODO: Check if software is being used by any servers
    // This should prevent deletion if there are active servers using this software

    // Delete server software from database
    const result = await serverSoftwareDelete(softwareId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to delete server software' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Server software deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/admin/server-software/[id]:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
