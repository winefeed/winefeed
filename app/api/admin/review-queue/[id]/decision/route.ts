/**
 * POST /api/admin/review-queue/:id/decision
 *
 * Resolve review queue item (approve/reject/create)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DecisionRequest {
  action: 'approve_match' | 'approve_family' | 'reject' | 'create_new_product';
  selectedId?: string;  // wf_product_id or family_id (required for approve actions)
  comment?: string;
  reviewedBy?: string;  // User ID (from auth context)
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: queueItemId } = params;
    const body: DecisionRequest = await request.json();

    const { action, selectedId, comment, reviewedBy } = body;

    // Validate request
    if (!['approve_match', 'approve_family', 'reject', 'create_new_product'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: approve_match | approve_family | reject | create_new_product' },
        { status: 400 }
      );
    }

    if ((action === 'approve_match' || action === 'approve_family') && !selectedId) {
      return NextResponse.json(
        { error: 'selectedId required for approve actions' },
        { status: 400 }
      );
    }

    // STEP 1: Get queue item with line details
    const { data: queueItem, error: queueError } = await supabase
      .from('product_match_review_queue')
      .select(`
        *,
        import_line:supplier_import_lines(*)
      `)
      .eq('id', queueItemId)
      .single();

    if (queueError || !queueItem) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      );
    }

    // Check if already resolved (idempotency)
    if (queueItem.status === 'resolved') {
      return NextResponse.json({
        queueItemId,
        status: 'resolved',
        message: 'Queue item already resolved (idempotent)',
        existingMapping: await getExistingMapping(queueItem.supplier_id, queueItem.supplier_sku)
      });
    }

    // STEP 2: Execute action
    let mappingResult: any = null;
    let auditEventId: string | null = null;

    switch (action) {
      case 'approve_match':
        mappingResult = await approveMatch(
          queueItem.supplier_id,
          queueItem.supplier_sku,
          selectedId!,
          comment,
          reviewedBy
        );
        break;

      case 'approve_family':
        mappingResult = await approveFamily(
          queueItem.supplier_id,
          queueItem.supplier_sku,
          selectedId!,
          comment,
          reviewedBy
        );
        break;

      case 'reject':
        mappingResult = await rejectMatch(
          queueItem.supplier_id,
          queueItem.supplier_sku,
          comment,
          reviewedBy
        );
        break;

      case 'create_new_product':
        mappingResult = await createNewProduct(
          queueItem.supplier_id,
          queueItem.supplier_sku,
          queueItem.import_line,
          comment,
          reviewedBy
        );
        break;
    }

    // STEP 3: Write audit log AFTER successful mapping (append-only)
    const { data: auditEvent, error: auditError } = await supabase
      .from('product_audit_log')
      .insert({
        event_type: `review_queue_${action}`,
        entity_type: 'supplier_product_mapping',
        entity_id: mappingResult?.mappingId || null,
        user_id: reviewedBy,
        metadata: {
          queueItemId,
          supplierId: queueItem.supplier_id,
          supplierSku: queueItem.supplier_sku,
          selectedId,
          action,
          comment,
          beforeState: null,  // No previous mapping
          afterState: mappingResult
        }
      })
      .select()
      .single();

    if (auditError) {
      console.error('Audit log write failed:', auditError);
      // Continue despite audit error (mapping succeeded)
    } else {
      auditEventId = auditEvent?.id;
    }

    // STEP 4: Mark queue item as resolved
    await supabase
      .from('product_match_review_queue')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: reviewedBy,
        resolution_action: action,
        resolution_comment: comment
      })
      .eq('id', queueItemId);

    // STEP 5: Update import line status if applicable
    if (queueItem.import_line_id && action !== 'reject') {
      await supabase
        .from('supplier_import_lines')
        .update({
          match_status: action === 'create_new_product' ? 'NO_MATCH' : 'AUTO_MATCHED',
          matched_product_id: mappingResult?.masterProductId || null,
          matched_family_id: mappingResult?.productFamilyId || null
        })
        .eq('id', queueItem.import_line_id);
    }

    // Return result
    return NextResponse.json({
      queueItemId,
      status: 'resolved',
      action,
      mapping: mappingResult,
      auditEventId,
      message: `Successfully ${action === 'reject' ? 'rejected' : 'approved'} match`
    });

  } catch (error) {
    console.error('Decision error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Approve match to MasterProduct (create mapping)
 */
