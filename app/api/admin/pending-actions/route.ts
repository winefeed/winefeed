/**
 * ADMIN PENDING ACTIONS API
 *
 * GET /api/admin/pending-actions
 *
 * Returns stalled items that need admin attention:
 * - Stalled requests (0 offers after X days, no activity)
 * - Stalled orders (awaiting action, non-terminal too long)
 * - Stalled import cases (stuck in intermediate states)
 *
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Thresholds for "stalled" items (in hours)
const THRESHOLDS = {
  REQUEST_NO_OFFERS: 48,        // Request with 0 offers after 48h
  REQUEST_NO_ACTIVITY: 72,     // Request with no activity for 72h
  ORDER_PENDING_CONFIRMATION: 24, // Order pending supplier confirmation > 24h
  ORDER_IN_FULFILLMENT: 168,   // Order in fulfillment > 7 days
  ORDER_CONFIRMED_NO_PROGRESS: 72, // Confirmed but no progress > 72h
  IMPORT_CASE_STUCK: 168,      // Import case stuck > 7 days
};

interface PendingItem {
  id: string;
  type: 'request' | 'order' | 'import_case';
  status: string;
  reason: string;
  owner: {
    role: string;
    name: string;
    id: string;
  };
  ageHours: number;
  ageLabel: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

function formatAge(hours: number): string {
  if (hours < 1) return 'Just nu';
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  if (days === 1) return remainingHours > 0 ? `1d ${remainingHours}h` : '1d';
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function getAgeBucket(hours: number): 'today' | '1-2d' | '3-7d' | '7d+' {
  if (hours < 24) return 'today';
  if (hours < 48) return '1-2d';
  if (hours < 168) return '3-7d';
  return '7d+';
}

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const now = new Date();
    const pendingItems: PendingItem[] = [];

    // =========================================================================
    // 1. STALLED REQUESTS
    // =========================================================================
    const { data: requests } = await supabase
      .from('requests')
      .select(`
        id,
        fritext,
        status,
        created_at,
        updated_at,
        restaurant_id,
        restaurants:restaurant_id (id, name)
      `)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: true });

    // Get offer counts per request
    const requestIds = requests?.map(r => r.id) || [];
    let offerCountsByRequest: Record<string, number> = {};

    if (requestIds.length > 0) {
      const { data: offers } = await supabase
        .from('offers')
        .select('request_id')
        .in('request_id', requestIds);

      if (offers) {
        for (const offer of offers) {
          offerCountsByRequest[offer.request_id] = (offerCountsByRequest[offer.request_id] || 0) + 1;
        }
      }
    }

    // Check for stalled requests
    for (const req of requests || []) {
      const createdAt = new Date(req.created_at);
      const updatedAt = new Date(req.updated_at || req.created_at);
      const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      const lastActivityHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      const offerCount = offerCountsByRequest[req.id] || 0;

      // Check if stalled: no offers after threshold
      if (offerCount === 0 && ageHours > THRESHOLDS.REQUEST_NO_OFFERS) {
        const restaurant = req.restaurants as any;
        pendingItems.push({
          id: req.id,
          type: 'request',
          status: 'OPEN',
          reason: 'Inga offerter mottagna',
          owner: {
            role: 'SUPPLIER',
            name: 'Alla leverantörer',
            id: '',
          },
          ageHours,
          ageLabel: `Väntat ${formatAge(ageHours)}`,
          createdAt: req.created_at,
          updatedAt: req.updated_at || req.created_at,
          metadata: {
            fritext: req.fritext?.substring(0, 50) + (req.fritext?.length > 50 ? '...' : ''),
            restaurantName: restaurant?.name || 'Okänd',
            offerCount: 0,
          },
        });
      }
      // Or no activity for a long time
      else if (lastActivityHours > THRESHOLDS.REQUEST_NO_ACTIVITY && offerCount > 0) {
        const restaurant = req.restaurants as any;
        pendingItems.push({
          id: req.id,
          type: 'request',
          status: 'OPEN',
          reason: 'Ingen aktivitet',
          owner: {
            role: 'RESTAURANT',
            name: restaurant?.name || 'Okänd',
            id: req.restaurant_id,
          },
          ageHours: lastActivityHours,
          ageLabel: `Ingen aktivitet ${formatAge(lastActivityHours)}`,
          createdAt: req.created_at,
          updatedAt: req.updated_at || req.created_at,
          metadata: {
            fritext: req.fritext?.substring(0, 50) + (req.fritext?.length > 50 ? '...' : ''),
            restaurantName: restaurant?.name || 'Okänd',
            offerCount,
          },
        });
      }
    }

    // =========================================================================
    // 2. STALLED ORDERS
    // =========================================================================
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        created_at,
        updated_at,
        supplier_id,
        restaurant_id,
        import_id,
        suppliers:supplier_id (id, namn),
        restaurants:restaurant_id (id, name)
      `)
      .not('status', 'in', '(DELIVERED,CANCELLED)')
      .order('created_at', { ascending: true });

    for (const order of orders || []) {
      const createdAt = new Date(order.created_at);
      const updatedAt = new Date(order.updated_at || order.created_at);
      const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      const lastActivityHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

      const supplier = order.suppliers as any;
      const restaurant = order.restaurants as any;

      let isStalled = false;
      let reason = '';
      let owner = { role: '', name: '', id: '' };
      let relevantAge = ageHours;

      // Check different stalled conditions
      if (order.status === 'PENDING_SUPPLIER_CONFIRMATION' && lastActivityHours > THRESHOLDS.ORDER_PENDING_CONFIRMATION) {
        isStalled = true;
        reason = 'Väntar på leverantörsbekräftelse';
        owner = { role: 'SUPPLIER', name: supplier?.namn || 'Okänd', id: order.supplier_id };
        relevantAge = lastActivityHours;
      }
      else if (order.status === 'CONFIRMED' && lastActivityHours > THRESHOLDS.ORDER_CONFIRMED_NO_PROGRESS) {
        isStalled = true;
        reason = 'Bekräftad men ingen progress';
        owner = { role: 'SUPPLIER', name: supplier?.namn || 'Okänd', id: order.supplier_id };
        relevantAge = lastActivityHours;
      }
      else if (order.status === 'IN_FULFILLMENT' && lastActivityHours > THRESHOLDS.ORDER_IN_FULFILLMENT) {
        isStalled = true;
        reason = 'I leverans för länge';
        owner = { role: 'SUPPLIER', name: supplier?.namn || 'Okänd', id: order.supplier_id };
        relevantAge = lastActivityHours;
      }
      else if (order.status === 'SHIPPED' && lastActivityHours > THRESHOLDS.ORDER_IN_FULFILLMENT) {
        isStalled = true;
        reason = 'Skickad men ej bekräftad leverans';
        owner = { role: 'RESTAURANT', name: restaurant?.name || 'Okänd', id: order.restaurant_id };
        relevantAge = lastActivityHours;
      }

      if (isStalled) {
        pendingItems.push({
          id: order.id,
          type: 'order',
          status: order.status,
          reason,
          owner,
          ageHours: relevantAge,
          ageLabel: `Väntat ${formatAge(relevantAge)}`,
          createdAt: order.created_at,
          updatedAt: order.updated_at || order.created_at,
          metadata: {
            supplierName: supplier?.namn || 'Okänd',
            restaurantName: restaurant?.name || 'Okänd',
            hasImport: !!order.import_id,
          },
        });
      }
    }

    // =========================================================================
    // 3. STALLED IMPORT CASES
    // =========================================================================
    const { data: imports } = await supabase
      .from('imports')
      .select(`
        id,
        status,
        created_at,
        updated_at,
        order_id,
        importer_id,
        suppliers:importer_id (id, namn),
        delivery_locations:delivery_location_id (id, status)
      `)
      .not('status', 'in', '(COMPLETED,CANCELLED,REJECTED)')
      .order('created_at', { ascending: true });

    // Get document counts for import cases
    const importIds = imports?.map(i => i.id) || [];
    let docCountsByImport: Record<string, number> = {};

    if (importIds.length > 0) {
      const { data: docs } = await supabase
        .from('import_documents')
        .select('import_id')
        .in('import_id', importIds);

      if (docs) {
        for (const doc of docs) {
          docCountsByImport[doc.import_id] = (docCountsByImport[doc.import_id] || 0) + 1;
        }
      }
    }

    for (const imp of imports || []) {
      const createdAt = new Date(imp.created_at);
      const updatedAt = new Date(imp.updated_at || imp.created_at);
      const lastActivityHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

      const importer = imp.suppliers as any;
      const deliveryLocation = imp.delivery_locations as any;
      const hasDocuments = (docCountsByImport[imp.id] || 0) > 0;

      // Compute compliance status for this import case
      const ddlStatus = deliveryLocation?.status;
      let complianceStatus: 'OK' | 'ACTION_NEEDED' | 'BLOCKED' = 'OK';
      let blockReason: string | undefined;

      if (ddlStatus === 'REJECTED') {
        complianceStatus = 'BLOCKED';
        blockReason = 'DDL-ansökan avvisad';
      } else if (ddlStatus === 'EXPIRED') {
        complianceStatus = 'BLOCKED';
        blockReason = 'DDL har gått ut';
      } else if (!hasDocuments && imp.status !== 'NOT_REGISTERED') {
        complianceStatus = 'ACTION_NEEDED';
      } else if (imp.status === 'NOT_REGISTERED' || imp.status === 'SUBMITTED') {
        complianceStatus = 'ACTION_NEEDED';
      }

      // Check if stuck in intermediate state
      if (lastActivityHours > THRESHOLDS.IMPORT_CASE_STUCK) {
        let reason = '';
        let ownerRole = 'IOR';

        switch (imp.status) {
          case 'NOT_REGISTERED':
            reason = 'Väntar på registrering';
            break;
          case 'SUBMITTED':
            reason = 'Inskickad, väntar på beslut';
            break;
          case 'APPROVED':
            reason = 'Godkänd, väntar på slutförande';
            break;
          case 'PENDING_PAYMENT':
            reason = 'Väntar på betalning';
            break;
          default:
            reason = `Status: ${imp.status}`;
        }

        pendingItems.push({
          id: imp.id,
          type: 'import_case',
          status: imp.status,
          reason,
          owner: {
            role: ownerRole,
            name: importer?.namn || 'Okänd IOR',
            id: imp.importer_id,
          },
          ageHours: lastActivityHours,
          ageLabel: `Väntat ${formatAge(lastActivityHours)}`,
          createdAt: imp.created_at,
          updatedAt: imp.updated_at || imp.created_at,
          metadata: {
            orderId: imp.order_id,
            importerName: importer?.namn || 'Okänd',
            complianceStatus,
            blockReason,
            hasDocuments,
          },
        });
      }
    }

    // =========================================================================
    // Sort by age (most urgent first)
    // =========================================================================
    pendingItems.sort((a, b) => b.ageHours - a.ageHours);

    // =========================================================================
    // Calculate summary counts
    // =========================================================================
    const summary = {
      requests: pendingItems.filter(i => i.type === 'request').length,
      orders: pendingItems.filter(i => i.type === 'order').length,
      importCases: pendingItems.filter(i => i.type === 'import_case').length,
      total: pendingItems.length,
      byAgeBucket: {
        today: pendingItems.filter(i => getAgeBucket(i.ageHours) === 'today').length,
        '1-2d': pendingItems.filter(i => getAgeBucket(i.ageHours) === '1-2d').length,
        '3-7d': pendingItems.filter(i => getAgeBucket(i.ageHours) === '3-7d').length,
        '7d+': pendingItems.filter(i => getAgeBucket(i.ageHours) === '7d+').length,
      },
      byOwnerRole: {
        SUPPLIER: pendingItems.filter(i => i.owner.role === 'SUPPLIER').length,
        RESTAURANT: pendingItems.filter(i => i.owner.role === 'RESTAURANT').length,
        IOR: pendingItems.filter(i => i.owner.role === 'IOR').length,
      },
    };

    return NextResponse.json({
      items: pendingItems,
      summary,
      thresholds: THRESHOLDS,
      timestamp: now.toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching pending actions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
