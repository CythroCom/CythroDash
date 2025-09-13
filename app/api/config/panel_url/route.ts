import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Import ConfigManager dynamically to handle CommonJS module
    const { getConfig } = require('@/database/config-manager')

    // Get panel_url from config database
    const panelUrl = await getConfig('integrations.pterodactyl.panel_url')

    if (!panelUrl) {
      return NextResponse.json({
        success: false,
        message: 'Panel URL not configured'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      value: panelUrl
    })

  } catch (error) {
    console.error('Error fetching panel URL:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch panel URL'
    }, { status: 500 })
  }
}
