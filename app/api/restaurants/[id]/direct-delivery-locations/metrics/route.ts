/**
 * GET /api/restaurants/:id/direct-delivery-locations/metrics
 *
 * OPTIONAL ENDPOINT: DDL Metrics for Restaurant Dashboard
 *
 * Returns:
 *   - Counts by status
 *   - % approved
 *   - Average time from submitted → approved
 *   - # blocked shipment validations (last 7 days)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: restaurantId } = params;
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 401 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ========================================================================
    // 1. Status Counts
    // ========================================================================

    const { data: ddls } = await supabase
      .from('direct_delivery_locations')
      .select('id, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('restaurant_id', restaurantId);

    const statusCounts = {
      NOT_REGISTERED: 0,
      SUBMITTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      EXPIRED: 0,
    };

    if (ddls) {
      for (const ddl of ddls) {
        if (ddl.status in statusCounts) {
          statusCounts[ddl.status as keyof typeof statusCounts]++;
        }
      }
    }

    const totalDDLs = ddls?.length || 0;
    const approvedCount = statusCounts.APPROVED;
    const approvalRate = totalDDLs > 0 ? (approvedCount / totalDDLs) * 100 : 0;

    // ========================================================================
    // 2. Average Time: Submitted → Approved
    // ========================================================================

    // Get all approved DDLs
    const approvedDdlIds = ddls?.filter((d) => d.status === 'APPROVED').map((d) => d.id) || [];

    let avgApprovalTimeHours: number | null = null;

    if (approvedDdlIds.length > 0) {
      // Get submission events
      const { data: submissionEvents } = await supabase
        .from('ddl_status_events')
        .select('ddl_id, created_at')
        .in('ddl_id', approvedDdlIds)
        .eq('to_status', 'SUBMITTED')
        .order('created_at', { ascending: true });

      // Get approval events
      const { data: approvalEvents } = await supabase
        .from('ddl_status_events')
        .select('ddl_id, created_at')
        .in('ddl_id', approvedDdlIds)
        .eq('to_status', 'APPROVED')
        .order('created_at', { ascending: true });

      // Calculate time differences
      const timeDiffsHours: number[] = [];

      for (const ddlId of approvedDdlIds) {
        const submittedEvent = submissionEvents?.find((e) => e.ddl_id === ddlId);
        const approvedEvent = approvalEvents?.find((e) => e.ddl_id === ddlId);

        if (submittedEvent && approvedEvent) {
          const submittedAt = new Date(submittedEvent.created_at);
          const approvedAt = new Date(approvedEvent.created_at);
          const diffMs = approvedAt.getTime() - submittedAt.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          if (diffHours >= 0) {
            timeDiffsHours.push(diffHours);
          }
        }
      }

      if (timeDiffsHours.length > 0) {
        const totalHours = timeDiffsHours.reduce((sum, h) => sum + h, 0);
        avgApprovalTimeHours = totalHours / timeDiffsHours.length;
      }
    }

    // ========================================================================
    // 3. Blocked Shipment Validations (Last 7 Days)
    // ========================================================================

    // Note: This requires logging validation attempts, which may not be implemented
    // For now, we'll return a placeholder or estimate based on rejection counts

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Count recent rejections as a proxy for blocked validations
    const { data: recentRejections } = await supabase
      .from('ddl_status_events')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('ddl_id', ddls?.map((d) => d.id) || [])
      .eq('to_status', 'REJECTED')
      .gte('created_at', sevenDaysAgo.toISOString());

    const blockedShipmentCount = recentRejections?.length || 0;

    // Note: In production, you would log actual validation attempts
    // For acceptance testing, we can note this is a placeholder

    // ========================================================================
    // 4. Additional Metrics
    // ========================================================================

    // Pending approval count
    const pendingApprovalCount = statusCounts.SUBMITTED;

    // Rejection count
    const rejectionCount = statusCounts.REJECTED;

    // ========================================================================
    // Response
    // ========================================================================

    return NextResponse.json({
      restaurant_id: restaurantId,
      tenant_id: tenantId,
      summary: {
        total_ddls: totalDDLs,
        approved_ddls: approvedCount,
        pending_approval: pendingApprovalCount,
        rejected_ddls: rejectionCount,
        approval_rate_percent: Math.round(approvalRate * 10) / 10,
      },
      status_breakdown: statusCounts,
      performance: {
        avg_approval_time_hours: avgApprovalTimeHours
          ? Math.round(avgApprovalTimeHours * 10) / 10
          : null,
        avg_approval_time_days: avgApprovalTimeHours
          ? Math.round((avgApprovalTimeHours / 24) * 10) / 10
          : null,
      },
      blocked_shipments: {
        last_7_days: blockedShipmentCount,
        note: 'Based on rejection events; actual validation blocks may differ',
      },
    });
  } catch (error: any) {
    console.error('DDL metrics error:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
