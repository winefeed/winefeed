/**
 * DAILY DIGEST SERVICE
 *
 * Builds a morning digest email for Markus with:
 * - Pipeline updates (new actors, wines)
 * - Order/offer activity last 24h
 * - Actions that need attention today
 * - Overall pipeline snapshot
 */

import { getSupabaseAdmin } from './supabase-server';
import { callClaude } from './ai/claude';

// ============================================================================
// Types
// ============================================================================

export interface DigestData {
  // Last 24h activity
  newOrders: { id: string; restaurant_name: string; supplier_name: string; status: string; created_at: string }[];
  orderStatusChanges: { order_id: string; event_type: string; created_at: string; metadata: any }[];
  newOffers: { id: string; supplier_name: string; restaurant_name: string; created_at: string }[];
  newRequests: { id: string; restaurant_name: string; fritext: string; created_at: string }[];
  newWines: { id: string; name: string; supplier_name: string; created_at: string }[];
  newSuppliers: { id: string; name: string; created_at: string }[];
  newRestaurants: { id: string; name: string; created_at: string }[];

  // Pipeline totals
  totals: {
    orders: number;
    offers: number;
    suppliers: number;
    restaurants: number;
    wines: number;
  };

  // Actions needed
  actions: { type: 'followup' | 'reminder' | 'onboarding'; message: string; link?: string }[];

  // AI-generated briefing
  briefing: string;

  // Wine intel — latest news/trends
  wineIntel: string;
  wineIntelSources: { title: string; source: string; link: string }[];

  // Metadata
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
}

// ============================================================================
// Main builder
// ============================================================================

