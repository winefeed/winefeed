/**
 * HEALTH CHECK API
 *
 * GET /api/health
 *
 * Returns system health and security status.
 * Used by smoke tests to verify production safety.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const env = process.env.NODE_ENV || 'development';
  const allowTestBypass =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_TEST_BYPASS === 'true';

  return NextResponse.json({
    status: 'ok',
    env,
    security: {
      testBypassEnabled: allowTestBypass,
      isProduction: env === 'production',
    },
    timestamp: new Date().toISOString(),
  });
}
