/**
 * PILOT ADMIN CONSOLE - OVERVIEW API
 *
 * GET /api/admin/pilot/overview
 *
 * Returns recent requests, offers, and events for debugging pilot flows
 * without needing direct DB access.
 *
 * Security:
 * - Tenant-scoped (current tenant only)
 * - Admin-only (ADMIN_MODE=true in dev, or admin role in prod)
 * - No sensitive data (emails masked, no prices)
 *
 * Returns:
 * - recent_requests (max 20)
 * - recent_offers (max 20)
 * - recent_events (max 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// Helper: Mask email address (m***@domain.com)
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';

  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '***';
  return `${maskedLocal}@${domain}`;
}

// Helper: Check if user has admin access
function isAdmin(request: NextRequest): boolean {
  // Dev mode: Allow if ADMIN_MODE=true
  if (process.env.ADMIN_MODE === 'true') {
    return true;
  }

  // Production: Check x-user-role header (should be set by middleware)
  const userRole = request.headers.get('x-user-role');
  return userRole === 'admin';
}

// Helper: Get action hint for email failure based on template
function getActionHint(template: string): string {
  switch (template) {
    case 'ORDER_STATUS_UPDATED':
      return 'Kolla Resend/leveransstatus, mottagarlista (restaurant_users), samt domänverifiering.';
    case 'OFFER_CREATED':
      return 'Kolla att request_id finns, samt restaurangmottagare (restaurant_users) och EMAIL_FROM.';
    case 'OFFER_ACCEPTED':
      return 'Kolla supplier-mottagare (supplier_users), Resend status och domänverifiering.';
    default:
      return 'Kolla Resend logs och senaste MAIL_SENT events.';
  }
}

// Helper: Calculate percentile from sorted array
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Helper: Calculate median and p90 timing stats
function calculateTimingStats(hours: number[]) {
  if (hours.length < 5) {
    return {
      median_hours: null,
      p90_hours: null,
      sample_size: hours.length
    };
  }

  return {
    median_hours: Math.round(percentile(hours, 50) * 10) / 10, // 1 decimal
    p90_hours: Math.round(percentile(hours, 90) * 10) / 10,
    sample_size: hours.length
  };
}

// Helper: Fetch pilot KPI metrics (counts and timings)
async function fetchPilotMetrics(tenantId: string) {
  const supabase = getSupabaseAdmin();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ========================================
  // COUNTS (last 30 days, tenant-scoped)
  // ========================================

  const { count: requestsCreated } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', thirtyDaysAgo);

  const { count: offersCreated } = await supabase
    .from('offers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', thirtyDaysAgo);

  const { count: offersSent } = await supabase
    .from('offers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'SENT')
    .gte('created_at', thirtyDaysAgo);

  const { count: offersAccepted } = await supabase
    .from('offers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'ACCEPTED')
    .gte('created_at', thirtyDaysAgo);

  const { count: ordersCreated } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', thirtyDaysAgo);

  const { count: importsCreated } = await supabase
    .from('imports')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', thirtyDaysAgo);

  const { count: importsApproved } = await supabase
    .from('imports')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'APPROVED')
    .gte('created_at', thirtyDaysAgo);

  const { count: ordersShipped } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'SHIPPED')
    .gte('created_at', thirtyDaysAgo);

  // ========================================
  // TIMINGS (median + p90 in hours)
  // ========================================

  // 1. request_to_offer_created: Time from request created to first offer created
  const { data: offersWithRequest } = await supabase
    .from('offers')
    .select('id, created_at, request_id')
    .eq('tenant_id', tenantId)
    .not('request_id', 'is', null)
    .gte('created_at', thirtyDaysAgo);

  const requestIds = [...new Set((offersWithRequest || []).map(o => o.request_id))];
  let requestToOfferHours: number[] = [];

  if (requestIds.length > 0) {
    const { data: requests } = await supabase
      .from('requests')
      .select('id, created_at')
      .eq('tenant_id', tenantId)
      .in('id', requestIds);

    const requestMap = new Map((requests || []).map((r: any) => [r.id, r.created_at]));

    requestToOfferHours = (offersWithRequest || [])
      .map((offer: any) => {
        const requestCreatedAt = requestMap.get(offer.request_id);
        if (!requestCreatedAt) return null;

        const offerTime = new Date(offer.created_at).getTime();
        const requestTime = new Date(requestCreatedAt).getTime();
        const hours = (offerTime - requestTime) / (1000 * 60 * 60);
        return hours >= 0 ? hours : null;
      })
      .filter((h): h is number => h !== null);
  }

  // 2. offer_created_to_accepted: Time from offer created to accepted
  const { data: acceptedOffers } = await supabase
    .from('offers')
    .select('created_at, accepted_at')
    .eq('tenant_id', tenantId)
    .not('accepted_at', 'is', null)
    .gte('created_at', thirtyDaysAgo);

  const offerToAcceptHours = (acceptedOffers || [])
    .map((offer: any) => {
      const acceptTime = new Date(offer.accepted_at).getTime();
      const createTime = new Date(offer.created_at).getTime();
      const hours = (acceptTime - createTime) / (1000 * 60 * 60);
      return hours >= 0 ? hours : null;
    })
    .filter((h): h is number => h !== null);

  // 3. accept_to_order_created: Time from offer accepted to order created
  const { data: ordersWithOffer } = await supabase
    .from('orders')
    .select('id, created_at, offer_id')
    .eq('tenant_id', tenantId)
    .not('offer_id', 'is', null)
    .gte('created_at', thirtyDaysAgo);

  const offerIds = [...new Set((ordersWithOffer || []).map(o => o.offer_id))];
  let acceptToOrderHours: number[] = [];

  if (offerIds.length > 0) {
    const { data: offers } = await supabase
      .from('offers')
      .select('id, accepted_at')
      .eq('tenant_id', tenantId)
      .in('id', offerIds)
      .not('accepted_at', 'is', null);

    const offerMap = new Map((offers || []).map((o: any) => [o.id, o.accepted_at]));

    acceptToOrderHours = (ordersWithOffer || [])
      .map((order: any) => {
        const acceptedAt = offerMap.get(order.offer_id);
        if (!acceptedAt) return null;

        const orderTime = new Date(order.created_at).getTime();
        const acceptTime = new Date(acceptedAt).getTime();
        const hours = (orderTime - acceptTime) / (1000 * 60 * 60);
        return hours >= 0 ? hours : null;
      })
      .filter((h): h is number => h !== null);
  }

  // 4. order_created_to_import_approved: Time from order created to import approved
  const { data: ordersWithImport } = await supabase
    .from('orders')
    .select('id, created_at, import_id')
    .eq('tenant_id', tenantId)
    .not('import_id', 'is', null)
    .gte('created_at', thirtyDaysAgo);

  const importIds = [...new Set((ordersWithImport || []).map(o => o.import_id))];
  let orderToImportApprovedHours: number[] = [];

  if (importIds.length > 0) {
    // Fetch APPROVED events for these imports
    const { data: approvalEvents } = await supabase
      .from('import_status_events')
      .select('import_id, created_at, to_status')
      .eq('tenant_id', tenantId)
      .in('import_id', importIds)
      .eq('to_status', 'APPROVED')
      .order('created_at', { ascending: true }); // Get first APPROVED event

    // Map import_id to first APPROVED timestamp
    const importApprovalMap = new Map<string, string>();
    (approvalEvents || []).forEach((event: any) => {
      if (!importApprovalMap.has(event.import_id)) {
        importApprovalMap.set(event.import_id, event.created_at);
      }
    });

    orderToImportApprovedHours = (ordersWithImport || [])
      .map((order: any) => {
        const approvedAt = importApprovalMap.get(order.import_case_id);
        if (!approvedAt) return null;

        const approvedTime = new Date(approvedAt).getTime();
        const orderTime = new Date(order.created_at).getTime();
        const hours = (approvedTime - orderTime) / (1000 * 60 * 60);
        return hours >= 0 ? hours : null;
      })
      .filter((h): h is number => h !== null);
  }

  return {
    counts: {
      requests_created: requestsCreated || 0,
      offers_created: offersCreated || 0,
      offers_sent: offersSent || 0,
      offers_accepted: offersAccepted || 0,
      orders_created: ordersCreated || 0,
      imports_created: importsCreated || 0,
      imports_approved: importsApproved || 0,
      orders_shipped: ordersShipped || 0
    },
    timings: {
      request_to_offer_created: calculateTimingStats(requestToOfferHours),
      offer_created_to_accepted: calculateTimingStats(offerToAcceptHours),
      accept_to_order_created: calculateTimingStats(acceptToOrderHours),
      order_created_to_import_approved: calculateTimingStats(orderToImportApprovedHours)
    }
  };
}

// Helper: Fetch operational alerts for pilot monitoring
async function fetchOperationalAlerts(tenantId: string) {
  const supabase = getSupabaseAdmin();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. EU orders without import case
  const { data: euOrdersWithoutImport } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      seller_supplier_id,
      suppliers!inner(type)
    `)
    .eq('tenant_id', tenantId)
    .is('import_id', null)
    .in('suppliers.type', ['EU_PRODUCER', 'EU_IMPORTER'])
    .order('created_at', { ascending: false })
    .limit(10);

  // 2. Import cases missing DDL or DDL not approved
  const { data: importCasesMissingDDL } = await supabase
    .from('imports')
    .select(`
      id,
      created_at,
      delivery_location_id,
      direct_delivery_locations(status)
    `)
    .eq('tenant_id', tenantId)
    .or('delivery_location_id.is.null,direct_delivery_locations.status.neq.APPROVED')
    .order('created_at', { ascending: false })
    .limit(10);

  // 3. Approved import cases missing 5369 documents
  const { data: approvedImportsWithoutDocs } = await supabase
    .from('imports')
    .select(`
      id,
      created_at,
      status
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false });

  // Filter out imports that have 5369 documents
  const importsWithout5369: any[] = [];
  if (approvedImportsWithoutDocs) {
    for (const imp of approvedImportsWithoutDocs.slice(0, 10)) {
      const { data: docs } = await supabase
        .from('import_documents')
        .select('id')
        .eq('import_id', imp.id)
        .eq('document_type', '5369')
        .limit(1);

      if (!docs || docs.length === 0) {
        importsWithout5369.push(imp);
      }
    }
  }

  // 4. Orders stuck over 3 days (not updated, not in terminal state)
  const { data: stuckOrders } = await supabase
    .from('orders')
    .select('id, created_at, updated_at, status')
    .eq('tenant_id', tenantId)
    .not('status', 'in', '(DELIVERED,CANCELLED)')
    .lt('updated_at', threeDaysAgo)
    .order('updated_at', { ascending: true })
    .limit(10);

  // 5. Email failures in last 24h (from both offer_events and order_events)

  // 5a. Fetch offer email failures
  const { data: offerEmailFailures } = await supabase
    .from('offer_events')
    .select('id, offer_id, event_type, payload, created_at')
    .eq('tenant_id', tenantId)
    .eq('event_type', 'MAIL_SENT')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false });

  const failedOfferEmails = (offerEmailFailures || [])
    .filter((event: any) => event.payload?.success === false)
    .map((event: any) => {
      const template = event.payload?.type || 'UNKNOWN';
      return {
        source: 'offer_events' as const,
        event_id: event.id,
        created_at: event.created_at,
        template,
        to_masked: event.payload?.to ? maskEmail(event.payload.to) : 'N/A',
        success: false,
        error: event.payload?.error || '',
        entity: { offer_id: event.offer_id },
        action_hint: getActionHint(template)
      };
    });

  // 5b. Fetch order email failures
  const { data: orderEmailFailures } = await supabase
    .from('order_events')
    .select('id, order_id, event_type, metadata, created_at')
    .eq('tenant_id', tenantId)
    .eq('event_type', 'MAIL_SENT')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false });

  const failedOrderEmails = (orderEmailFailures || [])
    .filter((event: any) => {
      // Check metadata.success (order_events use metadata, not payload)
      return event.metadata?.success === false || event.metadata?.success === 'false';
    })
    .map((event: any) => {
      const template = event.metadata?.template || 'UNKNOWN';
      return {
        source: 'order_events' as const,
        event_id: event.id,
        created_at: event.created_at,
        template,
        to_masked: event.metadata?.to_masked || 'N/A',
        success: false,
        error: event.metadata?.error || '',
        entity: { order_id: event.order_id },
        action_hint: getActionHint(template)
      };
    });

  // 5c. Merge and sort by created_at DESC
  const allFailedEmails = [...failedOfferEmails, ...failedOrderEmails]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  return {
    eu_orders_without_import_case: {
      count: euOrdersWithoutImport?.length || 0,
      items: (euOrdersWithoutImport || []).map((order: any) => ({
        id: order.id,
        created_at: order.created_at
      }))
    },
    import_cases_missing_ddl_or_not_approved: {
      count: importCasesMissingDDL?.length || 0,
      items: (importCasesMissingDDL || []).map((imp: any) => ({
        id: imp.id,
        created_at: imp.created_at,
        ddl_status: imp.direct_delivery_locations?.status || 'MISSING'
      }))
    },
    approved_import_cases_missing_5369: {
      count: importsWithout5369.length,
      items: importsWithout5369.map((imp: any) => ({
        id: imp.id,
        created_at: imp.created_at
      }))
    },
    orders_stuck_over_3_days: {
      count: stuckOrders?.length || 0,
      items: (stuckOrders || []).map((order: any) => ({
        id: order.id,
        status: order.status,
        updated_at: order.updated_at
      }))
    },
    email_failures_last_24h: {
      count: allFailedEmails.length,
      items: allFailedEmails
    }
  };
}

export async function GET(request: NextRequest) {
  try {
    // Security: Admin check
    if (!isAdmin(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // Extract tenant context
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch recent requests (max 20)
    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select(`
        id,
        fritext,
        restaurant_id,
        created_at,
        restaurants (name, contact_email)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (requestsError) {
      console.error('Error fetching requests:', requestsError);
    }

    // Fetch recent offers (max 20)
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select(`
        id,
        title,
        status,
        restaurant_id,
        request_id,
        supplier_id,
        accepted_at,
        created_at,
        restaurants (name, contact_email),
        suppliers (namn, kontakt_email)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (offersError) {
      console.error('Error fetching offers:', offersError);
    }

    // Fetch recent offer events (max 50)
    const { data: events, error: eventsError } = await supabase
      .from('offer_events')
      .select(`
        id,
        offer_id,
        event_type,
        payload,
        created_at
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
    }

    // Transform data for UI (mask sensitive info)
    const transformedRequests = (requests || []).map((req: any) => ({
      id: req.id,
      fritext: req.fritext?.substring(0, 100) || '', // Truncate long text
      restaurant_name: req.restaurants?.name || 'Unknown',
      restaurant_email: req.restaurants?.contact_email
        ? maskEmail(req.restaurants.contact_email)
        : 'N/A',
      created_at: req.created_at
    }));

    const transformedOffers = (offers || []).map((offer: any) => ({
      id: offer.id,
      title: offer.title || 'Untitled',
      status: offer.status,
      restaurant_name: offer.restaurants?.name || 'Unknown',
      supplier_name: offer.suppliers?.namn || 'Unknown',
      request_id: offer.request_id,
      accepted_at: offer.accepted_at,
      created_at: offer.created_at
    }));

    const transformedEvents = (events || []).map((event: any) => {
      // Extract safe payload summary (mask emails, no prices)
      let payloadSummary: any = {};

      if (event.payload) {
        // For MAIL_SENT events, mask email
        if (event.event_type === 'MAIL_SENT' && event.payload.to) {
          payloadSummary = {
            type: event.payload.type || 'unknown',
            to: maskEmail(event.payload.to),
            success: event.payload.success,
            error: event.payload.error ? 'Error occurred' : undefined
          };
        } else {
          // For other events, include safe fields only
          payloadSummary = {
            // Add other safe payload fields as needed
            note: event.payload.note?.substring(0, 50) || undefined
          };
        }
      }

      return {
        id: event.id,
        offer_id: event.offer_id,
        event_type: event.event_type,
        payload: payloadSummary,
        created_at: event.created_at
      };
    });

    // Fetch operational alerts
    const alerts = await fetchOperationalAlerts(tenantId);

    // Fetch pilot KPI metrics
    const pilot_metrics = await fetchPilotMetrics(tenantId);

    return NextResponse.json(
      {
        tenant_id: tenantId,
        recent_requests: transformedRequests,
        recent_offers: transformedOffers,
        recent_events: transformedEvents,
        alerts,
        pilot_metrics,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error fetching pilot overview:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
