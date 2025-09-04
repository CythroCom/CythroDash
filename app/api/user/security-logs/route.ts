/**
 * CythroDash - User Security Logs API Route
 * 
 * This endpoint handles security log retrieval and management.
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SecurityLogsController, GetUserLogsRequest } from '@/hooks/managers/controller/Security/Logs';
import { SecurityLogAction, SecurityLogSeverity, SecurityLogStatus } from '@/database/tables/cythro_dash_users_logs';
import { z } from 'zod';

// Input validation schema for getting security logs
const getLogsSchema = z.object({
  user_id: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  action: z.nativeEnum(SecurityLogAction).optional(),
  severity: z.nativeEnum(SecurityLogSeverity).optional(),
  status: z.nativeEnum(SecurityLogStatus).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

// Input validation schema for getting security stats
const getStatsSchema = z.object({
  user_id: z.number().int().positive(),
  days: z.number().int().min(1).max(365).optional(),
});

// Input validation schema for getting both logs and stats in parallel
const getBothSchema = z.object({
  user_id: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  action: z.nativeEnum(SecurityLogAction).optional(),
  severity: z.nativeEnum(SecurityLogSeverity).optional(),
  status: z.nativeEnum(SecurityLogStatus).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  days: z.number().int().min(1).max(365).optional(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('Security logs API called');

    // Parse and validate request body
    const body = await request.json();
    const { action, ...requestData } = body;

    if (action === 'get_logs') {
      return await handleGetLogs(requestData);
    } else if (action === 'get_stats') {
      return await handleGetStats(requestData);
    } else if (action === 'get_both') {
      return await handleGetBoth(requestData);
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid action. Use "get_logs", "get_stats", or "get_both"',
          error: 'INVALID_ACTION'
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Security logs API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleGetLogs(requestData: any): Promise<NextResponse> {
  console.log('Getting security logs:', requestData);

  const inputValidation = getLogsSchema.safeParse(requestData);

  if (!inputValidation.success) {
    console.log('Get logs validation failed:', inputValidation.error.errors);
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

  const validatedData = inputValidation.data;

  // Prepare request for controller
  const getLogsRequest: GetUserLogsRequest = {
    user_id: validatedData.user_id,
    limit: validatedData.limit,
    offset: validatedData.offset,
    action: validatedData.action,
    severity: validatedData.severity,
    status: validatedData.status,
    date_from: validatedData.date_from ? new Date(validatedData.date_from) : undefined,
    date_to: validatedData.date_to ? new Date(validatedData.date_to) : undefined,
  };

  console.log('Calling SecurityLogsController.getUserLogs');

  // Get logs using the controller
  const logsResponse = await SecurityLogsController.getUserLogs(getLogsRequest);

  console.log('Security logs controller response:', {
    success: logsResponse.success,
    message: logsResponse.message,
    logCount: logsResponse.logs?.length || 0
  });

  if (!logsResponse.success) {
    return NextResponse.json(
      {
        success: false,
        message: logsResponse.message,
        errors: logsResponse.errors
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: logsResponse.message,
    logs: logsResponse.logs,
    count: logsResponse.logs?.length || 0
  });
}

async function handleGetStats(requestData: any): Promise<NextResponse> {
  console.log('Getting security stats:', requestData);

  const inputValidation = getStatsSchema.safeParse(requestData);

  if (!inputValidation.success) {
    console.log('Get stats validation failed:', inputValidation.error.errors);
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

  const validatedData = inputValidation.data;

  console.log('Calling SecurityLogsController.getUserStats');

  // Get stats using the controller
  const statsResponse = await SecurityLogsController.getUserStats(
    validatedData.user_id,
    validatedData.days || 30
  );

  console.log('Security stats controller response:', {
    success: statsResponse.success,
    message: statsResponse.message,
    hasStats: !!statsResponse.stats
  });

  if (!statsResponse.success) {
    return NextResponse.json(
      {
        success: false,
        message: statsResponse.message,
        errors: statsResponse.errors
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: statsResponse.message,
    stats: statsResponse.stats
  });
}

async function handleGetBoth(requestData: any): Promise<NextResponse> {
  console.log('Getting both security logs and stats:', requestData);

  const inputValidation = getBothSchema.safeParse(requestData);

  if (!inputValidation.success) {
    console.log('Get both validation failed:', inputValidation.error.errors);
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

  const validatedData = inputValidation.data;

  // Prepare requests for both logs and stats
  const getLogsRequest: GetUserLogsRequest = {
    user_id: validatedData.user_id,
    limit: validatedData.limit,
    offset: validatedData.offset,
    action: validatedData.action,
    severity: validatedData.severity,
    status: validatedData.status,
    date_from: validatedData.date_from ? new Date(validatedData.date_from) : undefined,
    date_to: validatedData.date_to ? new Date(validatedData.date_to) : undefined,
  };

  console.log('Calling both SecurityLogsController methods in parallel');

  try {
    // Execute both requests in parallel for maximum speed
    const [logsResponse, statsResponse] = await Promise.all([
      SecurityLogsController.getUserLogs(getLogsRequest),
      SecurityLogsController.getUserStats(validatedData.user_id, validatedData.days || 30)
    ]);

    console.log('Parallel security data response:', {
      logsSuccess: logsResponse.success,
      statsSuccess: statsResponse.success,
      logCount: logsResponse.logs?.length || 0,
      hasStats: !!statsResponse.stats
    });

    return NextResponse.json({
      success: true,
      message: 'Security data retrieved successfully',
      logs: logsResponse.logs || [],
      stats: statsResponse.stats || null,
      logs_success: logsResponse.success,
      stats_success: statsResponse.success,
      logs_message: logsResponse.message,
      stats_message: statsResponse.message
    });

  } catch (error) {
    console.error('Parallel security data fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrieve security data',
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
