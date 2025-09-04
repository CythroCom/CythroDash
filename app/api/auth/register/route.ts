/**
 * CythroDash - Register API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RegisterController } from '@/hooks/managers/controller/Auth/Register';
import { z } from 'zod';
import { SECURITY_CONFIG, getSessionCookieOptions, getClientIP, validatePassword } from '../../../../lib/security/config';
import { getPublicFlag } from '@/lib/public-settings'

// Input validation schema
const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be at most 255 characters'),
  first_name: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be at most 50 characters'),
  last_name: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be at most 50 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  password_confirmation: z.string(),
  referral_code: z.string()
    .min(8, 'Referral code must be at least 8 characters')
    .max(20, 'Referral code must be at most 20 characters')
    .regex(/^[A-Z0-9]+$/, 'Referral code can only contain uppercase letters and numbers')
    .optional()
}).refine((data) => data.password === data.password_confirmation, {
  message: "Passwords don't match",
  path: ["password_confirmation"],
});

// Rate limiting for registration - improved with multiple time windows
const registrationAttempts = new Map<string, {
  minute: { count: number; resetTime: number };
  hour: { count: number; resetTime: number };
  day: { count: number; resetTime: number };
}>();

function checkRegistrationRateLimit(ip: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const minuteWindow = 60 * 1000; // 1 minute
  const hourWindow = 60 * 60 * 1000; // 1 hour
  const dayWindow = 24 * 60 * 60 * 1000; // 24 hours
  const maxPerMinute = 2; // Max 2 registrations per minute per IP
  const maxPerHour = 5; // Max 5 registrations per hour per IP
  const maxPerDay = 10; // Max 10 registrations per day per IP

  let attempts = registrationAttempts.get(ip);

  if (!attempts) {
    attempts = {
      minute: { count: 0, resetTime: now + minuteWindow },
      hour: { count: 0, resetTime: now + hourWindow },
      day: { count: 0, resetTime: now + dayWindow }
    };
    registrationAttempts.set(ip, attempts);
  }

  // Reset counters if windows have passed
  if (now >= attempts.minute.resetTime) {
    attempts.minute = { count: 0, resetTime: now + minuteWindow };
  }
  if (now >= attempts.hour.resetTime) {
    attempts.hour = { count: 0, resetTime: now + hourWindow };
  }
  if (now >= attempts.day.resetTime) {
    attempts.day = { count: 0, resetTime: now + dayWindow };
  }

  // Check limits
  if (attempts.minute.count >= maxPerMinute) {
    return { allowed: false, reason: 'Too many registration attempts per minute. Please wait.' };
  }
  if (attempts.hour.count >= maxPerHour) {
    return { allowed: false, reason: 'Hourly registration limit exceeded. Please try again later.' };
  }
  if (attempts.day.count >= maxPerDay) {
    return { allowed: false, reason: 'Daily registration limit exceeded. Please try again tomorrow.' };
  }

  // Increment counters
  attempts.minute.count++;
  attempts.hour.count++;
  attempts.day.count++;

  return { allowed: true };
}

function resetRegistrationRateLimit(ip: string): void {
  registrationAttempts.delete(ip);
}
export async function POST(request: NextRequest) {
  try {
    // Maintenance mode: block new registrations
    const maintenance = await getPublicFlag('NEXT_PUBLIC_MAINTENANCE_MODE', process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true')
    if (maintenance) {
      return NextResponse.json({ success: false, message: 'Maintenance mode enabled' }, { status: 503 })
    }

    // Feature gate: account creation
    const registrationEnabled = await getPublicFlag('NEXT_PUBLIC_ACCOUNT_CREATION', process.env.NEXT_PUBLIC_ACCOUNT_CREATION === 'true')
    if (!registrationEnabled) {
      return NextResponse.json({ success: false, message: 'Registration is disabled' }, { status: 403 })
    }
    // Get client IP
    const ip = getClientIP(request);

    // Check rate limiting
    const rateLimitResult = checkRegistrationRateLimit(ip);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: rateLimitResult.reason || 'Too many registration attempts. Please try again later.',
          error: 'RATE_LIMITED'
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const inputValidation = registerSchema.safeParse(body);

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

    const { username, email, first_name, last_name, password, referral_code } = inputValidation.data;

    // Prepare registration request
    const registerRequest = {
      username,
      email,
      first_name,
      last_name,
      password,
      confirm_password: password, // Since we already validated they match
      terms_accepted: true, // Assume accepted for now
      privacy_accepted: true, // Assume accepted for now
      referral_code,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') || 'unknown'
    };

    // Attempt registration
    const registerResult = await RegisterController.registerUser(registerRequest);

    if (registerResult.success && registerResult.user) {
      // Reset rate limiting on successful registration
      resetRegistrationRateLimit(ip);

      // Return success response without automatic login
      return NextResponse.json({
        success: true,
        message: registerResult.user.verification_required
          ? 'Registration successful! Please check your email to verify your account.'
          : 'Registration successful! You can now log in.',
        user: {
          id: registerResult.user.id,
          username: registerResult.user.username,
          email: registerResult.user.email,
          verified: registerResult.user.verified,
          verification_required: registerResult.user.verification_required
        }
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: registerResult.message || 'Registration failed',
          errors: registerResult.errors || []
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Registration API error:', error);

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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...SECURITY_CONFIG.HEADERS
    },
  });
}
