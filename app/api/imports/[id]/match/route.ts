/**
 * POST /api/imports/:id/match
 *
 * Run matching engine on all lines in import
 */

import { NextRequest, NextResponse } from 'next/server';
import { productMatcherV2 } from '@/lib/matching/product-matcher-v2';
import { createRouteClients } from '@/lib/supabase/route-client';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: importId } = params;
    const { adminClient } = await createRouteClients();

    // STEP 1: Get import record
    const { data: importRecord, error: importError } = await adminClient
      .from('supplier_imports')
      .select('*')
      .eq('id', importId)
      .single();

    if (importError || !importRecord) {
      return NextResponse.json(
        { error: 'Import not found' },
        { status: 404 }
      );
    }

    // Check if already matched (idempotency)
    if (importRecord.status === 'MATCHED') {
      return NextResponse.json({
        importId,
        status: 'MATCHED',
        summary: {
          totalLines: importRecord.total_lines,
          autoMatched: importRecord.auto_matched,
          samplingReview: importRecord.sampling_review,
          needsReview: importRecord.needs_review,
          noMatch: importRecord.no_match,
          errors: importRecord.errors
        },
        message: 'Import already matched (idempotent)'
      });
    }

    // Update status to MATCHING
    await adminClient
      .from('supplier_imports')
      .update({ status: 'MATCHING' })
      .eq('id', importId);

    // STEP 2: Get all pending lines
    const { data: lines, error: linesError } = await adminClient
      .from('supplier_import_lines')
      .select('*')
      .eq('import_id', importId)
      .eq('match_status', 'PENDING');

    if (linesError || !lines) {
      return NextResponse.json(
        { error: 'Failed to fetch lines', details: linesError },
        { status: 500 }
      );
    }

    // Summary counters
    let autoMatched = 0;
    let samplingReview = 0;
    let needsReview = 0;
    let noMatch = 0;
    let errors = 0;

    // STEP 3: Process each line
    for (const line of lines) {
      try {
        // Run matching
        const matchResult = await productMatcherV2.matchProduct(
          importRecord.supplier_id,
          {
            supplierSku: line.supplier_sku,
            gtinEach: line.gtin_each,
            gtinCase: line.gtin_case,
            producerName: line.producer_name,
            productName: line.product_name,
            vintage: line.vintage,
            volumeMl: line.volume_ml,
            abvPercent: line.abv_percent,
            packType: line.pack_type,
            unitsPerCase: line.units_per_case,
            countryOfOrigin: line.country_of_origin,
            region: line.region,
            grapeVariety: line.grape_variety
          }
        );

        // Handle decision
        switch (matchResult.decision) {
          case 'AUTO_MATCH':
            // Update line as matched
            await adminClient
              .from('supplier_import_lines')
              .update({
                match_status: 'AUTO_MATCHED',
                match_decision: matchResult.decision,
                confidence_score: matchResult.confidenceScore,
                match_reasons: matchResult.reasons,
                guardrail_failures: matchResult.guardrailFailures,
                matched_product_id: matchResult.masterProductId,
                matched_family_id: matchResult.productFamilyId
              })
              .eq('id', line.id);

            // Optionally create mapping immediately (idempotent)
            if (matchResult.masterProductId) {
              await adminClient
                .from('supplier_product_mappings')
                .upsert({
                  supplier_id: importRecord.supplier_id,
                  supplier_sku: line.supplier_sku,
                  master_product_id: matchResult.masterProductId,
                  match_confidence: matchResult.confidenceScore / 100,
                  match_method: 'gtin_exact',
                  match_reasons: matchResult.reasons
                }, {
                  onConflict: 'supplier_id,supplier_sku'
                });
            }

            autoMatched++;
            break;

          case 'AUTO_MATCH_WITH_SAMPLING_REVIEW':
            // Update line as matched with sampling flag
            await adminClient
              .from('supplier_import_lines')
              .update({
                match_status: 'SAMPLING_REVIEW',
                match_decision: matchResult.decision,
                confidence_score: matchResult.confidenceScore,
                match_reasons: matchResult.reasons,
                guardrail_failures: matchResult.guardrailFailures,
                matched_product_id: matchResult.masterProductId,
                matched_family_id: matchResult.productFamilyId
              })
              .eq('id', line.id);

            // Create mapping with sampling flag
            if (matchResult.masterProductId) {
              await adminClient
                .from('supplier_product_mappings')
                .upsert({
                  supplier_id: importRecord.supplier_id,
                  supplier_sku: line.supplier_sku,
                  master_product_id: matchResult.masterProductId,
                  match_confidence: matchResult.confidenceScore / 100,
                  match_method: 'fuzzy_match',
                  match_reasons: matchResult.reasons
                }, {
                  onConflict: 'supplier_id,supplier_sku'
                });
            }

            samplingReview++;
            break;

          case 'REVIEW_QUEUE':
          case 'NO_MATCH':
            // Update line status
            await adminClient
              .from('supplier_import_lines')
              .update({
                match_status: matchResult.decision === 'NO_MATCH' ? 'NO_MATCH' : 'NEEDS_REVIEW',
                match_decision: matchResult.decision,
                confidence_score: matchResult.confidenceScore,
                match_reasons: matchResult.reasons,
                guardrail_failures: matchResult.guardrailFailures
              })
              .eq('id', line.id);

            // Insert into review queue
            await adminClient
              .from('product_match_review_queue')
              .insert({
                supplier_id: importRecord.supplier_id,
                supplier_sku: line.supplier_sku,
                supplier_data: line.raw_data,
                match_candidates: matchResult.candidates || [],
                status: 'pending',
                import_line_id: line.id
              });

            if (matchResult.decision === 'NO_MATCH') {
              noMatch++;
            } else {
              needsReview++;
            }
            break;
        }

      } catch (error) {
        console.error(`Error matching line ${line.line_number}:`, error);

        // Mark line as error
        await adminClient
          .from('supplier_import_lines')
          .update({
            match_status: 'ERROR',
            match_decision: 'ERROR',
            guardrail_failures: [`ERROR: ${error}`]
          })
          .eq('id', line.id);

        errors++;
      }
    }

    // STEP 4: Update import summary
    await adminClient
      .from('supplier_imports')
      .update({
        status: 'MATCHED',
        auto_matched: autoMatched,
        sampling_review: samplingReview,
        needs_review: needsReview,
        no_match: noMatch,
        errors,
        matched_at: new Date().toISOString()
      })
      .eq('id', importId);

    // Return summary
    return NextResponse.json({
      importId,
      status: 'MATCHED',
      summary: {
        totalLines: lines.length,
        autoMatched,
        samplingReview,
        needsReview,
        noMatch,
        errors,
        autoMatchedPercent: ((autoMatched / lines.length) * 100).toFixed(1),
        needsReviewPercent: ((needsReview / lines.length) * 100).toFixed(1),
        noMatchPercent: ((noMatch / lines.length) * 100).toFixed(1)
      }
    });

  } catch (error) {
    console.error('Matching error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
