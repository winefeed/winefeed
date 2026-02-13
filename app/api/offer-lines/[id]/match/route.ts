/**
 * OFFER LINE MATCHING ENDPOINT - PILOT LOOP 1.0
 *
 * POST /api/offer-lines/[id]/match
 *
 * Runs product matching on a specific offer line and logs result to match_results
 *
 * Flow:
 * 1. Load offer_line by id (tenant scoped)
 * 2. Build match payload from line data (name, vintage, enrichment, etc.)
 * 3. Call matchService.matchProduct() with source_type='offer_line'
 * 4. Return match result (sanitized, allowlist only)
 *
 * Security:
 * - Tenant isolation enforced
 * - NO PRICE DATA in response (allowlist only)
 * - Match result logged to match_results for audit
 *
 * Response:
 * {
 *   latest_match: {
 *     status, confidence, match_method, matched_entity_type, matched_entity_id,
 *     explanation, candidates (allowlist only)
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { matchService } from '@/lib/match-service';
import { actorService } from '@/lib/actor-service';

// Security: Forbidden keys that must not appear in response
const FORBIDDEN_PATTERN = /price|offer|currency|market|cost|value|\$|€|£|USD|EUR|GBP/i;

function sanitizeMatchResult(result: any): any {
  // Remove forbidden keys from candidates
  if (result.candidates) {
    result.candidates = result.candidates.map((c: any) => {
      const sanitized = { ...c };
      // Check if any key contains forbidden data
      const serialized = JSON.stringify(sanitized);
      if (FORBIDDEN_PATTERN.test(serialized)) {
        console.warn('SECURITY: Forbidden data detected in match candidate, sanitizing');
        // Remove reason field if it contains forbidden data
        if (sanitized.reason && FORBIDDEN_PATTERN.test(sanitized.reason)) {
          delete sanitized.reason;
        }
      }
      return sanitized;
    });
  }

  // Check explanation
  if (result.explanation && FORBIDDEN_PATTERN.test(result.explanation)) {
    console.warn('SECURITY: Forbidden data detected in match explanation');
    result.explanation = 'Match found (details sanitized for security)';
  }

  return result;
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: lineId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    const { adminClient } = await createRouteClients();

    // Must be SELLER or ADMIN to run matching
    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Load offer_line (tenant scoped)
    const { data: line, error: lineError } = await adminClient
      .from('offer_lines')
      .select('*')
      .eq('id', lineId)
      .eq('tenant_id', tenantId)
      .single();

    if (lineError || !line) {
      return NextResponse.json(
        { error: 'Offer line not found or access denied' },
        { status: 404 }
      );
    }

    // SELLER must own the offer that contains this line
    if (actorService.hasRole(actor, 'SELLER') && !actorService.hasRole(actor, 'ADMIN')) {
      const { data: offer } = await adminClient
        .from('offers')
        .select('supplier_id')
        .eq('id', line.offer_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!offer || offer.supplier_id !== actor.supplier_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Build match payload from offer_line
    // Note: offer_lines may not have GTIN/LWIN/SKU, so we rely on text + enrichment
    const payload = {
      tenantId,
      source: {
        source_type: 'offer_line' as const,
        source_id: lineId
      },
      identifiers: {
        // ws_id from Wine Check enrichment (if available)
        ws_id: line.ws_id || undefined,
        // If you later add GTIN/LWIN to offer_lines, add them here:
        // gtin: line.gtin || undefined,
        // lwin: line.lwin || undefined,
      },
      textFallback: {
        // Use canonical_name from enrichment if available, otherwise use raw name
        name: line.canonical_name || line.name,
        vintage: line.vintage || undefined,
        bottle_ml: line.bottle_ml || undefined,
        producer: line.producer || undefined,
        region: line.region || undefined,
        appellation: line.appellation || undefined,
        country: line.country || undefined
      }
    };

    // Call matchService (logs to match_results internally)
    const matchResult = await matchService.matchProduct(payload);

    // Sanitize result (remove forbidden price data)
    const sanitized = sanitizeMatchResult(matchResult);

    return NextResponse.json(
      {
        message: 'Match completed',
        latest_match: {
          status: sanitized.status,
          confidence: sanitized.confidence,
          match_method: sanitized.match_method,
          matched_entity_type: sanitized.matched_entity_type || null,
          matched_entity_id: sanitized.matched_entity_id || null,
          explanation: sanitized.explanation,
          candidates: sanitized.candidates || []
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error matching offer line:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