async function approveMatch(
  supplierId: string,
  supplierSku: string,
  masterProductId: string,
  comment?: string,
  reviewedBy?: string
) {
  // IDEMPOTENT UPSERT: unique(supplier_id, supplier_sku)
  const { data: mapping, error } = await supabase
    .from('supplier_product_mappings')
    .upsert({
      supplier_id: supplierId,
      supplier_sku: supplierSku,
      master_product_id: masterProductId,
      match_confidence: 1.0,  // Human-approved = 100%
      match_method: 'human_review',
      match_reasons: ['HUMAN_APPROVED'],
      created_by: reviewedBy,
      notes: comment
    }, {
      onConflict: 'supplier_id,supplier_sku'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create mapping: ${error.message}`);
  }

  return {
    mappingId: mapping.id,
    masterProductId,
    productFamilyId: null,
    matchConfidence: 1.0,
    matchMethod: 'human_review'
  };
}

/**
 * Approve match to ProductFamily (create family-level mapping)
 */
async function approveFamily(
  supplierId: string,
  supplierSku: string,
  productFamilyId: string,
  comment?: string,
  reviewedBy?: string
) {
  // For family-level mapping, we store in a separate table or use same table with NULL master_product_id
  // Assuming we use supplier_product_mappings with master_product_id = NULL and product_family_id set

  const { data: mapping, error } = await supabase
    .from('supplier_product_mappings')
    .upsert({
      supplier_id: supplierId,
      supplier_sku: supplierSku,
      master_product_id: null,  // No specific product
      product_family_id: productFamilyId,
      match_confidence: 1.0,
      match_method: 'human_review_family',
      match_reasons: ['HUMAN_APPROVED_FAMILY'],
      created_by: reviewedBy,
      notes: comment
    }, {
      onConflict: 'supplier_id,supplier_sku'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create family mapping: ${error.message}`);
  }

  return {
    mappingId: mapping.id,
    masterProductId: null,
    productFamilyId,
    matchConfidence: 1.0,
    matchMethod: 'human_review_family'
  };
}

/**
 * Reject match (no mapping created)
 */
async function rejectMatch(
  supplierId: string,
  supplierSku: string,
  comment?: string,
  reviewedBy?: string
) {
  // No mapping created, just log the rejection
  // Could optionally store rejection in a separate table

  return {
    mappingId: null,
    masterProductId: null,
    productFamilyId: null,
    rejected: true,
    reason: comment
  };
}

/**
 * Create new MasterProduct (for products not in catalog)
 */
async function createNewProduct(
  supplierId: string,
  supplierSku: string,
  lineData: any,
  comment?: string,
  reviewedBy?: string
) {
  // STEP 1: Create new MasterProduct
  const { data: newProduct, error: productError } = await supabase
    .from('master_products')
    .insert({
      producer_name: lineData.producer_name,
      product_name: lineData.product_name,
      vintage: lineData.vintage,
      volume_ml: lineData.volume_ml,
      abv_percent: lineData.abv_percent,
      pack_type: lineData.pack_type,
      units_per_case: lineData.units_per_case,
      country_of_origin: lineData.country_of_origin,
      region: lineData.region,
      grape_variety: lineData.grape_variety,
      created_by: reviewedBy,
      notes: comment
    })
    .select()
    .single();

  if (productError) {
    throw new Error(`Failed to create product: ${productError.message}`);
  }

  // STEP 2: Register GTINs if provided
  if (lineData.gtin_each) {
    await supabase
      .from('product_gtin_registry')
      .insert({
        gtin: lineData.gtin_each,
        gtin_type: 'GTIN-13',
        master_product_id: newProduct.id,
        verified: false,
        source: 'supplier_import'
      });
  }

  // STEP 3: Create mapping
  const { data: mapping, error: mappingError } = await supabase
    .from('supplier_product_mappings')
    .upsert({
      supplier_id: supplierId,
      supplier_sku: supplierSku,
      master_product_id: newProduct.id,
      match_confidence: 1.0,
      match_method: 'create_new_product',
      match_reasons: ['NEW_PRODUCT_CREATED'],
      created_by: reviewedBy,
      notes: comment
    }, {
      onConflict: 'supplier_id,supplier_sku'
    })
    .select()
    .single();

  if (mappingError) {
    throw new Error(`Failed to create mapping for new product: ${mappingError.message}`);
  }

  return {
    mappingId: mapping.id,
    masterProductId: newProduct.id,
    productFamilyId: null,
    matchConfidence: 1.0,
    matchMethod: 'create_new_product',
    newProductCreated: true
  };
}

/**
 * Get existing mapping (for idempotency check)
 */
async function getExistingMapping(supplierId: string, supplierSku: string) {
  const { data } = await supabase
    .from('supplier_product_mappings')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('supplier_sku', supplierSku)
    .single();

  return data;
}
