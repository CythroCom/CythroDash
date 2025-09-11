/**
 * CythroDash - Server Plans API Route
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { planOperations } from '@/hooks/managers/database/plan';
import { locationOperations } from '@/hooks/managers/database/location';
import { PlanStatus, BillingCycle } from '@/database/tables/cythro_dash_plans';
import { z } from 'zod';
import { getCache, setCache, makeKey, shouldBypassCache, makeETagFromObject } from '@/lib/ttlCache';

// Input validation schema for GET request
const getServerPlansSchema = z.object({
  location_id: z.string().min(1, 'Location ID is required'),
  server_type_id: z.string().optional(),
  billing_cycle: z.nativeEnum(BillingCycle).optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  featured: z.coerce.boolean().optional(),
  popular: z.coerce.boolean().optional(),
  include_stats: z.coerce.boolean().optional(),
  sort_by: z.enum(['price', 'name', 'display_order', 'memory', 'disk']).optional().default('display_order'),
  sort_order: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Authentication function following the established pattern
async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    // Get session token from cookies or Authorization header
    const authHeader = request.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '') ||
                        request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return {
        success: false,
        error: 'No session token found'
      };
    }

    // Validate session token format (should be hex string)
    const hexTokenRegex = /^[a-f0-9]{64}$/i; // 32 bytes = 64 hex characters
    if (!hexTokenRegex.test(sessionToken)) {
      return {
        success: false,
        error: 'Invalid session token format'
      };
    }

    // Get user information from request headers (sent by client)
    const userDataHeader = request.headers.get('x-user-data');
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader));

        if (userData && userData.id && userData.username && userData.email) {
          return {
            success: true,
            user: userData
          };
        }
      } catch (parseError) {
        console.log('User data header parsing failed:', parseError);
      }
    }

    return {
      success: false,
      error: 'User identification required'
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

// Rate limiting check (simple implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientIP);

  if (!clientData || now > clientData.resetTime) {
    // Reset or initialize rate limit
    rateLimitMap.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetTime: now + RATE_LIMIT_WINDOW
    };
  }

  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: clientData.resetTime
    };
  }

  clientData.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - clientData.count,
    resetTime: clientData.resetTime
  };
}

// Calculate effective price with promotions
function calculateEffectivePrice(plan: any): { original_price: number; effective_price: number; discount?: { type: string; amount: number } } {
  const originalPrice = plan.price;
  let effectivePrice = originalPrice;
  let discount = null;

  if (plan.promotion) {
    const now = new Date();
    const validUntil = plan.promotion.valid_until ? new Date(plan.promotion.valid_until) : null;
    
    // Check if promotion is still valid
    if (!validUntil || now <= validUntil) {
      if (plan.promotion.discount_percentage && plan.promotion.discount_percentage > 0) {
        const discountAmount = (originalPrice * plan.promotion.discount_percentage) / 100;
        effectivePrice = Math.max(0, originalPrice - discountAmount);
        discount = {
          type: 'percentage',
          amount: plan.promotion.discount_percentage
        };
      } else if (plan.promotion.discount_amount && plan.promotion.discount_amount > 0) {
        effectivePrice = Math.max(0, originalPrice - plan.promotion.discount_amount);
        discount = {
          type: 'fixed',
          amount: plan.promotion.discount_amount
        };
      }
    }
  }

  return {
    original_price: originalPrice,
    effective_price: effectivePrice,
    ...(discount && { discount })
  };
}

/**
 * GET /api/servers/plans
 * Retrieve available plans for a specific location with pricing and user-specific availability
 */
