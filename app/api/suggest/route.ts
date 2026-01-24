import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { rankWinesWithClaude } from '@/lib/ai/rank-wines';

// Admin client for DB operations
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// MVP: Get any existing restaurant for testing
async function getAnyRestaurant(): Promise<string | null> {
  const { data: existing, error } = await supabaseAdmin
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

export async function POST(request: Request) {
  try {
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
      // Legacy fields (for backwards compatibility)
      fritext,
      budget_per_flaska,
      specialkrav,
    } = body;

    // Use new fields if available, fall back to legacy
    const effectiveBudgetMax = budget_max || budget_per_flaska;
    const effectiveCertifications = certifications || specialkrav;

    // Validation
    if (!effectiveBudgetMax) {
      return NextResponse.json(
        { error: 'budget_max eller budget_per_flaska är obligatorisk' },
        { status: 400 }
      );
    }

    // MVP: Get any existing restaurant for testing
    const restaurantId = await getAnyRestaurant();

    // Save request to database
    let request_id: string;

    if (restaurantId) {
      const { data: savedRequest, error: requestError } = await supabaseAdmin
        .from('requests')
        .insert({
          restaurant_id: restaurantId,
          fritext: fritext || description || 'Vinförfrågan',
          budget_per_flaska: effectiveBudgetMax,
          antal_flaskor: antal_flaskor || null,
          leverans_senast: leverans_senast || null,
          specialkrav: effectiveCertifications || null,
          status: 'OPEN',
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (requestError) {
        console.error('Failed to save request:', requestError);
        request_id = crypto.randomUUID();
      } else {
        request_id = savedRequest.id;
      }
    } else {
      request_id = crypto.randomUUID();
    }

    // Query supplier_wines with structured filters
    console.log('Querying supplier_wines with filters:', {
      color,
      budget_min,
      budget_max: effectiveBudgetMax,
      country,
      grape,
      certifications: effectiveCertifications,
    });

    let query = supabaseAdmin
      .from('supplier_wines')
      .select(`
        id,
        supplier_id,
        name,
        producer,
        country,
        region,
        grape,
        color,
        vintage,
        price_ex_vat_sek,
        description,
        is_organic,
        is_biodynamic,
        is_vegan,
        stock_qty,
        moq,
        case_size,
        supplier:suppliers(id, namn, kontakt_email)
      `)
      .eq('is_active', true);

    // Filter by color (if specified)
    if (color && color !== 'all') {
      query = query.eq('color', color);
      console.log(`Filtering by color: ${color}`);
    }

    // Filter by budget range (price is in öre, convert from SEK)
    const budgetMaxOre = effectiveBudgetMax * 100;
    query = query.lte('price_ex_vat_sek', budgetMaxOre * 1.3); // Allow 30% overage

    if (budget_min) {
      const budgetMinOre = budget_min * 100;
      query = query.gte('price_ex_vat_sek', budgetMinOre * 0.7); // Allow 30% under
    }

    // Filter by country (if specified)
    if (country && country !== 'all') {
      if (country === 'other') {
        // "Other" = exclude predefined countries
        const predefinedCountries = [
          'France', 'Italy', 'Spain', 'Germany', 'Portugal', 'Austria',
          'USA', 'Australia', 'New Zealand', 'Chile', 'Argentina', 'South Africa'
        ];
        // Use NOT IN filter
        query = query.not('country', 'in', `(${predefinedCountries.join(',')})`);
        console.log('Filtering by OTHER countries (excluding predefined)');
      } else {
        query = query.eq('country', country);
        console.log(`Filtering by country: ${country}`);
      }
    }

    // Filter by grape (if specified) - use ilike for partial match
    if (grape && grape !== 'all') {
      if (grape === 'other') {
        // "Other" = exclude predefined grapes
        const predefinedGrapes = [
          'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah', 'Shiraz',
          'Sangiovese', 'Tempranillo', 'Nebbiolo', 'Grenache', 'Malbec', 'Zinfandel',
          'Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Pinot Grigio', 'Pinot Gris',
          'Gewürztraminer', 'Viognier', 'Grüner Veltliner', 'Albariño', 'Chenin Blanc'
        ];
        // Build NOT ILIKE conditions for each grape
        for (const g of predefinedGrapes) {
          query = query.not('grape', 'ilike', `%${g}%`);
        }
        console.log('Filtering by OTHER grapes (excluding predefined)');
      } else {
        query = query.ilike('grape', `%${grape}%`);
        console.log(`Filtering by grape: ${grape}`);
      }
    }

    // Filter by certifications
    if (effectiveCertifications && Array.isArray(effectiveCertifications)) {
      if (effectiveCertifications.includes('ekologiskt')) {
        query = query.eq('is_organic', true);
      }
      if (effectiveCertifications.includes('biodynamiskt')) {
        query = query.eq('is_biodynamic', true);
      }
      if (effectiveCertifications.includes('veganskt')) {
        query = query.eq('is_vegan', true);
      }
    }

    // Note: Stock filtering disabled for now - many test wines have stock_qty=0
    // TODO: Re-enable when stock data is properly maintained
    // query = query.or('stock_qty.gt.0,stock_qty.is.null');

    const { data: wines, error: winesError } = await query.limit(50);

    if (winesError) {
      console.error('Error fetching wines:', winesError);
      return NextResponse.json(
        { error: 'Kunde inte hämta viner', details: winesError.message },
        { status: 500 }
      );
    }

    console.log(`Found ${wines?.length || 0} wines matching criteria`);

    if (!wines || wines.length === 0) {
      return NextResponse.json({
        request_id,
        suggestions: [],
        message: 'Inga viner hittades som matchar dina kriterier. Prova att bredda sökningen.',
      });
    }

    // Transform wines for AI ranking
    const winesForRanking = wines.map(wine => ({
      id: wine.id,
      namn: wine.name,
      producent: wine.producer,
      land: wine.country,
      region: wine.region,
      druva: wine.grape,
      color: wine.color,
      argang: wine.vintage,
      pris_sek: wine.price_ex_vat_sek ? Math.round(wine.price_ex_vat_sek / 100) : 0,
      beskrivning: wine.description,
      ekologisk: wine.is_organic,
      biodynamiskt: wine.is_biodynamic,
      veganskt: wine.is_vegan,
      supplier_id: wine.supplier_id,
      supplier: wine.supplier,
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
    console.log(`Ranking ${winesForRanking.length} wines with Claude AI...`);
    console.log('Search context:', searchContext);

    const ranked = await rankWinesWithClaude(winesForRanking, searchContext);
    console.log(`Claude returned ${ranked.length} ranked wines`);

    // Build suggestions response
    const suggestions = ranked.slice(0, 10).map((wine) => {
      const originalWine = wines.find(w => w.id === wine.id);
      return {
        wine: {
          id: wine.id,
          namn: wine.namn,
          producent: wine.producent,
          land: wine.land,
          region: wine.region,
          druva: wine.druva,
          color: wine.color,
          argang: wine.argang,
          pris_sek: wine.pris_sek,
          ekologisk: wine.ekologisk,
          biodynamiskt: wine.biodynamiskt,
          veganskt: wine.veganskt,
        },
        supplier: originalWine?.supplier || {
          namn: 'Okänd leverantör',
          kontakt_email: null,
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

  } catch (error) {
    console.error('Error in /api/suggest:', error);
    return NextResponse.json(
      { error: 'Något gick fel' },
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
