/**
 * CythroDash - Referral Click Tracking API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReferralsController, ReferralClickRequest } from '@/hooks/managers/controller/User/Referrals';
import { ReferralLogsController } from '@/hooks/managers/controller/User/ReferralLogs';
import { z } from 'zod';
import { getClientIP } from '../../../../lib/security/config';

// Input validation schema
const referralClickSchema = z.object({
  referral_code: z.string()
    .min(8, 'Referral code must be at least 8 characters')
    .max(20, 'Referral code must be at most 20 characters')
    .regex(/^[A-Z0-9]+$/, 'Referral code can only contain uppercase letters and numbers'),
  device_info: z.object({
    screen_resolution: z.string().optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    platform: z.string().optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    device_type: z.enum(['desktop', 'mobile', 'tablet']).optional()
  }).optional(),
  session_id: z.string().optional()
});

// Rate limiting for referral clicks - improved with multiple time windows
const clickAttempts = new Map<string, {
  minute: { count: number; resetTime: number };
  hour: { count: number; resetTime: number };
}>();

function checkClickRateLimit(ip: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const minuteWindow = 60 * 1000; // 1 minute
  const hourWindow = 60 * 60 * 1000; // 1 hour
  const maxPerMinute = 5; // Max 5 clicks per minute per IP
  const maxPerHour = 30; // Max 30 clicks per hour per IP

  let attempts = clickAttempts.get(ip);

  if (!attempts) {
    attempts = {
      minute: { count: 0, resetTime: now + minuteWindow },
      hour: { count: 0, resetTime: now + hourWindow }
    };
    clickAttempts.set(ip, attempts);
  }

  // Reset minute counter if window has passed
  if (now >= attempts.minute.resetTime) {
    attempts.minute = { count: 0, resetTime: now + minuteWindow };
  }

  // Reset hour counter if window has passed
  if (now >= attempts.hour.resetTime) {
    attempts.hour = { count: 0, resetTime: now + hourWindow };
  }

  // Check limits
  if (attempts.minute.count >= maxPerMinute) {
    return { allowed: false, reason: 'Too many clicks per minute. Please wait.' };
  }

  if (attempts.hour.count >= maxPerHour) {
    return { allowed: false, reason: 'Hourly click limit exceeded. Please try again later.' };
  }

  // Increment counters
  attempts.minute.count++;
  attempts.hour.count++;

  return { allowed: true };
}

function resetClickRateLimit(ip: string): void {
  clickAttempts.delete(ip);
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP
    const ip = getClientIP(request);

    // Check rate limiting
    const rateLimitResult = checkClickRateLimit(ip);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: rateLimitResult.reason || 'Too many referral clicks. Please try again later.',
          error: 'RATE_LIMITED'
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const inputValidation = referralClickSchema.safeParse(body);

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

    const { referral_code, device_info, session_id } = inputValidation.data;

    // Prepare referral click request
    const clickRequest: ReferralClickRequest = {
      referral_code,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') || 'unknown',
      device_info,
      session_id
    };

    // Process the referral click
    const result = await ReferralsController.processReferralClick(clickRequest);

    // Log the click activity
    try {
      await ReferralLogsController.logReferralActivity({
        log_type: 'click' as any,
        referral_code,
        activity_data: {
          click_reward: result.data?.reward_earned || 0,
          blocked: result.data?.blocked || false,
          status: result.data?.status || 'unknown'
        },
        ip_address: ip,
        user_agent: request.headers.get('user-agent') || 'unknown',
        device_info,
        session_id
      });
    } catch (logError) {
      console.warn('Failed to log click activity:', logError);
      // Don't fail the click if logging fails
    }

    if (result.success) {
      // Reset rate limiting on successful click (if not blocked)
      if (result.data && !result.data.blocked) {
        resetClickRateLimit(ip);
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message || 'Failed to process referral click',
          errors: result.errors || []
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Referral click API error:', error);
    
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
    },
  });
}