export async function buildDailyDigest(): Promise<DigestData> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Run all queries in parallel
  const [
    ordersResult,
    orderEventsResult,
    offersResult,
    requestsResult,
    winesResult,
    suppliersResult,
    restaurantsResult,
    totalOrdersResult,
    totalOffersResult,
    totalSuppliersResult,
    totalRestaurantsResult,
    totalWinesResult,
    staleRequestsResult,
    staleOffersResult,
    suppliersNoWinesResult,
  ] = await Promise.all([
    // Last 24h: New orders
    supabase
      .from('orders')
      .select('id, status, created_at, restaurant:restaurants(name), supplier:suppliers(name)')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }),

    // Last 24h: Order status changes
    supabase
      .from('order_events')
      .select('order_id, event_type, created_at, metadata')
      .gte('created_at', twentyFourHoursAgo)
      .neq('event_type', 'MAIL_SENT')
      .order('created_at', { ascending: false }),

    // Last 24h: New offers
    supabase
      .from('offers')
      .select('id, created_at, supplier:suppliers(name), request:requests(id, restaurant:restaurants(name))')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }),

    // Last 24h: New requests
    supabase
      .from('requests')
      .select('id, fritext, created_at, restaurant:restaurants(name)')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }),

    // Last 24h: New wines
    supabase
      .from('supplier_wines')
      .select('id, name, created_at, supplier:suppliers(name)')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }),

    // Last 24h: New suppliers
    supabase
      .from('suppliers')
      .select('id, name, created_at')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }),

    // Last 24h: New restaurants
    supabase
      .from('restaurants')
      .select('id, name, created_at')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }),

    // Totals
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('offers').select('id', { count: 'exact', head: true }),
    supabase.from('suppliers').select('id', { count: 'exact', head: true }),
    supabase.from('restaurants').select('id', { count: 'exact', head: true }),
    supabase.from('supplier_wines').select('id', { count: 'exact', head: true }),

    // Actions: Unanswered requests older than 48h
    supabase
      .from('requests')
      .select('id, fritext, created_at, restaurant:restaurants(name)')
      .eq('status', 'OPEN')
      .lt('created_at', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true }),

    // Actions: Offers pending acceptance > 3 days
    supabase
      .from('offers')
      .select('id, created_at, supplier:suppliers(name), request:requests(id, restaurant:restaurants(name))')
      .eq('status', 'PENDING')
      .lt('created_at', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true }),

    // Actions: Suppliers with no wines
    // Query all suppliers, then filter in JS for those with empty wine arrays
    supabase
      .from('suppliers')
      .select('id, name, supplier_wines(id)')
      .order('created_at', { ascending: true }),
  ]);

  // Build actions list
  const actions: DigestData['actions'] = [];

  // Stale requests → follow up with supplier
  if (staleRequestsResult.data) {
    for (const req of staleRequestsResult.data) {
      const restaurantName = (req.restaurant as any)?.name || 'Okänd';
      actions.push({
        type: 'followup',
        message: `Förfrågan från ${restaurantName} obesvarad i >48h`,
        link: `/admin/requests/${req.id}`,
      });
    }
  }

  // Stale offers → remind restaurant
  if (staleOffersResult.data) {
    for (const offer of staleOffersResult.data) {
      const restaurantName = (offer.request as any)?.restaurant?.name || 'Okänd';
      const supplierName = (offer.supplier as any)?.name || 'Okänd';
      actions.push({
        type: 'reminder',
        message: `Offert från ${supplierName} till ${restaurantName} väntar >3 dagar`,
        link: `/admin/offers/${offer.id}`,
      });
    }
  }

  // Suppliers without wines → help onboard
  if (suppliersNoWinesResult.data) {
    const noWines = suppliersNoWinesResult.data
      .filter((s: any) => !s.supplier_wines || s.supplier_wines.length === 0)
      .slice(0, 5);
    for (const s of noWines) {
      actions.push({
        type: 'onboarding',
        message: `${s.name} har inga viner – hjälp dem ladda upp sortiment`,
        link: `/admin/suppliers/${s.id}`,
      });
    }
  }

  // Generate AI briefing + wine intel in parallel
  const wineNewsHeadlines = await fetchWineNews();

  // Build source links for wine intel section
  const wineIntelSources = wineNewsHeadlines
    .filter(h => h.link)
    .slice(0, 5)
    .map(h => ({ title: h.title, source: h.source, link: h.link }));

  const [briefing, wineIntel] = await Promise.all([
    generateBriefing({
    newOrders: ordersResult.data?.length || 0,
    newOffers: offersResult.data?.length || 0,
    newRequests: requestsResult.data?.length || 0,
    newWines: winesResult.data?.length || 0,
    newSuppliers: suppliersResult.data || [],
    newRestaurants: restaurantsResult.data || [],
    totals: {
      orders: totalOrdersResult.count || 0,
      offers: totalOffersResult.count || 0,
      suppliers: totalSuppliersResult.count || 0,
      restaurants: totalRestaurantsResult.count || 0,
      wines: totalWinesResult.count || 0,
    },
    actionsCount: actions.length,
    dayOfWeek: now.toLocaleDateString('sv-SE', { weekday: 'long' }),
  }),
    generateWineIntel(wineNewsHeadlines),
  ]);

  return {
    newOrders: (ordersResult.data || []).map((o: any) => ({
      id: o.id,
      restaurant_name: o.restaurant?.name || 'Okänd',
      supplier_name: o.supplier?.name || 'Okänd',
      status: o.status,
      created_at: o.created_at,
    })),
    orderStatusChanges: orderEventsResult.data || [],
    newOffers: (offersResult.data || []).map((o: any) => ({
      id: o.id,
      supplier_name: o.supplier?.name || 'Okänd',
      restaurant_name: o.request?.restaurant?.name || 'Okänd',
      created_at: o.created_at,
    })),
    newRequests: (requestsResult.data || []).map((r: any) => ({
      id: r.id,
      restaurant_name: r.restaurant?.name || 'Okänd',
      fritext: r.fritext || '',
      created_at: r.created_at,
    })),
    newWines: (winesResult.data || []).map((w: any) => ({
      id: w.id,
      name: w.name || 'Namnlöst vin',
      supplier_name: w.supplier?.name || 'Okänd',
      created_at: w.created_at,
    })),
    newSuppliers: suppliersResult.data || [],
    newRestaurants: restaurantsResult.data || [],
    totals: {
      orders: totalOrdersResult.count || 0,
      offers: totalOffersResult.count || 0,
      suppliers: totalSuppliersResult.count || 0,
      restaurants: totalRestaurantsResult.count || 0,
      wines: totalWinesResult.count || 0,
    },
    actions,
    briefing,
    wineIntel,
    wineIntelSources,
    generatedAt: now.toISOString(),
    periodStart: twentyFourHoursAgo,
    periodEnd: now.toISOString(),
  };
}

