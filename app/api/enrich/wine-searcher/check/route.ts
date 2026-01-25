/**
 * WINE-SEARCHER WINE CHECK API ROUTE
 *
 * GET /api/enrich/wine-searcher/check?name=...&vintage=...
 *
 * Purpose: Wine normalization & verification - NO PRICE DATA
 * Returns: ONLY allowlist fields (canonical_name, producer, region, appellation, match_score, match_status, candidates)
 *
 * CRITICAL POLICY:
 * - NEVER expose price/offer/currency data
 * - API key NEVER sent to client
 * - Response strictly filtered by allowlist
 */

import { NextRequest, NextResponse } from 'next/server';
import { wineSearcherService, WineCheckResult, WineCheckResponse } from '@/lib/winesearcher-service';
import { actorService } from '@/lib/actor-service';

/**
 * SECURITY CHECK: Validate response contains NO price data
 */
function validateNoPriceData(data: any): void {
  const serialized = JSON.stringify(data);
  const forbiddenPattern = /price|offer|currency|market|cost|value|\$|€|£|USD|EUR|GBP/i;

  if (forbiddenPattern.test(serialized)) {
    console.error('[WineSearcher API] SECURITY VIOLATION: Forbidden data in response!');
    console.error('Response:', serialized);
    throw new Error('SECURITY_VIOLATION: Forbidden data detected in response');
  }
}

/**
 * SECURITY CHECK: Validate response contains ONLY allowlist keys
 */
function validateAllowlistKeys(data: WineCheckResult): void {
  const allowedKeys = new Set([
    'canonical_name',
    'producer',
    'region',
    'appellation',
    'match_score',
    'match_status',
    'candidates'
  ]);

  const candidateAllowedKeys = new Set([
    'name',
    'producer',
    'region',
    'appellation',
    'score'
  ]);

  // Check top-level keys
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`SECURITY_VIOLATION: Unexpected key in response: ${key}`);
    }
  }

  // Check candidate keys
  for (const candidate of data.candidates || []) {
    for (const key of Object.keys(candidate)) {
      if (!candidateAllowedKeys.has(key)) {
        throw new Error(`SECURITY_VIOLATION: Unexpected key in candidate: ${key}`);
      }
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Extract tenant context and user auth
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Only SELLER, IOR, or ADMIN can use wine enrichment
    if (!actorService.hasRole(actor, 'ADMIN') &&
        !actorService.hasRole(actor, 'SELLER') &&
        !actorService.hasRole(actor, 'IOR')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const vintage = searchParams.get('vintage');

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required parameter: name' },
        { status: 400 }
      );
    }

    // 3. Call Wine Check service
    const response = await wineSearcherService.checkWine({
      tenantId,
      name,
      vintage: vintage || undefined
    });

    // 4. SECURITY CHECKS (only on data, not metadata)
    validateAllowlistKeys(response.data);
    validateNoPriceData(response.data);

    // 5. Return allowlist-filtered result + mock metadata
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'X-Content-Type-Options': 'nosniff'
      }
    });

  } catch (error: any) {
    console.error('[WineSearcher API] Error:', error);

    // Don't expose internal errors to client
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return NextResponse.json(
        { error: 'Internal security check failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to check wine', details: error.message },
      { status: 500 }
    );
  }
}
