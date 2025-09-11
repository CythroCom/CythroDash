/**
 * CythroDash - Environment Variable Manager
 * 
 * Handles reading and writing environment variables to .env file
 * Server-side only utility for admin integration settings
 */

import fs from 'fs'
import path from 'path'

const ENV_FILE_PATH = path.join(process.cwd(), '.env')

export interface IntegrationEnvVars {
  // Discord
  DISCORD_ENABLED?: string
  DISCORD_LOGIN_ENABLED?: string
  DISCORD_CLIENT_ID?: string
  DISCORD_CLIENT_SECRET?: string
  DISCORD_BOT_TOKEN?: string
  DISCORD_REDIRECT_URI?: string
  
  // GitHub
  GITHUB_ENABLED?: string
  GITHUB_LOGIN_ENABLED?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  GITHUB_REDIRECT_URI?: string
  
  // Pterodactyl
  PANEL_URL?: string
  PANEL_API_KEY?: string
}

/**
 * Read current environment variables from .env file
 */
export function readEnvFile(): IntegrationEnvVars {
  try {
    if (!fs.existsSync(ENV_FILE_PATH)) {
      console.warn('.env file not found, returning empty config')
      return {}
    }

    const envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8')
    const envVars: IntegrationEnvVars = {}
    
    // Parse .env file line by line
    const lines = envContent.split('\n')
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '') // Remove quotes
          if (isIntegrationEnvVar(key.trim())) {
            envVars[key.trim() as keyof IntegrationEnvVars] = value
          }
        }
      }
    }
    
    return envVars
  } catch (error) {
    console.error('Error reading .env file:', error)
    return {}
  }
}

/**
 * Update environment variables in .env file
 */
export function updateEnvFile(updates: Partial<IntegrationEnvVars>): boolean {
  try {
    let envContent = ''
    
    // Read existing .env file if it exists
    if (fs.existsSync(ENV_FILE_PATH)) {
      envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8')
    }
    
    // Parse existing content
    const lines = envContent.split('\n')
    const existingVars = new Map<string, string>()
    const nonIntegrationLines: string[] = []

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Check if this is an integration section header
      if (trimmedLine === '# Integration Settings' ||
          trimmedLine === '# Discord Integration' ||
          trimmedLine === '# GitHub Integration' ||
          trimmedLine === '# Pterodactyl Integration') {
        // Skip integration headers - we'll regenerate them
        continue
      }

      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          const cleanKey = key.trim()
          if (isIntegrationEnvVar(cleanKey)) {
            existingVars.set(cleanKey, valueParts.join('='))
          } else {
            nonIntegrationLines.push(line)
          }
        } else {
          nonIntegrationLines.push(line)
        }
      } else if (!trimmedLine.startsWith('# Integration') && !trimmedLine.startsWith('# Discord') &&
                 !trimmedLine.startsWith('# GitHub') && !trimmedLine.startsWith('# Pterodactyl')) {
        // Keep non-integration comments and empty lines
        nonIntegrationLines.push(line)
      }
    }
    
    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && isIntegrationEnvVar(key)) {
        existingVars.set(key, value)
      }
    }
    
    // Rebuild .env content
    const newLines = [...nonIntegrationLines]
    
    // Add integration variables section
    if (existingVars.size > 0) {
      newLines.push('')
      newLines.push('# Integration Settings')
      
      // Group by service
      const discordVars = Array.from(existingVars.entries()).filter(([key]) => key.startsWith('DISCORD_'))
      const githubVars = Array.from(existingVars.entries()).filter(([key]) => key.startsWith('GITHUB_'))
      const pterodactylVars = Array.from(existingVars.entries()).filter(([key]) => key.startsWith('PTERODACTYL_'))
      
      if (discordVars.length > 0) {
        newLines.push('# Discord Integration')
        for (const [key, value] of discordVars) {
          newLines.push(`${key}=${value}`)
        }
      }
      
      if (githubVars.length > 0) {
        newLines.push('# GitHub Integration')
        for (const [key, value] of githubVars) {
          newLines.push(`${key}=${value}`)
        }
      }
      
      if (pterodactylVars.length > 0) {
        newLines.push('# Pterodactyl Integration')
        for (const [key, value] of pterodactylVars) {
          newLines.push(`${key}=${value}`)
        }
      }
    }
    
    // Write back to file
    const newContent = newLines.join('\n')
    fs.writeFileSync(ENV_FILE_PATH, newContent, 'utf8')
    
    console.log('Successfully updated .env file with integration settings')
    return true
  } catch (error) {
    console.error('Error updating .env file:', error)
    return false
  }
}

/**
 * Check if a key is an integration environment variable
 */
function isIntegrationEnvVar(key: string): key is keyof IntegrationEnvVars {
  const integrationKeys = [
    'DISCORD_ENABLED',
    'DISCORD_LOGIN_ENABLED', 
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_BOT_TOKEN',
    'DISCORD_REDIRECT_URI',
    'GITHUB_ENABLED',
    'GITHUB_LOGIN_ENABLED',
    'GITHUB_CLIENT_ID', 
    'GITHUB_CLIENT_SECRET',
    'GITHUB_REDIRECT_URI',
    'PTERODACTYL_PANEL_URL',
    'PTERODACTYL_API_KEY'
  ]
  return integrationKeys.includes(key)
}

/**
 * Get current integration settings from both .env file and process.env
 */
export function getCurrentIntegrationSettings() {
  const fileVars = readEnvFile()
  
  return {
    discord: {
      enabled: (fileVars.DISCORD_ENABLED || process.env.DISCORD_ENABLED || 'false') === 'true',
      login: (fileVars.DISCORD_LOGIN_ENABLED || process.env.DISCORD_LOGIN_ENABLED || 'false') === 'true',
      clientId: fileVars.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || '',
      clientSecret: fileVars.DISCORD_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || '',
      botToken: fileVars.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || '',
      redirectUri: fileVars.DISCORD_REDIRECT_URI || process.env.DISCORD_REDIRECT_URI || ''
    },
    github: {
      enabled: (fileVars.GITHUB_ENABLED || process.env.GITHUB_ENABLED || 'false') === 'true',
      login: (fileVars.GITHUB_LOGIN_ENABLED || process.env.GITHUB_LOGIN_ENABLED || 'false') === 'true',
      clientId: fileVars.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '',
      clientSecret: fileVars.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '',
      redirectUri: fileVars.GITHUB_REDIRECT_URI || process.env.GITHUB_REDIRECT_URI || ''
    },
    pterodactyl: {
      panelUrl: fileVars.PANEL_URL || process.env.PANEL_URL || '',
      apiKey: fileVars.PANEL_API_KEY || process.env.PANEL_API_KEY || ''
    }
  }
}