// ============================================================================
// AI Briefing
// ============================================================================

interface BriefingInput {
  newOrders: number;
  newOffers: number;
  newRequests: number;
  newWines: number;
  newSuppliers: { id: string; name: string; created_at: string }[];
  newRestaurants: { id: string; name: string; created_at: string }[];
  totals: DigestData['totals'];
  actionsCount: number;
  dayOfWeek: string;
}

async function generateBriefing(input: BriefingInput): Promise<string> {
  try {
    const today = new Date();
    const month = today.toLocaleDateString('sv-SE', { month: 'long' });
    const year = today.getFullYear();

    const newSupplierNames = input.newSuppliers.map(s => s.name).join(', ');
    const newRestaurantNames = input.newRestaurants.map(r => r.name).join(', ');

    const prompt = `Du skriver en kort morgonbriefing till Markus, grundare av Winefeed — en B2B-marknadsplats som kopplar restauranger med vinimportörer i Sverige. Skriv som en personlig rådgivare/COS som ger en snabb lägesanalys.

DAGENS DATA (${input.dayOfWeek}, ${today.getDate()} ${month} ${year}):
- Senaste 24h: ${input.newOrders} ordrar, ${input.newOffers} offerter, ${input.newRequests} förfrågningar, ${input.newWines} nya viner
${input.newSuppliers.length > 0 ? `- Nya leverantörer: ${newSupplierNames}` : '- Inga nya leverantörer'}
${input.newRestaurants.length > 0 ? `- Nya restauranger: ${newRestaurantNames}` : '- Inga nya restauranger'}
- Pipeline totalt: ${input.totals.suppliers} leverantörer, ${input.totals.restaurants} restauranger, ${input.totals.wines} viner, ${input.totals.orders} ordrar
- ${input.actionsCount} saker som kräver åtgärd idag

KONTEXT OM WINEFEED:
- Tidig fas / pilot — varje ny aktör och order räknas
- Affärsmodell: 4% success fee på accepterade offerter
- Målgrupp: kvalitetsrestauranger + mindre importörer
- Sverige har ~180 aktiva vinimportörer och ~8 000 restauranger med utskänkningstillstånd
- Mars är en bra månad — restauranger uppdaterar vinlistor inför vårsäsongen

REGLER:
- Skriv 3-5 korta punkter på svenska, varje punkt börjar med "- "
- Var rak och konkret, inte formell
- Varje punkt = en observation, insikt eller taktisk rekommendation
- Om det hänt något märkbart (nya aktörer, ovanligt många ordrar, noll aktivitet) — kommentera det
- Avsluta med en punkt om marknadssignal (säsong, trender, branschevent)
- INGEN hälsning, INGEN inledande mening före punkterna
- Skriv INTE "Bra morgon" eller liknande`;

    const result = await callClaude(prompt, 300);
    return result.trim();
  } catch (error) {
    console.warn('⚠️  AI briefing generation failed, using fallback:', error);
    // Fallback: simple rule-based summary
    const parts: string[] = [];
    if (input.newOrders > 0) parts.push(`${input.newOrders} nya ordrar`);
    if (input.newOffers > 0) parts.push(`${input.newOffers} nya offerter`);
    if (input.newSuppliers.length > 0) parts.push(`${input.newSuppliers.length} nya leverantörer`);
    if (input.newRestaurants.length > 0) parts.push(`${input.newRestaurants.length} nya restauranger`);
    if (parts.length === 0) return 'Lugnt dygn utan större händelser. Bra tillfälle att följa upp leads och fylla på pipeline.';
    return `Senaste dygnet: ${parts.join(', ')}. Pipelinen har nu ${input.totals.suppliers} leverantörer och ${input.totals.wines} viner.`;
  }
}

