import { NextRequest, NextResponse } from 'next/server'

function toBool(v: any, def = false) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.toLowerCase() === 'true'
  return def
}

export async function GET(_req: NextRequest) {
  try {
    const { getConfig } = await import('@/database/config-manager.js')

    const discordLogin = toBool(await (getConfig as any)('integrations.discord.login', process.env.DISCORD_LOGIN_ENABLED))
    const discordClientId = await (getConfig as any)('integrations.discord.client_id', process.env.DISCORD_CLIENT_ID)
    const discordEnabled = toBool(await (getConfig as any)('integrations.discord.enabled', process.env.DISCORD_ENABLED))

    const githubLogin = toBool(await (getConfig as any)('integrations.github.login', process.env.GITHUB_LOGIN_ENABLED))
    const githubClientId = await (getConfig as any)('integrations.github.client_id', process.env.GITHUB_CLIENT_ID)
    const githubEnabled = toBool(await (getConfig as any)('integrations.github.enabled', process.env.GITHUB_ENABLED))

    const providers = {
      discord: { enabled: !!discordEnabled && !!discordClientId, login: !!discordLogin && !!discordClientId },
      github: { enabled: !!githubEnabled && !!githubClientId, login: !!githubLogin && !!githubClientId },
    }

    return NextResponse.json({ success: true, providers })
  } catch (e) {
    return NextResponse.json({ success: true, providers: { discord: { enabled: false, login: false }, github: { enabled: false, login: false } } })
  }
}

