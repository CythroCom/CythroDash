import { NextRequest, NextResponse } from 'next/server'
import { panelEggGetAll } from '@/hooks/managers/pterodactyl/eggs'

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

// GET /api/admin/pterodactyl/nests/[nestId]/eggs - Get all eggs for a specific nest
export async function GET(
  request: NextRequest,
  { params }: { params: { nestId: string } }
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

    // Validate nest ID
    const nestId = parseInt(params.nestId)
    if (isNaN(nestId) || nestId < 1) {
      return NextResponse.json(
        { success: false, message: 'Invalid nest ID provided' },
        { status: 400 }
      )
    }

    // Fetch eggs from Pterodactyl panel for the specific nest
    const eggsResponse = await panelEggGetAll(nestId, {
      per_page: 100,
      include: 'variables'
    })

    // Transform the response to match our expected format
    const eggs = eggsResponse.data.map(egg => {
      const eggData = egg.attributes!
      
      // Extract environment variables if included
      const environmentVariables = egg.relationships?.variables?.data?.map((variable: any) => ({
        name: variable.attributes.env_variable,
        display_name: variable.attributes.name,
        description: variable.attributes.description,
        default_value: variable.attributes.default_value,
        user_viewable: variable.attributes.user_viewable,
        user_editable: variable.attributes.user_editable,
        validation_rules: variable.attributes.rules,
        field_type: 'text' as const, // Default to text, can be enhanced later
      })) || []

      return {
        id: eggData.id,
        name: eggData.name,
        description: eggData.description,
        uuid: eggData.uuid,
        nest: eggData.nest,
        author: eggData.author,
        docker_image: eggData.docker_image,
        docker_images: eggData.docker_images,
        startup: eggData.startup,
        script: eggData.script,
        config: eggData.config,
        environment_variables: environmentVariables,
        created_at: eggData.created_at,
        updated_at: eggData.updated_at
      }
    })

    return NextResponse.json({
      success: true,
      data: eggs,
      message: `Found ${eggs.length} eggs for nest ${nestId}`
    })

  } catch (error) {
    console.error('Error in GET /api/admin/pterodactyl/nests/[nestId]/eggs:', error)
    
    // Handle Pterodactyl-specific errors
    if (error instanceof Error) {
      if (error.message.includes('Missing Pterodactyl configuration')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Pterodactyl panel configuration is missing. Please check your environment variables.' 
          },
          { status: 500 }
        )
      }
      
      if (error.message.includes('HTTP 401') || error.message.includes('HTTP 403')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Invalid Pterodactyl API credentials. Please check your API key.' 
          },
          { status: 500 }
        )
      }
      
      if (error.message.includes('HTTP 404')) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Nest ${params.nestId} not found in Pterodactyl panel.` 
          },
          { status: 404 }
        )
      }
      
      if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Unable to connect to Pterodactyl panel. Please check your panel URL and network connectivity.' 
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        message: `Failed to fetch eggs for nest ${params.nestId}. Please check your Pterodactyl panel configuration.` 
      },
      { status: 500 }
    )
  }
}
