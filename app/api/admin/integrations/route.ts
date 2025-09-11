/**
 * CythroDash - Admin Integration Settings API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getCurrentIntegrationSettings, updateEnvFile, type IntegrationEnvVars } from '@/lib/env-manager';



export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (!authResult.success) {
      return authResult.response!;
    }

    // Prefer DB-stored integration settings with env fallback
    const { getConfig } = await import('@/database/config-manager.js')
    const fallback = getCurrentIntegrationSettings();

    const integrationSettings = {
      discord: {
        enabled: (await (getConfig as any)('integrations.discord.enabled', String(fallback.discord.enabled))) === 'true',
        login: (await (getConfig as any)('integrations.discord.login', String(fallback.discord.login))) === 'true',
        clientId: await (getConfig as any)('integrations.discord.client_id', fallback.discord.clientId),
        clientSecret: await (getConfig as any)('integrations.discord.client_secret', fallback.discord.clientSecret),
        botToken: await (getConfig as any)('integrations.discord.bot_token', fallback.discord.botToken),
        redirectUri: await (getConfig as any)('integrations.discord.redirect_uri', fallback.discord.redirectUri)
      },
      github: {
        enabled: (await (getConfig as any)('integrations.github.enabled', String(fallback.github.enabled))) === 'true',
        login: (await (getConfig as any)('integrations.github.login', String(fallback.github.login))) === 'true',
        clientId: await (getConfig as any)('integrations.github.client_id', fallback.github.clientId),
        clientSecret: await (getConfig as any)('integrations.github.client_secret', fallback.github.clientSecret),
        redirectUri: await (getConfig as any)('integrations.github.redirect_uri', fallback.github.redirectUri)
      },
      pterodactyl: {
        panelUrl: await (getConfig as any)('integrations.pterodactyl.panel_url', fallback.pterodactyl.panelUrl),
        apiKey: await (getConfig as any)('integrations.pterodactyl.api_key', fallback.pterodactyl.apiKey),
      }
    }

    console.log(`[ADMIN] Integration settings requested by admin ${authResult.user.username}`);

    return NextResponse.json({
      success: true,
      data: integrationSettings
    });

  } catch (error) {
    console.error('Integration settings GET error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch integration settings',
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (!authResult.success) {
      return authResult.response!;
    }

    const body = await request.json();
    const { service, key, value } = body;

    // Validate input
    if (!service || !key || value === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: service, key, value',
          error: 'INVALID_INPUT'
        },
        { status: 400 }
      );
    }

    // Map service and key to environment variable name
    const envKeyMap: Record<string, Record<string, keyof IntegrationEnvVars>> = {
      discord: {
        enabled: 'DISCORD_ENABLED',
        login: 'DISCORD_LOGIN_ENABLED',
        clientId: 'DISCORD_CLIENT_ID',
        clientSecret: 'DISCORD_CLIENT_SECRET',
        botToken: 'DISCORD_BOT_TOKEN',
        redirectUri: 'DISCORD_REDIRECT_URI'
      },
      github: {
        enabled: 'GITHUB_ENABLED',
        login: 'GITHUB_LOGIN_ENABLED',
        clientId: 'GITHUB_CLIENT_ID',
        clientSecret: 'GITHUB_CLIENT_SECRET',
        redirectUri: 'GITHUB_REDIRECT_URI'
      },
      pterodactyl: {
        panelUrl: 'PANEL_URL',
        apiKey: 'PANEL_API_KEY'
      }
    };

    // Validate service
    if (!envKeyMap[service]) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid service specified',
          error: 'INVALID_SERVICE'
        },
        { status: 400 }
      );
    }

    // Validate key for service
    if (!envKeyMap[service][key]) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid key for specified service',
          error: 'INVALID_KEY'
        },
        { status: 400 }
      );
    }

    const envKey = envKeyMap[service][key];

    // Validate value based on key type
    if (key === 'enabled' || key === 'login') {
      if (typeof value !== 'boolean') {
        return NextResponse.json(
          {
            success: false,
            message: 'Boolean value required for toggle settings',
            error: 'INVALID_VALUE_TYPE'
          },
          { status: 400 }
        );
      }
    } else if (typeof value !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'String value required for text settings',
          error: 'INVALID_VALUE_TYPE'
        },
        { status: 400 }
      );
    }

    // Sanitize string values
    const sanitizedValue = typeof value === 'string' ? value.trim() : value;

    // Convert boolean values to string for environment variables
    const envValue = typeof sanitizedValue === 'boolean' ? sanitizedValue.toString() : sanitizedValue;

    // Persist to database-driven config (primary)
    const { setConfig } = await import('@/database/config-manager.js')
    const dotKeyMap: Record<string, Record<string, string>> = {
      discord: {
        enabled: 'integrations.discord.enabled',
        login: 'integrations.discord.login',
        clientId: 'integrations.discord.client_id',
        clientSecret: 'integrations.discord.client_secret',
        botToken: 'integrations.discord.bot_token',
        redirectUri: 'integrations.discord.redirect_uri'
      },
      github: {
        enabled: 'integrations.github.enabled',
        login: 'integrations.github.login',
        clientId: 'integrations.github.client_id',
        clientSecret: 'integrations.github.client_secret',
        redirectUri: 'integrations.github.redirect_uri'
      },
      pterodactyl: {
        panelUrl: 'integrations.pterodactyl.panel_url',
        apiKey: 'integrations.pterodactyl.api_key'
      }
    }

    const dottedKey = dotKeyMap[service][key]
    const isSecret = ['clientSecret', 'botToken', 'apiKey'].includes(key)
    await setConfig(dottedKey, envValue, { category: 'integrations', secret: isSecret, updated_by_admin_id: authResult.user?.id ?? 0 })

    // Update in-process environment for immediate effect (no restart)
    try {
      process.env[String(envKey)] = String(envValue ?? '')
    } catch {}

    // Best-effort .env update for backward compatibility
    try {
      const updateData: Partial<IntegrationEnvVars> = { [envKey]: envValue }
      updateEnvFile(updateData)
    } catch (e) {
      console.warn('Warning: .env update failed; DB config updated successfully.', e)
    }

    // Log the change for audit purposes (mask sensitive values in logs)
    const logValue = (key.includes('secret') || key.includes('token') || key.includes('key')) && typeof sanitizedValue === 'string'
      ? '••••••••'
      : sanitizedValue;
    console.log(`[ADMIN] Integration setting updated: ${dottedKey} = ${logValue} by admin ${authResult.user.username}`);

    return NextResponse.json({
      success: true,
      message: 'Integration setting updated successfully'
    });

  } catch (error) {
    console.error('Integration settings PATCH error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update integration setting',
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
