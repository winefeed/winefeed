/**
 * GET /api/imports/:id/metrics
 *
 * Return import metrics for visibility and iteration guidance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: importId } = params;

    // STEP 1: Get import record
    const { data: importRecord, error: importError } = await supabase
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

    // STEP 2: Get detailed line data
    const { data: lines, error: linesError } = await supabase
      .from('supplier_import_lines')
      .select('match_status, match_reasons, guardrail_failures, confidence_score')
      .eq('import_id', importId);

    if (linesError) {
      return NextResponse.json(
        { error: 'Failed to fetch line data', details: linesError },
        { status: 500 }
      );
    }

    const totalLines = lines?.length || 0;

    if (totalLines === 0) {
      return NextResponse.json({
        importId,
        metrics: {
          totalLines: 0,
          autoMatchRate: 0,
          samplingReviewRate: 0,
          reviewQueueSize: 0,
          noMatchRate: 0,
          errorRate: 0,
          topReasons: [],
          topGuardrailFailures: []
        }
      });
    }

    // STEP 3: Calculate metrics
    const autoMatched = lines!.filter(l => l.match_status === 'AUTO_MATCHED').length;
    const samplingReview = lines!.filter(l => l.match_status === 'SAMPLING_REVIEW').length;
    const needsReview = lines!.filter(l => l.match_status === 'NEEDS_REVIEW').length;
    const noMatch = lines!.filter(l => l.match_status === 'NO_MATCH').length;
    const errors = lines!.filter(l => l.match_status === 'ERROR').length;

    const autoMatchRate = autoMatched / totalLines;
    const samplingReviewRate = samplingReview / totalLines;
    const noMatchRate = noMatch / totalLines;
    const errorRate = errors / totalLines;

    // STEP 4: Aggregate reason codes
    const reasonCounts: Record<string, number> = {};
    lines!.forEach(line => {
      if (line.match_reasons) {
        line.match_reasons.forEach((reason: string) => {
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });
      }
    });

    const topReasons = Object.entries(reasonCounts)
      .map(([code, count]) => ({
        code,
        count,
        percent: ((count / totalLines) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // STEP 5: Aggregate guardrail failures
    const guardrailCounts: Record<string, number> = {};
    lines!.forEach(line => {
      if (line.guardrail_failures) {
        line.guardrail_failures.forEach((failure: string) => {
          // Extract failure type (before colon)
          const failureType = failure.split(':')[0];
          guardrailCounts[failureType] = (guardrailCounts[failureType] || 0) + 1;
        });
      }
    });

    const topGuardrailFailures = Object.entries(guardrailCounts)
      .map(([reason, count]) => ({
        reason,
        count,
        percent: ((count / totalLines) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // STEP 6: Confidence score distribution (optional analytics)
    const confidenceDistribution = {
      high: lines!.filter(l => l.confidence_score >= 90).length,
      medium: lines!.filter(l => l.confidence_score >= 60 && l.confidence_score < 90).length,
      low: lines!.filter(l => l.confidence_score < 60).length
    };

    // Return metrics
    return NextResponse.json({
      importId,
      status: importRecord.status,
      metrics: {
        totalLines,
        autoMatchRate: parseFloat(autoMatchRate.toFixed(3)),
        samplingReviewRate: parseFloat(samplingReviewRate.toFixed(3)),
        reviewQueueSize: needsReview,
        noMatchRate: parseFloat(noMatchRate.toFixed(3)),
        errorRate: parseFloat(errorRate.toFixed(3)),

        // Counts
        counts: {
          autoMatched,
          samplingReview,
          needsReview,
          noMatch,
          errors
        },

        // Percentages (for display)
        percentages: {
          autoMatched: ((autoMatched / totalLines) * 100).toFixed(1),
          samplingReview: ((samplingReview / totalLines) * 100).toFixed(1),
          needsReview: ((needsReview / totalLines) * 100).toFixed(1),
          noMatch: ((noMatch / totalLines) * 100).toFixed(1)
        },

        // Top reasons
        topReasons,

        // Top guardrail failures
        topGuardrailFailures,

        // Confidence distribution
        confidenceDistribution
      },

      // Metadata
      importedAt: importRecord.created_at,
      matchedAt: importRecord.matched_at
    });

  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
