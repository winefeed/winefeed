/**
 * Notifications Service
 *
 * Aggregates events and generates notifications for suppliers
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | 'new_request'
  | 'request_expiring'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'new_order'
  | 'low_stock'
  | 'payment_received';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  created_at: string;
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface ActivityItem {
  id: string;
  type: 'request' | 'offer' | 'order' | 'wine' | 'system';
  action: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  link?: string;
  status?: string;
  icon?: string;
}

// ============================================================================
// Notification Generation
// ============================================================================

/**
 * Get all notifications for a supplier
 */
export async function getSupplierNotifications(
  supplierId: string,
  limit: number = 20
): Promise<Notification[]> {
  const notifications: Notification[] = [];
  const now = new Date();

  // 1. New requests (last 7 days, not responded)
  const { data: newRequests } = await supabase
    .from('requests')
    .select(`
      id,
      fritext,
      created_at,
      deadline,
      restaurants!inner(name)
    `)
    .is('deleted_at', null)
    .gte('deadline', now.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  // Check which requests the supplier has responded to
  if (newRequests && newRequests.length > 0) {
    const requestIds = newRequests.map(r => r.id);
    const { data: supplierOffers } = await supabase
      .from('offers')
      .select('request_id')
      .eq('supplier_id', supplierId)
      .in('request_id', requestIds);

    const respondedIds = new Set(supplierOffers?.map(o => o.request_id) || []);

    for (const req of newRequests) {
      if (!respondedIds.has(req.id)) {
        const hoursUntilDeadline = req.deadline
          ? (new Date(req.deadline).getTime() - now.getTime()) / (1000 * 60 * 60)
          : 999;

        const isExpiring = hoursUntilDeadline < 24;
        const isCritical = hoursUntilDeadline < 4;

        notifications.push({
          id: `request-${req.id}`,
          type: isExpiring ? 'request_expiring' : 'new_request',
          title: isCritical
            ? '⚠️ Förfrågan löper ut snart!'
            : isExpiring
            ? 'Förfrågan löper ut inom 24h'
            : 'Ny förfrågan',
          message: `${(req.restaurants as any)?.name || 'Restaurang'}: ${req.fritext?.substring(0, 50)}...`,
          link: `/supplier/requests?id=${req.id}`,
          created_at: req.created_at,
          read: false,
          priority: isCritical ? 'critical' : isExpiring ? 'high' : 'normal',
          metadata: { request_id: req.id, hours_left: Math.round(hoursUntilDeadline) },
        });
      }
    }
  }

  // 2. Accepted offers (last 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: acceptedOffers } = await supabase
    .from('offers')
    .select(`
      id,
      title,
      updated_at,
      restaurants!inner(name)
    `)
    .eq('supplier_id', supplierId)
    .eq('status', 'ACCEPTED')
    .gte('updated_at', sevenDaysAgo.toISOString())
    .order('updated_at', { ascending: false })
    .limit(5);

  for (const offer of acceptedOffers || []) {
    notifications.push({
      id: `offer-accepted-${offer.id}`,
      type: 'offer_accepted',
      title: '🎉 Offert accepterad!',
      message: `${(offer.restaurants as any)?.name || 'Restaurang'} accepterade "${offer.title || 'offert'}"`,
      link: `/supplier/offers?id=${offer.id}`,
      created_at: offer.updated_at,
      read: false,
      priority: 'high',
      metadata: { offer_id: offer.id },
    });
  }

  // 3. Rejected offers (last 3 days)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const { data: rejectedOffers } = await supabase
    .from('offers')
    .select(`
      id,
      title,
      updated_at,
      restaurants!inner(name)
    `)
    .eq('supplier_id', supplierId)
    .eq('status', 'REJECTED')
    .gte('updated_at', threeDaysAgo.toISOString())
    .order('updated_at', { ascending: false })
    .limit(3);

  for (const offer of rejectedOffers || []) {
    notifications.push({
      id: `offer-rejected-${offer.id}`,
      type: 'offer_rejected',
      title: 'Offert nekad',
      message: `${(offer.restaurants as any)?.name || 'Restaurang'} tackade nej till "${offer.title || 'offert'}"`,
      link: `/supplier/offers?id=${offer.id}`,
      created_at: offer.updated_at,
      read: false,
      priority: 'low',
      metadata: { offer_id: offer.id },
    });
  }

  // 4. New orders (pending confirmation)
  const { data: newOrders } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      restaurants!inner(name)
    `)
    .eq('supplier_id', supplierId)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(5);

  for (const order of newOrders || []) {
    notifications.push({
      id: `order-${order.id}`,
      type: 'new_order',
      title: '📦 Ny order att bekräfta',
      message: `Order från ${(order.restaurants as any)?.name || 'Restaurang'}`,
      link: `/supplier/orders?id=${order.id}`,
      created_at: order.created_at,
      read: false,
      priority: 'high',
      metadata: { order_id: order.id },
    });
  }

  // 5. Low stock warnings
  const { data: lowStockWines } = await supabase
    .from('supplier_wines')
    .select('id, name, producer, stock_qty, moq')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .lt('stock_qty', 12) // Less than 1 case typically
    .gt('stock_qty', 0)
    .order('stock_qty', { ascending: true })
    .limit(5);

  for (const wine of lowStockWines || []) {
    notifications.push({
      id: `lowstock-${wine.id}`,
      type: 'low_stock',
      title: 'Lågt lager',
      message: `${wine.producer} ${wine.name}: endast ${wine.stock_qty} flaskor kvar`,
      link: `/supplier/wines?id=${wine.id}`,
      created_at: now.toISOString(),
      read: false,
      priority: 'normal',
      metadata: { wine_id: wine.id, stock: wine.stock_qty },
    });
  }

  // Sort by priority and date
  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  notifications.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return notifications.slice(0, limit);
}

/**
 * Get activity feed for a supplier
 */
export async function getSupplierActivity(
  supplierId: string,
  limit: number = 15
): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Recent offers
  const { data: offers } = await supabase
    .from('offers')
    .select(`
      id,
      title,
      status,
      created_at,
      updated_at,
      restaurants!inner(name)
    `)
    .eq('supplier_id', supplierId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('updated_at', { ascending: false })
    .limit(10);

  for (const offer of offers || []) {
    const statusText: Record<string, string> = {
      DRAFT: 'Utkast',
      SENT: 'Skickad',
      ACCEPTED: 'Accepterad',
      REJECTED: 'Nekad',
      EXPIRED: 'Utgången',
    };

    activities.push({
      id: `offer-${offer.id}`,
      type: 'offer',
      action: offer.status === 'ACCEPTED' ? 'accepterad' : offer.status === 'REJECTED' ? 'nekad' : 'skickad',
      title: `Offert ${statusText[offer.status] || offer.status}`,
      subtitle: `${(offer.restaurants as any)?.name || 'Restaurang'} - ${offer.title || 'Offert'}`,
      timestamp: offer.updated_at || offer.created_at,
      link: `/supplier/offers?id=${offer.id}`,
      status: offer.status,
    });
  }

  // 2. Recent orders
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      created_at,
      updated_at,
      restaurants!inner(name)
    `)
    .eq('supplier_id', supplierId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('updated_at', { ascending: false })
    .limit(10);

  for (const order of orders || []) {
    const statusText: Record<string, string> = {
      PENDING: 'Väntar',
      CONFIRMED: 'Bekräftad',
      IN_FULFILLMENT: 'Under behandling',
      SHIPPED: 'Skickad',
      DELIVERED: 'Levererad',
      CANCELLED: 'Avbruten',
    };

    activities.push({
      id: `order-${order.id}`,
      type: 'order',
      action: order.status === 'PENDING' ? 'mottagen' : 'uppdaterad',
      title: `Order ${statusText[order.status] || order.status}`,
      subtitle: `${(order.restaurants as any)?.name || 'Restaurang'}`,
      timestamp: order.updated_at || order.created_at,
      link: `/supplier/orders?id=${order.id}`,
      status: order.status,
    });
  }

  // 3. Recent wine imports/updates
  const { data: wines } = await supabase
    .from('supplier_wines')
    .select('id, name, producer, created_at, updated_at')
    .eq('supplier_id', supplierId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  for (const wine of wines || []) {
    activities.push({
      id: `wine-${wine.id}`,
      type: 'wine',
      action: 'tillagt',
      title: 'Vin tillagt i katalog',
      subtitle: `${wine.producer} ${wine.name}`,
      timestamp: wine.created_at,
      link: `/supplier/wines?id=${wine.id}`,
    });
  }

  // Sort by timestamp
  activities.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return activities.slice(0, limit);
}

/**
 * Get notification counts for badge display
 */
export async function getNotificationCounts(supplierId: string): Promise<{
  total: number;
  critical: number;
  high: number;
}> {
  const notifications = await getSupplierNotifications(supplierId, 50);

  return {
    total: notifications.length,
    critical: notifications.filter(n => n.priority === 'critical').length,
    high: notifications.filter(n => n.priority === 'high').length,
  };
}

/**
 * Get low stock wines for a supplier
 */
export async function getLowStockWines(
  supplierId: string,
  threshold: number = 12
): Promise<Array<{
  id: string;
  name: string;
  producer: string;
  stock_qty: number;
  moq: number;
}>> {
  const { data } = await supabase
    .from('supplier_wines')
    .select('id, name, producer, stock_qty, moq')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .lt('stock_qty', threshold)
    .gt('stock_qty', 0)
    .order('stock_qty', { ascending: true });

  return data || [];
}

/**
 * Get wines matching a request's criteria
 */
export async function getMatchingWines(
  supplierId: string,
  requestText: string,
  requestFilters?: {
    color?: string;
    country?: string;
    region?: string;
    min_price?: number;
    max_price?: number;
  }
): Promise<Array<{
  id: string;
  name: string;
  producer: string;
  vintage: number;
  color: string;
  country: string;
  region: string | null;
  price_ex_vat_sek: number;
  stock_qty: number;
  match_score: number;
  match_reasons: string[];
}>> {
  // Build query
  let query = supabase
    .from('supplier_wines')
    .select('id, name, producer, vintage, color, country, region, price_ex_vat_sek, stock_qty, grape')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .gt('stock_qty', 0);

  // Apply filters if provided
  if (requestFilters?.color) {
    query = query.eq('color', requestFilters.color);
  }
  if (requestFilters?.country) {
    query = query.ilike('country', `%${requestFilters.country}%`);
  }
  if (requestFilters?.region) {
    query = query.ilike('region', `%${requestFilters.region}%`);
  }
  if (requestFilters?.max_price) {
    query = query.lte('price_ex_vat_sek', requestFilters.max_price * 100); // Convert to öre
  }

  const { data: wines } = await query.limit(50);

  if (!wines || wines.length === 0) return [];

  // Simple text matching for scoring
  const searchTerms = requestText.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const scored = wines.map(wine => {
    let score = 0;
    const reasons: string[] = [];

    const wineText = `${wine.name} ${wine.producer} ${wine.country} ${wine.region || ''} ${wine.grape || ''}`.toLowerCase();

    // Check each search term
    for (const term of searchTerms) {
      if (wineText.includes(term)) {
        score += 10;
        reasons.push(`Matchar "${term}"`);
      }
    }

    // Bonus for in-stock
    if (wine.stock_qty > 24) {
      score += 5;
      reasons.push('Bra lagerstatus');
    }

    return {
      ...wine,
      match_score: score,
      match_reasons: reasons,
    };
  });

  // Sort by score and return top matches
  return scored
    .filter(w => w.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 10);
}
