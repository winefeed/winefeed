/**
 * IOR IMPORTS QUEUE API
 *
 * GET /api/ior/imports/queue
 *
 * Returns import cases for the current IOR with action signals:
 * - complianceStatus (OK/ACTION_NEEDED/BLOCKED)
 * - missingDocsCount
 * - pendingVerificationCount
 * - allowedTransitions
 *
 * Filter by queue type:
 * - needs_action: missingDocsCount > 0 OR complianceStatus != OK
 * - waiting_admin: pendingVerificationCount > 0
 * - ready: all clear, can proceed
 * - all: no filter (default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { getAllowedTransitions, IMPORT_STATUS_LABELS } from '@/lib/state-machine';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type ComplianceStatus = 'OK' | 'ACTION_NEEDED' | 'BLOCKED';
type QueueFilter = 'all' | 'needs_action' | 'waiting_admin' | 'ready';

interface ImportQueueItem {
  id: string;
  status: string;
  statusLabel: string;
  complianceStatus: ComplianceStatus;
  blockReason: string | null;
  missingDocsCount: number;
  pendingVerificationCount: number;
  verifiedDocsCount: number;
  updatedAt: string;
  createdAt: string;
  allowedTransitions: string[];
  // Context
  restaurantName: string;
  restaurantId: string;
  // Queue classification
  queueType: 'needs_action' | 'waiting_admin' | 'ready';
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Verify IOR access
    if (!actorService.hasRole(actor, 'IOR') || !actor.importer_id) {
      return NextResponse.json(
        { error: 'IOR access required. Contact admin for access.' },
        { status: 403 }
      );
    }

    // Get filter from query params
    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get('filter') || 'all') as QueueFilter;

    // Fetch import cases for this importer
    const { data: imports, error: importsError } = await supabase
      .from('imports')
      .select(`
        id,
        status,
        created_at,
        updated_at,
        restaurant_id,
        restaurant:restaurants!inner(name)
      `)
      .eq('tenant_id', tenantId)
      .eq('importer_id', actor.importer_id)
      .order('updated_at', { ascending: false });

    if (importsError) {
      console.error('Error fetching imports:', importsError);
      return NextResponse.json(
        { error: 'Failed to fetch import cases' },
        { status: 500 }
      );
    }

    if (!imports || imports.length === 0) {
      return NextResponse.json({
        imports: [],
        counts: { all: 0, needs_action: 0, waiting_admin: 0, ready: 0 },
        filter,
      });
    }

    // Fetch document counts for all imports in one query
    const importIds = imports.map(i => i.id);

    // Get document status counts per import
    const { data: docCounts, error: docCountsError } = await supabase
      .from('import_documents')
      .select('import_id, status')
      .eq('tenant_id', tenantId)
      .in('import_id', importIds);

    if (docCountsError) {
      console.error('Error fetching document counts:', docCountsError);
    }

    // Get missing docs counts via the helper function (or compute manually)
    // Since we can't call the function directly, we'll use the view
    const { data: requirements, error: reqError } = await supabase
      .from('import_document_requirements')
      .select('import_id, document_type, is_required_now, is_satisfied, latest_document_status')
      .in('import_id', importIds);

    if (reqError) {
      console.error('Error fetching requirements:', reqError);
    }

    // Build counts per import
    const docCountsMap = new Map<string, { pending: number; verified: number; rejected: number }>();
    const missingDocsMap = new Map<string, number>();

    // Initialize maps
    for (const importId of importIds) {
      docCountsMap.set(importId, { pending: 0, verified: 0, rejected: 0 });
      missingDocsMap.set(importId, 0);
    }

    // Count documents by status
    for (const doc of (docCounts || [])) {
      const counts = docCountsMap.get(doc.import_id);
      if (counts) {
        // PENDING and SUBMITTED_FOR_REVIEW both count as "waiting for admin"
        if (doc.status === 'PENDING' || doc.status === 'SUBMITTED_FOR_REVIEW') counts.pending++;
        else if (doc.status === 'VERIFIED') counts.verified++;
        else if (doc.status === 'REJECTED') counts.rejected++;
      }
    }

    // Count missing required docs
    for (const req of (requirements || [])) {
      if (req.is_required_now && !req.is_satisfied) {
        const current = missingDocsMap.get(req.import_id) || 0;
        missingDocsMap.set(req.import_id, current + 1);
      }
    }

    // Build queue items
    const queueItems: ImportQueueItem[] = imports.map(imp => {
      const docCount = docCountsMap.get(imp.id) || { pending: 0, verified: 0, rejected: 0 };
      const missingDocs = missingDocsMap.get(imp.id) || 0;

      // Determine compliance status
      let complianceStatus: ComplianceStatus = 'OK';
      let blockReason: string | null = null;

      if (imp.status === 'REJECTED') {
        complianceStatus = 'BLOCKED';
        blockReason = 'Import avvisad';
      } else if (missingDocs > 0) {
        complianceStatus = 'ACTION_NEEDED';
        blockReason = `${missingDocs} obligatoriska dokument saknas`;
      } else if (docCount.rejected > 0) {
        complianceStatus = 'ACTION_NEEDED';
        blockReason = `${docCount.rejected} dokument avvisade - ladda upp nya`;
      }

      // Get allowed transitions
      const allowedTransitions = getAllowedTransitions('import', imp.status);

      // Determine queue type
      let queueType: 'needs_action' | 'waiting_admin' | 'ready' = 'ready';
      if (complianceStatus !== 'OK' || missingDocs > 0 || docCount.rejected > 0) {
        queueType = 'needs_action';
      } else if (docCount.pending > 0) {
        queueType = 'waiting_admin';
      } else if (allowedTransitions.length > 0) {
        queueType = 'ready';
      }

      return {
        id: imp.id,
        status: imp.status,
        statusLabel: IMPORT_STATUS_LABELS[imp.status as keyof typeof IMPORT_STATUS_LABELS] || imp.status,
        complianceStatus,
        blockReason,
        missingDocsCount: missingDocs,
        pendingVerificationCount: docCount.pending,
        verifiedDocsCount: docCount.verified,
        updatedAt: imp.updated_at,
        createdAt: imp.created_at,
        allowedTransitions,
        restaurantName: (imp.restaurant as any)?.name || 'Okänd restaurang',
        restaurantId: imp.restaurant_id,
        queueType,
      };
    });

    // Sort: BLOCKED first, then ACTION_NEEDED, then waiting_admin, then ready
    // Secondary: most recently updated first
    queueItems.sort((a, b) => {
      const priorityOrder = { BLOCKED: 0, ACTION_NEEDED: 1, OK: 2 };
      const queueOrder = { needs_action: 0, waiting_admin: 1, ready: 2 };

      // First by compliance status
      const complianceDiff = priorityOrder[a.complianceStatus] - priorityOrder[b.complianceStatus];
      if (complianceDiff !== 0) return complianceDiff;

      // Then by queue type
      const queueDiff = queueOrder[a.queueType] - queueOrder[b.queueType];
      if (queueDiff !== 0) return queueDiff;

      // Then by updated_at (most recent first)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // Count totals per queue type
    const counts = {
      all: queueItems.length,
      needs_action: queueItems.filter(i => i.queueType === 'needs_action').length,
      waiting_admin: queueItems.filter(i => i.queueType === 'waiting_admin').length,
      ready: queueItems.filter(i => i.queueType === 'ready').length,
    };

    // Apply filter
    let filteredItems = queueItems;
    if (filter !== 'all') {
      filteredItems = queueItems.filter(i => i.queueType === filter);
    }

    return NextResponse.json({
      imports: filteredItems,
      counts,
      filter,
    });

  } catch (error: any) {
    console.error('Error in IOR imports queue:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
