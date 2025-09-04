/**
 * CythroDash - Password Change API Route
 * 
 * This endpoint handles secure password updates with proper validation
 * and database persistence.
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserDetailsController, ChangePasswordRequest } from '@/hooks/managers/controller/User/Details';
import { z } from 'zod';

// Input validation schema for password changes
const changePasswordSchema = z.object({
  user_id: z.number().int().positive(),
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirm_password: z.string().min(1, 'Password confirmation is required')
}).refine((data) => data.new_password === data.confirm_password, {
  message: "New passwords don't match",
  path: ["confirm_password"],
});

export async function POST(request: NextRequest) {
  try {
    console.log('Password change API called');

    // Parse and validate request body
    const body = await request.json();
    console.log('Password change request for user:', body.user_id);

    const inputValidation = changePasswordSchema.safeParse(body);

    if (!inputValidation.success) {
      console.log('Password change validation failed:', inputValidation.error.errors);
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

    const passwordData = inputValidation.data;
    console.log('Password change data validated for user:', passwordData.user_id);

    // Get IP address and user agent from request
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     request.ip ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Prepare password change request for controller
    const changeRequest: ChangePasswordRequest = {
      user_id: passwordData.user_id,
      current_password: passwordData.current_password,
      new_password: passwordData.new_password,
      ip_address: ipAddress,
      user_agent: userAgent
    };

    console.log('Calling UserDetailsController.changePassword');

    // Change password using the controller
    const changeResponse = await UserDetailsController.changePassword(changeRequest);

    console.log('Password change controller response:', {
      success: changeResponse.success,
      message: changeResponse.message,
      hasErrors: !!changeResponse.errors
    });

    if (!changeResponse.success) {
      return NextResponse.json(
        {
          success: false,
          message: changeResponse.message,
          errors: changeResponse.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: changeResponse.message || 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred while changing password',
        error: error instanceof Error ? error.message : 'Unknown error'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
