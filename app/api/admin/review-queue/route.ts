/**
 * GET /api/admin/review-queue
 *
 * Fetch pending review items with candidates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { adminService } from '@/lib/admin-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    // Admin access required
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    const isAdmin = await adminService.isAdmin(actor);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Query parameters
    const importId = searchParams.get('importId');
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
      .from('product_match_review_queue')
      .select(`
        *,
        supplier:suppliers(id, name),
        import_line:supplier_import_lines(
          id,
          import_id,
          line_number,
          supplier_sku,
          gtin_each,
          gtin_case,
          producer_name,
          product_name,
          vintage,
          volume_ml,
          abv_percent,
          pack_type,
          units_per_case,
          country_of_origin,
          region,
          grape_variety,
          price_ex_vat_sek,
          currency,
          raw_data,
          match_status,
          confidence_score,
          match_reasons,
          guardrail_failures
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by import if specified
    if (importId) {
      query = query.eq('import_line.import_id', importId);
    }

    const { data: queueItems, error: queueError } = await query;

    if (queueError) {
      return NextResponse.json(
        { error: 'Failed to fetch review queue', details: queueError },
        { status: 500 }
      );
    }

    // Format response
    const items = queueItems?.map(item => {
      const line = item.import_line;

      return {
        // Queue metadata
        queueItemId: item.id,
        status: item.status,
        createdAt: item.created_at,
        resolvedAt: item.resolved_at,
        resolvedBy: item.resolved_by,

        // Supplier info
        supplier: {
          id: item.supplier_id,
          name: item.supplier?.name
        },

        // Line details
        line: {
          importId: line?.import_id,
          lineNumber: line?.line_number,
          supplierSku: item.supplier_sku,
          gtinEach: line?.gtin_each,
          gtinCase: line?.gtin_case,
          producerName: line?.producer_name,
          productName: line?.product_name,
          vintage: line?.vintage,
          volumeMl: line?.volume_ml,
          abvPercent: line?.abv_percent,
          packType: line?.pack_type,
          unitsPerCase: line?.units_per_case,
          countryOfOrigin: line?.country_of_origin,
          region: line?.region,
          grapeVariety: line?.grape_variety,
          priceExVatSek: line?.price_ex_vat_sek,
          currency: line?.currency,
          rawData: item.supplier_data || line?.raw_data
        },

        // Match metadata
        matchMetadata: {
          status: line?.match_status,
          confidenceScore: line?.confidence_score,
          reasons: line?.match_reasons || [],
          guardrailFailures: line?.guardrail_failures || []
        },

        // Candidates with formatted summary
        candidates: (item.match_candidates || []).map((candidate: any) => ({
          id: candidate.masterProductId || candidate.productFamilyId,
          type: candidate.masterProductId ? 'master_product' : 'product_family',
          score: candidate.confidenceScore,
          reasons: candidate.reasons || [],

          // Product details
          producerName: candidate.producerName,
          productName: candidate.productName,
          vintage: candidate.vintage,
          volumeMl: candidate.volumeMl,
          packType: candidate.packType,
          abvPercent: candidate.abvPercent,

          // Match summary
          reasonSummary: generateReasonSummary(candidate.reasons || []),

          // Warnings (if any)
          warnings: candidate.guardrailFailures || []
        }))
      };
    }) || [];

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('product_match_review_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);

    return NextResponse.json({
      items,
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (totalCount || 0)
      }
    });

  } catch (error) {
    console.error('Review queue fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}

/**
 * Generate human-readable reason summary from reason codes
 */
function generateReasonSummary(reasons: string[]): string {
  const summaryParts: string[] = [];

  if (reasons.includes('GTIN_EXACT')) {
    summaryParts.push('Exact GTIN match');
  } else if (reasons.includes('SKU_MAPPING_EXISTS')) {
    summaryParts.push('Existing SKU mapping');
  } else {
    // Fuzzy match summary
    if (reasons.includes('PRODUCER_EXACT') || reasons.includes('PRODUCER_FUZZY_STRONG')) {
      summaryParts.push('Producer match');
    }
    if (reasons.includes('PRODUCT_EXACT') || reasons.includes('PRODUCT_FUZZY_STRONG')) {
      summaryParts.push('Product match');
    }
    if (reasons.includes('VINTAGE_EXACT')) {
      summaryParts.push('Vintage match');
    } else if (reasons.includes('VINTAGE_MISMATCH')) {
      summaryParts.push('⚠️ Vintage differs');
    } else if (reasons.includes('MISSING_VINTAGE')) {
      summaryParts.push('⚠️ Missing vintage');
    }
    if (reasons.includes('VOLUME_EXACT')) {
      summaryParts.push('Volume match');
    }
  }

  return summaryParts.length > 0
    ? summaryParts.join(' • ')
    : 'Partial match';
}
