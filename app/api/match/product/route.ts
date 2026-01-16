/**
 * POST /api/match/product
 *
 * Matches incoming products to internal wine entities using hierarchical matching
 *
 * Auth: Requires x-tenant-id header
 * Body: MatchProductInput (identifiers + text fallback)
 * Returns: MatchProductOutput (status + confidence + match details)
 *
 * Security: NO PRICE DATA allowed in response
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchService, type MatchProductInput } from '@/lib/match-service';

/**
 * Validate no forbidden fields in response
 */
function validateNoForbiddenFields(obj: any): void {
  const serialized = JSON.stringify(obj);
  const forbiddenPattern = /price|offer|currency|market|cost|value|\$|€|£|USD|EUR|GBP/i;

  if (forbiddenPattern.test(serialized)) {
    console.error('[MatchAPI] SECURITY VIOLATION: Forbidden field in response', obj);
    throw new Error('SECURITY_VIOLATION: Forbidden price data detected in match response');
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Extract tenant context
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();

    // 3. Validate required fields
    const { source, identifiers, textFallback } = body;

    if (!source || !source.source_type || !source.source_id) {
      return NextResponse.json(
        { error: 'Missing required field: source (source_type, source_id)' },
        { status: 400 }
      );
    }

    if (!identifiers && !textFallback) {
      return NextResponse.json(
        { error: 'Missing identifiers or textFallback' },
        { status: 400 }
      );
    }

    // 4. Build input for match service
    const input: MatchProductInput = {
      tenantId,
      source,
      identifiers: identifiers || {},
      textFallback: textFallback || undefined
    };

    // 5. Call match service
    const result = await matchService.matchProduct(input);

    // 6. SECURITY CHECK: Validate no forbidden fields
    validateNoForbiddenFields(result);

    // 7. Return result
    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff'
      }
    });

  } catch (error: any) {
    console.error('Match API error:', error);

    // Security violations
    if (error.message?.includes('SECURITY_VIOLATION')) {
      return NextResponse.json(
        {
          error: 'Security violation',
          details: 'Forbidden data detected in match response'
        },
        { status: 500 }
      );
    }

    // Validation errors
    if (error.message?.includes('Missing') || error.message?.includes('Invalid')) {
      return NextResponse.json(
        { error: 'Validation error', details: error.message },
        { status: 400 }
      );
    }

    // Generic errors
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
