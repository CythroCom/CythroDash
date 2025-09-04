/**
 * CythroDash - User Preferences API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';
import { UserDetailsController, UpdateUserProfileRequest } from '@/hooks/managers/controller/User/Details';
import { UserTheme, UserLanguage } from '@/database/tables/cythro_dash_users';
import { z } from 'zod';

// Input validation schema
const preferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'midnight', 'ocean', 'forest', 'sunset', 'purple', 'cyberpunk']).optional(),
  language: z.enum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko']).optional(),
  timezone: z.string().optional(),
  email_notifications: z.boolean().optional(),
  push_notifications: z.boolean().optional(),
});

// Map our extended themes to database themes
const mapThemeToDatabase = (theme: string): UserTheme => {
  switch (theme) {
    case 'light':
      return UserTheme.LIGHT;
    case 'dark':
    case 'midnight':
    case 'ocean':
    case 'forest':
    case 'sunset':
    case 'purple':
    case 'cyberpunk':
    default:
      return UserTheme.DARK;
  }
};

// Map language strings to database enums
const mapLanguageToDatabase = (language: string): UserLanguage => {
  switch (language) {
    case 'en': return UserLanguage.EN;
    case 'es': return UserLanguage.ES;
    case 'fr': return UserLanguage.FR;
    case 'de': return UserLanguage.DE;
    case 'it': return UserLanguage.IT;
    case 'pt': return UserLanguage.PT;
    case 'ru': return UserLanguage.RU;
    case 'zh': return UserLanguage.ZH;
    case 'ja': return UserLanguage.JA;
    case 'ko': return UserLanguage.KO;
    default: return UserLanguage.EN;
  }
};

export async function PATCH(request: NextRequest) {
  try {
    console.log('Preferences update API called');

    // Parse and validate request body
    const body = await request.json();
    console.log('Preferences request body:', body);

    // Add user_id validation to the schema
    const preferencesWithUserSchema = preferencesSchema.extend({
      user_id: z.number().int().positive()
    });

    const inputValidation = preferencesWithUserSchema.safeParse(body);

    if (!inputValidation.success) {
      console.log('Preferences validation failed:', inputValidation.error.errors);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid input data',
          errors: inputValidation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }

    const preferences = inputValidation.data;
    console.log('Validated preferences:', preferences);

    // Prepare update request for controller
    const updateRequest: UpdateUserProfileRequest = {
      user_id: preferences.user_id,
      theme: preferences.theme ? mapThemeToDatabase(preferences.theme) : undefined,
      language: preferences.language ? mapLanguageToDatabase(preferences.language) : undefined,
      timezone: preferences.timezone,
      email_notifications: preferences.email_notifications,
      notifications_enabled: preferences.push_notifications
    };

    console.log('Calling UserDetailsController.updateUserProfile for preferences:', updateRequest);

    // Update user preferences using the controller
    const updateResponse = await UserDetailsController.updateUserProfile(updateRequest);

    console.log('Preferences controller response:', updateResponse);

    if (!updateResponse.success) {
      return NextResponse.json(
        {
          success: false,
          message: updateResponse.message,
          errors: updateResponse.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: updateResponse.message,
      preferences: {
        theme: updateResponse.user?.theme,
        language: updateResponse.user?.language,
        timezone: updateResponse.user?.timezone,
        email_notifications: updateResponse.user?.email_notifications,
        push_notifications: updateResponse.user?.notifications_enabled
      },
      user: updateResponse.user
    });

  } catch (error) {
    console.error('User preferences API error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred while updating preferences',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return authResult.response!;
    }

    const user = authResult.user;

    // TODO: Fetch user preferences from database
    // For now, we'll return default preferences
    const preferences = {
      theme: user.theme || 'dark',
      language: user.language || 'en',
      timezone: 'UTC',
      email_notifications: true,
      push_notifications: true,
    };

    return NextResponse.json({
      success: true,
      preferences
    });

  } catch (error) {
    console.error('User preferences API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred',
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
