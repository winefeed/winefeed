import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { rankWinesWithClaude } from '@/lib/ai/rank-wines';
import { actorService } from '@/lib/actor-service';

// Create admin client lazily to avoid startup errors
function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// MVP: Get any existing restaurant for testing
async function getAnyRestaurant(): Promise<string | null> {
  const { data: existing, error } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id')
    .limit(1)
    .single();

  if (error || !existing) {
    console.log('No restaurants found, using placeholder ID');
    return null;
  }

  return existing.id;
}

export async function POST(request: NextRequest) {
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

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Only RESTAURANT or ADMIN can use wine suggestions
    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'RESTAURANT')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
      return NextResponse.json(
        { error: 'Server configuration error', details: 'Missing Supabase URL' },
        { status: 500 }
      );
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        { error: 'Server configuration error', details: 'Missing service role key' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      // New structured fields
      color,
      budget_min,
      budget_max,
      antal_flaskor,
      country,
      grape,
      certifications,
      description,
      leverans_senast,
      leverans_ort, // Delivery city for shipping calculation
      // Legacy fields (for backwards compatibility)
      fritext,
      budget_per_flaska,
      specialkrav,
    } = body;

    // Use new fields if available, fall back to legacy, then default
    const effectiveBudgetMax = budget_max || budget_per_flaska || 500; // Default 500 SEK
    const effectiveCertifications = certifications || specialkrav;

    // Use authenticated user's restaurant, or fallback for admins
    let restaurantId = actor.restaurant_id;

    // Save request to database - REQUIRED for dispatch to work
    let request_id: string;

    // Admins can create requests without being linked to a restaurant (for testing)
    if (!restaurantId) {
      if (actorService.hasRole(actor, 'ADMIN')) {
        // Admin fallback: use any existing restaurant for testing
        const fallbackRestaurant = await getAnyRestaurant();
        if (!fallbackRestaurant) {
          return NextResponse.json(
            { error: 'Ingen restaurang finns i systemet. Skapa en restaurang först.' },
            { status: 400 }
          );
        }
        restaurantId = fallbackRestaurant;
        console.log('Admin using fallback restaurant:', restaurantId);
      } else {
        console.error('No restaurant_id for user:', userId);
        return NextResponse.json(
          { error: 'Du måste vara kopplad till en restaurang för att skapa förfrågningar' },
          { status: 400 }
        );
      }
    }

    const { data: savedRequest, error: requestError } = await getSupabaseAdmin()
      .from('requests')
      .insert({
        restaurant_id: restaurantId,
        fritext: [fritext || description || 'Vinförfrågan', leverans_ort ? `Leverans: ${leverans_ort}` : null].filter(Boolean).join('. '),
        budget_per_flaska: effectiveBudgetMax,
        antal_flaskor: antal_flaskor || null,
        leverans_senast: leverans_senast || null,
        // Note: leverans_ort stored in fritext for now (column doesn't exist in requests table)
        specialkrav: effectiveCertifications || null,
        status: 'OPEN',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (requestError || !savedRequest) {
      console.error('Failed to save request:', requestError);
      console.error('Restaurant ID used:', restaurantId);
      const errorDetails = requestError?.message || 'Unknown error';
      return NextResponse.json(
        { error: `Kunde inte spara förfrågan: ${errorDetails}` },
        { status: 500 }
      );
    }

    request_id = savedRequest.id;

    // MVP: Don't filter by is_active - wines in catalog may have is_active=false or null
    // Fetch all available wine fields
    let query = getSupabaseAdmin()
      .from('supplier_wines')
      .select('*');

    // Filter by color (if specified)
    if (color && color !== 'all') {
      query = query.eq('color', color);
    }

    // Filter by budget range
    // Note: price_ex_vat_sek is stored in öre (1 SEK = 100 öre)
    // Allow generous range to find matches
    if (effectiveBudgetMax) {
      const budgetMaxOre = effectiveBudgetMax * 100;
      // Allow up to 50% over budget to find matches
      query = query.lte('price_ex_vat_sek', budgetMaxOre * 1.5);
    }

    if (budget_min) {
      const budgetMinOre = budget_min * 100;
      // Allow 50% under min to find matches
      query = query.gte('price_ex_vat_sek', budgetMinOre * 0.5);
    }

    // Filter by country (if specified)
    if (country && country !== 'all' && country !== 'other') {
      query = query.eq('country', country);
    }

    // Filter by grape (if specified) - use ilike for partial match
    if (grape && grape !== 'all' && grape !== 'other') {
      query = query.ilike('grape', `%${grape}%`);
    }

    // MVP: Certification filtering disabled - columns don't exist in current schema

    let wines;
    let winesError;

    try {
      const result = await query.limit(50);
      wines = result.data;
      winesError = result.error;

      // If filtered query fails or returns nothing, try without filters
      if (winesError || !wines || wines.length === 0) {
        const fallbackResult = await getSupabaseAdmin()
          .from('supplier_wines')
          .select('*')
          .limit(50);

        if (!fallbackResult.error && fallbackResult.data && fallbackResult.data.length > 0) {
          wines = fallbackResult.data;
          winesError = null;
        }
      }
    } catch (queryError: any) {
      console.error('Query execution error:', queryError);
      // Try a simple fallback
      try {
        const fallbackResult = await getSupabaseAdmin()
          .from('supplier_wines')
          .select('*')
          .limit(50);
        wines = fallbackResult.data;
        winesError = fallbackResult.error;
      } catch (fallbackError: any) {
        console.error('Fallback query also failed:', fallbackError);
        return NextResponse.json(
          { error: 'Kunde inte hämta viner', details: queryError.message || 'Query failed' },
          { status: 500 }
        );
      }
    }

    if (winesError) {
      console.error('Supabase error fetching wines:', winesError);
      return NextResponse.json(
        { error: 'Kunde inte hämta viner', details: winesError.message },
        { status: 500 }
      );
    }

    if (!wines || wines.length === 0) {
      return NextResponse.json({
        request_id,
        suggestions: [],
        message: 'Inga viner hittades som matchar dina kriterier. Prova att bredda sökningen.',
      });
    }

    // Fetch supplier info separately (relation may not work)
    const supplierIds = [...new Set(wines.map(w => w.supplier_id).filter(Boolean))];
    let suppliersMap: Record<string, any> = {};

    if (supplierIds.length > 0) {
      const { data: suppliers } = await getSupabaseAdmin()
        .from('suppliers')
        .select('id, namn, kontakt_email, min_order_bottles, provorder_enabled, provorder_fee_sek')
        .in('id', supplierIds);

      if (suppliers) {
        suppliers.forEach(s => {
          suppliersMap[s.id] = s;
        });
      }
    }

    // Transform wines for AI ranking
    const winesForRanking = wines.map(wine => ({
      id: wine.id,
      namn: wine.name,
      producent: wine.producer,
      land: wine.country,
      region: wine.region,
      appellation: wine.appellation,
      druva: wine.grape,
      color: wine.color,
      argang: wine.vintage,
      alkohol: wine.alcohol_pct,
      volym_ml: wine.volume_ml,
      pris_sek: wine.price_ex_vat_sek ? Math.round(wine.price_ex_vat_sek / 100) : 0,
      beskrivning: wine.description,
      sku: wine.sku,
      lager: wine.stock_qty,
      moq: wine.moq,
      kartong: wine.case_size,
      ledtid_dagar: wine.lead_time_days,
      supplier_id: wine.supplier_id,
      supplier: suppliersMap[wine.supplier_id] || null,
    }));

    // Build context for AI ranking
    const searchContext = buildSearchContext({
      color,
      country,
      grape,
      budget_min,
      budget_max: effectiveBudgetMax,
      certifications: effectiveCertifications,
      description,
      fritext,
    });

    // Rank with Claude AI
    const ranked = await rankWinesWithClaude(winesForRanking, searchContext);

    // Build suggestions response with all available wine details
    const suggestions = ranked.slice(0, 10).map((wine) => {
      const originalWine = wines.find(w => w.id === wine.id);
      const supplier = originalWine ? suppliersMap[originalWine.supplier_id] : null;
      return {
        wine: {
          id: wine.id,
          namn: wine.namn,
          producent: wine.producent,
          land: wine.land,
          region: wine.region,
          appellation: wine.appellation,
          druva: wine.druva,
          color: wine.color,
          argang: wine.argang,
          pris_sek: wine.pris_sek,
          // Extended details
          alkohol: wine.alkohol,
          volym_ml: wine.volym_ml,
          beskrivning: wine.beskrivning,
          sku: wine.sku,
          lager: wine.lager,
          moq: wine.moq,
          kartong: wine.kartong,
          ledtid_dagar: wine.ledtid_dagar,
        },
        supplier: supplier ? {
          id: supplier.id,
          namn: supplier.namn,
          kontakt_email: supplier.kontakt_email,
          min_order_bottles: supplier.min_order_bottles,
          provorder_enabled: supplier.provorder_enabled || false,
          provorder_fee_sek: supplier.provorder_fee_sek || 500,
        } : {
          namn: 'Okänd leverantör',
          kontakt_email: null,
          provorder_enabled: false,
          provorder_fee_sek: 500,
        },
        motivering: wine.ai_reason || wine.beskrivning || 'Ett utmärkt val för din restaurang.',
        ranking_score: wine.score,
      };
    });

    return NextResponse.json({
      request_id,
      suggestions,
      filters_applied: {
        color: color || 'all',
        budget_range: `${budget_min || 0}-${effectiveBudgetMax} kr`,
        country: country || 'all',
        grape: grape || 'all',
        certifications: effectiveCertifications || [],
      },
      total_matches: wines.length,
    });

  } catch (error: any) {
    console.error('Error in /api/suggest:', error);
    return NextResponse.json(
      {
        error: 'Något gick fel',
        details: error?.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Build search context string for AI ranking
function buildSearchContext(params: {
  color?: string;
  country?: string;
  grape?: string;
  budget_min?: number;
  budget_max?: number;
  certifications?: string[];
  description?: string;
  fritext?: string;
}): string {
  const parts: string[] = [];

  // Wine type
  const colorLabels: Record<string, string> = {
    red: 'rött vin',
    white: 'vitt vin',
    rose: 'rosévin',
    sparkling: 'mousserande vin',
    orange: 'orange vin',
    fortified: 'starkvin',
  };

  if (params.color && params.color !== 'all') {
    parts.push(`Söker ${colorLabels[params.color] || params.color}`);
  } else {
    parts.push('Söker vin (alla typer)');
  }

  // Country
  if (params.country && params.country !== 'all') {
    parts.push(`från ${params.country}`);
  }

  // Grape
  if (params.grape && params.grape !== 'all') {
    parts.push(`druva: ${params.grape}`);
  }

  // Budget
  if (params.budget_min && params.budget_max) {
    parts.push(`budget ${params.budget_min}-${params.budget_max} kr/flaska`);
  } else if (params.budget_max) {
    parts.push(`budget max ${params.budget_max} kr/flaska`);
  }

  // Certifications
  if (params.certifications && params.certifications.length > 0) {
    parts.push(`krav: ${params.certifications.join(', ')}`);
  }

  // Free text description
  if (params.description) {
    parts.push(`Önskemål: ${params.description}`);
  } else if (params.fritext) {
    parts.push(`Beskrivning: ${params.fritext}`);
  }

  return parts.join('. ');
}
