import { NextRequest, NextResponse } from 'next/server'
import { panelNestGetAll } from '@/hooks/managers/pterodactyl/nests'

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

// GET /api/admin/pterodactyl/nests - Get all Pterodactyl nests
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

    // Fetch nests from Pterodactyl panel
    const nestsResponse = await panelNestGetAll({ per_page: 100 })

    // Transform the response to match our expected format
    const nests = nestsResponse.data.map(nest => ({
      id: nest.attributes!.id,
      name: nest.attributes!.name,
      description: nest.attributes!.description || `${nest.attributes!.name} servers`,
      uuid: nest.attributes!.uuid,
      author: nest.attributes!.author,
      created_at: nest.attributes!.created_at,
      updated_at: nest.attributes!.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: nests,
      message: `Found ${nests.length} Pterodactyl nests`
    })

  } catch (error) {
    console.error('Error in GET /api/admin/pterodactyl/nests:', error)
    
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
            message: 'Pterodactyl panel API endpoint not found. Please check your panel URL.' 
          },
          { status: 500 }
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
        message: 'Failed to fetch Pterodactyl nests. Please check your Pterodactyl panel configuration.' 
      },
      { status: 500 }
    )
  }
}