// ============================================================================
// Wine Intel — Fetch news + AI summary
// ============================================================================

interface NewsItem {
  title: string;
  source: string;
  pubDate: string;
  link: string;
}

const NEWS_FEEDS = [
  'https://news.google.com/rss/search?q=vin+Sverige+when:3d&hl=sv&gl=SE&ceid=SE:sv',
  'https://news.google.com/rss/search?q=vinimport+OR+vinhandel+OR+restaurang+vin+when:3d&hl=sv&gl=SE&ceid=SE:sv',
  'https://news.google.com/rss/search?q=Systembolaget+lansering+OR+nyhet+when:3d&hl=sv&gl=SE&ceid=SE:sv',
  'https://news.google.com/rss/search?q=wine+trade+Europe+Sweden+when:3d&hl=en&gl=SE&ceid=SE:en',
];

async function fetchWineNews(): Promise<NewsItem[]> {
  const allItems: NewsItem[] = [];

  try {
    const results = await Promise.allSettled(
      NEWS_FEEDS.map(async (url) => {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Winefeed/1.0 (daily-digest)' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRssItems(xml);
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }
  } catch (error) {
    console.warn('⚠️  Failed to fetch wine news:', error);
  }

  // Filter: only items from last 3 days, deduplicate by title
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const seen = new Set<string>();
  const unique: NewsItem[] = [];
  for (const item of allItems) {
    const key = item.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) continue;
    // Filter out old items
    if (item.pubDate) {
      const itemDate = new Date(item.pubDate);
      if (!isNaN(itemDate.getTime()) && itemDate < threeDaysAgo) continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique.slice(0, 20);
}

function parseRssItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || '';
    const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || '';
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || '';
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || '';

    if (title) {
      items.push({ title, source, pubDate, link });
    }
  }

  return items;
}

async function generateWineIntel(headlines: NewsItem[]): Promise<string> {
  if (headlines.length === 0) {
    return 'Inga vinrelaterade nyheter hittades senaste dygnet.';
  }

  try {
    const headlineList = headlines
      .map(h => `- ${h.title}${h.source ? ` (${h.source})` : ''}`)
      .join('\n');

    const prompt = `Du är en wine trade analyst som skriver en kort daglig intel-brief till grundaren av en svensk B2B-vinmarknadsplats (Winefeed). Baserat på dagens nyhetsrubriker, ge en snabb sammanfattning av vad som är värt att veta.

SENASTE RUBRIKERNA:
${headlineList}

REGLER:
- Skriv 3-5 korta punkter på svenska, varje punkt börjar med "- "
- Varje punkt = en nyhet, trend eller signal värd att känna till
- Fokusera på det som är relevant för en svensk vinimportör/restaurangmarknad
- Nämn specifika namn, regioner eller trender om de dyker upp
- Om en rubrik handlar om Systembolaget, nya lanseringar, tullar, EU-regler eller restaurangtrender — lyft det
- Om inget är direkt relevant, sammanfatta den övergripande stämningen i 2-3 punkter
- INGEN inledande mening före punkterna, börja direkt med "- "`;

    const result = await callClaude(prompt, 400);
    return result.trim();
  } catch (error) {
    console.warn('⚠️  Wine intel generation failed:', error);
    // Fallback: Swedish-formatted list instead of raw English titles
    return headlines.slice(0, 3).map(h =>
      `- ${h.title}${h.source ? ` — ${h.source}` : ''}`
    ).join('\n');
  }
}
