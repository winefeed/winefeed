/**
 * RATE LIMITING
 *
 * Uses Upstash Redis for serverless-friendly rate limiting.
 * Falls back gracefully if Redis is not configured.
 *
 * Limits:
 * - General API: 100 requests per 10 seconds per IP
 * - Auth endpoints: 5 requests per minute per IP (prevent brute force)
 * - Import endpoints: 10 requests per minute per user (expensive operations)
 * - AI/Search endpoints: 20 requests per minute per user
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Check if Upstash is configured
const isConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Create Redis client if configured
const redis = isConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Rate limiters for different endpoint types
export const rateLimiters = {
  // General API: 100 requests per 10 seconds
  general: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '10 s'),
        prefix: 'ratelimit:general',
        analytics: true,
      })
    : null,

  // Auth endpoints: 5 requests per minute (prevent brute force)
  auth: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        prefix: 'ratelimit:auth',
        analytics: true,
      })
    : null,

  // Import/expensive endpoints: 10 requests per minute
  import: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        prefix: 'ratelimit:import',
        analytics: true,
      })
    : null,

  // AI/Search endpoints: 20 requests per minute
  ai: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        prefix: 'ratelimit:ai',
        analytics: true,
      })
    : null,
};

export type RateLimitType = keyof typeof rateLimiters;

/**
 * Check rate limit for a given identifier and type
 *
 * @param identifier - Usually IP address or user ID
 * @param type - Type of rate limit to apply
 * @returns Object with success boolean and optional headers
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'general'
): Promise<{
  success: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
}> {
  const limiter = rateLimiters[type];

  // If rate limiting is not configured, allow all requests
  if (!limiter) {
    return { success: true };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    // If Redis fails, allow the request (fail open)
    console.error('Rate limit check failed:', error);
    return { success: true };
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: {
  limit?: number;
  remaining?: number;
  reset?: number;
}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (result.limit !== undefined) {
    headers['X-RateLimit-Limit'] = String(result.limit);
  }
  if (result.remaining !== undefined) {
    headers['X-RateLimit-Remaining'] = String(result.remaining);
  }
  if (result.reset !== undefined) {
    headers['X-RateLimit-Reset'] = String(result.reset);
  }

  return headers;
}

/**
 * Determine which rate limit type to use based on pathname
 */
export function getRateLimitType(pathname: string): RateLimitType {
  // Auth endpoints - strict limit
  if (
    pathname.includes('/auth/') ||
    pathname.includes('/login') ||
    pathname.includes('/forgot-password')
  ) {
    return 'auth';
  }

  // Import endpoints - moderate limit
  if (
    pathname.includes('/import') ||
    pathname.includes('/preview') ||
    pathname.includes('/bulk-update')
  ) {
    return 'import';
  }

  // AI/Search endpoints
  if (
    pathname.includes('/suggest') ||
    pathname.includes('/search') ||
    pathname.includes('/translate') ||
    pathname.includes('/wine-prices')
  ) {
    return 'ai';
  }

  // Default to general limit
  return 'general';
}

/**
 * Check if rate limiting is enabled
 */
export function isRateLimitEnabled(): boolean {
  return isConfigured;
}
