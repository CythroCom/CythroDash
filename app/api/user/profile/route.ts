/**
 * CythroDash - User Profile API Route
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

// Input validation schema for profile updates
const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  timezone: z.string().optional(),
  theme: z.enum(['dark', 'light', 'midnight', 'ocean', 'forest', 'sunset', 'purple', 'cyberpunk']).optional(),
  language: z.enum(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']).optional(),
  notifications_enabled: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  social_links: z.object({
    twitter: z.string().max(100).optional().or(z.literal('')),
    discord: z.string().max(100).optional().or(z.literal('')),
    github: z.string().max(100).optional().or(z.literal('')),
  }).optional(),
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

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return authResult.response!;
    }

    const user = authResult.user;

    // Get user details using the controller
    const userDetailsResponse = await UserDetailsController.getUserDetails({
      user_id: user.id,
      include_servers: false,
      include_activity: false,
      include_stats: false
    });

    if (!userDetailsResponse.success) {
      return NextResponse.json(
        {
          success: false,
          message: userDetailsResponse.message,
          errors: userDetailsResponse.errors
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: userDetailsResponse.user
    });

  } catch (error) {
    console.error('User profile API error:', error);
    
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

export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return authResult.response!;
    }

    const user = authResult.user;

    // Parse and validate request body
    const body = await request.json();
    const inputValidation = updateProfileSchema.safeParse(body);

    if (!inputValidation.success) {
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

    const updateData = inputValidation.data;

    // Prepare update request for controller
    const updateRequest: UpdateUserProfileRequest = {
      user_id: user.id,
      email: updateData.email,
      first_name: updateData.first_name,
      last_name: updateData.last_name,
      display_name: updateData.display_name,
      bio: updateData.bio,
      website: updateData.website,
      timezone: updateData.timezone,
      theme: updateData.theme ? mapThemeToDatabase(updateData.theme) : undefined,
      language: updateData.language ? mapLanguageToDatabase(updateData.language) : undefined,
      notifications_enabled: updateData.notifications_enabled,
      email_notifications: updateData.email_notifications,
      social_links: updateData.social_links
    };

    // Update user profile using the controller
    const updateResponse = await UserDetailsController.updateUserProfile(updateRequest);

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
      user: updateResponse.user
    });

  } catch (error) {
    console.error('User profile update API error:', error);
    
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