export async function GET(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.',
        error: 'RATE_LIMIT_EXCEEDED'
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
        }
      });
    }

    // Apply authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        success: false,
        message: 'Authentication required to access server plans'
      }, { status: 401 });
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const validation = getServerPlansSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        message: 'Invalid query parameters',
        errors: validation.error.errors
      }, { status: 400 });
    }

    const filters = validation.data;
    const user = authResult.user;

    // Cache lookup (per-user + filters)
    const t0 = Date.now();
    const bypass = shouldBypassCache(request.url);
    const cacheKey = makeKey(['plans', user.id, filters.location_id, filters.server_type_id || '', filters.billing_cycle || '', filters.min_price ?? '', filters.max_price ?? '', filters.featured ?? '', filters.popular ?? '', filters.include_stats ?? false, filters.sort_by, filters.sort_order]);
    if (!bypass) {
      const cached = getCache<any>(cacheKey);
      const ifNoneMatch = request.headers.get('if-none-match') || '';
      if (cached.hit && cached.value) {
        const etag = cached.etag || makeETagFromObject(cached.value);
        if (etag && ifNoneMatch && ifNoneMatch === etag) {
          return new NextResponse(null, { status: 304, headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } });
        }
        return NextResponse.json(cached.value, { status: 200, headers: { ETag: etag, 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now()-t0}ms` } });
      }
    }

    // Validate that the location exists and is available
    const location = await locationOperations.getLocationById(filters.location_id);
    if (!location) {
      return NextResponse.json({
        success: false,
        message: 'Location not found or not available'
      }, { status: 404 });
    }

    // Get plans available for this location
    const plans = await planOperations.getPlansForLocation(filters.location_id);
    
    // Filter plans based on additional criteria
    let filteredPlans = plans.filter(plan => plan.status === PlanStatus.ACTIVE);

    // Apply filters
    if (filters.billing_cycle) {
      filteredPlans = filteredPlans.filter(plan => plan.billing_cycle === filters.billing_cycle);
    }

    if (filters.featured !== undefined) {
      filteredPlans = filteredPlans.filter(plan => plan.featured === filters.featured);
    }

    if (filters.popular !== undefined) {
      filteredPlans = filteredPlans.filter(plan => plan.popular === filters.popular);
    }

    // Apply price range filters (after calculating effective prices)
    if (filters.min_price !== undefined || filters.max_price !== undefined) {
      filteredPlans = filteredPlans.filter(plan => {
        const pricing = calculateEffectivePrice(plan);
        const price = pricing.effective_price;
        
        if (filters.min_price !== undefined && price < filters.min_price) return false;
        if (filters.max_price !== undefined && price > filters.max_price) return false;
        
        return true;
      });
    }

    // Transform plans for API response
    const transformedPlans = filteredPlans.map(plan => {
      const pricing = calculateEffectivePrice(plan);
      
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        tagline: plan.tagline,
        
        // Pricing information
        ...pricing,
        billing_cycle: plan.billing_cycle,
        setup_fee: plan.setup_fee || 0,
        
        // Resources
        resources: plan.resources,
        
        // Features and restrictions
        features: plan.features,
        restrictions: plan.restrictions,
        quotas: plan.quotas,
        
        // Display properties
        popular: plan.popular,
        featured: plan.featured,
        premium: plan.premium,
        display_order: plan.display_order,
        color_scheme: plan.color_scheme,
        
        // Promotion info (if active)
        ...(pricing.discount && {
          promotion: {
            ...plan.promotion,
            active: true
          }
        }),
        
        // Statistics (if available)
        ...(plan.stats && filters.include_stats && {
          stats: plan.stats
        }),
        
        // Metadata
        created_at: plan.created_at,
        updated_at: plan.updated_at
      };
    });

    // Sort plans based on sort criteria
    const sortedPlans = transformedPlans.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sort_by) {
        case 'price':
          comparison = a.effective_price - b.effective_price;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'display_order':
          comparison = a.display_order - b.display_order;
          break;
        case 'memory':
          comparison = a.resources.memory - b.resources.memory;
          break;
        case 'disk':
          comparison = a.resources.disk - b.resources.disk;
          break;
        default:
          comparison = a.display_order - b.display_order;
      }
      
      return filters.sort_order === 'desc' ? -comparison : comparison;
    });

    // Get statistics if requested
    let stats = null;
    if (filters.include_stats) {
      stats = {
        total_plans: sortedPlans.length,
        featured_plans: sortedPlans.filter(p => p.featured).length,
        popular_plans: sortedPlans.filter(p => p.popular).length,
        premium_plans: sortedPlans.filter(p => p.premium).length,
        plans_with_promotions: sortedPlans.filter(p => p.discount).length,
        price_range: {
          min: Math.min(...sortedPlans.map(p => p.effective_price)),
          max: Math.max(...sortedPlans.map(p => p.effective_price)),
          average: sortedPlans.reduce((acc, p) => acc + p.effective_price, 0) / sortedPlans.length
        },
        billing_cycles: {
          hourly: sortedPlans.filter(p => p.billing_cycle === BillingCycle.HOURLY).length,
          daily: sortedPlans.filter(p => p.billing_cycle === BillingCycle.DAILY).length,
          weekly: sortedPlans.filter(p => p.billing_cycle === BillingCycle.WEEKLY).length,
          monthly: sortedPlans.filter(p => p.billing_cycle === BillingCycle.MONTHLY).length
        }
      };
    }

    // Set rate limit headers
    const responseHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString()
    };

    const payload = {
      success: true,
      message: 'Server plans retrieved successfully',
      location: {
        id: location.id,
        name: location.name,
        country: location.country,
        region: location.region
      },
      plans: sortedPlans,
      stats: stats,
      user_permissions: {
        can_create_servers: user.role <= 1, // Users and admins can create servers
        max_servers: user.max_servers || null,
        requires_verification: !user.verified,
        current_balance: user.coins || 0
      }
    };

    const etag = makeETagFromObject(payload);
    if (!bypass) setCache(cacheKey, payload, 60_000, { ...responseHeaders, ETag: etag }, etag);

    return NextResponse.json(payload, {
      status: 200,
      headers: { ...responseHeaders, ETag: etag, 'X-Cache': bypass ? 'BYPASS' : 'MISS', 'X-Response-Time': `${Date.now()-t0}ms` }
    });

  } catch (error) {
    console.error('GET /api/servers/plans error:', error);
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred while retrieving server plans'
    }, { status: 500 });
  }
}
