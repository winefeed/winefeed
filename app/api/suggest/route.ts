import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { rankWinesWithClaude } from '@/lib/ai/rank-wines';
import { wineSearcherClient } from '@/lib/wine-searcher/client';

// Admin client for DB operations
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// MVP: Default tenant and pilot restaurant for testing
const PILOT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function getOrCreatePilotRestaurant(): Promise<string> {
  // Try to find existing pilot restaurant
  const { data: existing } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('tenant_id', PILOT_TENANT_ID)
    .eq('name', 'Pilot Restaurant')
    .single();

  if (existing) {
    return existing.id;
  }

  // Create pilot restaurant if it doesn't exist
  const { data: created, error } = await supabaseAdmin
    .from('restaurants')
    .insert({
      tenant_id: PILOT_TENANT_ID,
      name: 'Pilot Restaurant',
      contact_email: 'pilot@winefeed.se',
      created_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create pilot restaurant:', error);
    throw new Error('Could not create pilot restaurant');
  }

  return created.id;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fritext, budget_per_flaska, antal_flaskor, leverans_senast, specialkrav } = body;

    // Validering
    if (!fritext || !budget_per_flaska) {
      return NextResponse.json(
        { error: 'fritext och budget_per_flaska är obligatoriska' },
        { status: 400 }
      );
    }

    // Skapa Supabase-klient
    const supabase = await createClient();

    // MVP: Get pilot restaurant for testing (no auth required)
    const restaurantId = await getOrCreatePilotRestaurant();

    // Save request to database
    const { data: savedRequest, error: requestError } = await supabaseAdmin
      .from('requests')
      .insert({
        restaurant_id: restaurantId,
        fritext,
        budget_per_flaska,
        antal_flaskor: antal_flaskor || null,
        leverans_senast: leverans_senast || null,
        specialkrav: specialkrav || null,
        status: 'OPEN',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (requestError) {
      console.error('Failed to save request:', requestError);
      return NextResponse.json(
        { error: 'Kunde inte spara förfrågan' },
        { status: 500 }
      );
    }

    const request_id = savedRequest.id;

    // 1. Filtrera viner (SQL + certifications filter)
    let query = supabase
      .from('wines')
      .select(`
        *,
        wine_suppliers (
          supplier:suppliers (*)
        )
      `)
      .lte('pris_sek', budget_per_flaska * 1.3) // Tillåt 30% överskridning
      .eq('lagerstatus', 'tillgänglig');

    // Apply certification filters if provided
    if (specialkrav && Array.isArray(specialkrav) && specialkrav.length > 0) {
      console.log('Filtering wines by certifications:', specialkrav);

      if (specialkrav.includes('ekologiskt')) {
        query = query.eq('ekologisk', true);
      }
      if (specialkrav.includes('biodynamiskt')) {
        query = query.eq('biodynamiskt', true);
      }
      if (specialkrav.includes('veganskt')) {
        query = query.eq('veganskt', true);
      }
    }

    const { data: wines, error: winesError } = await query.limit(20);

    if (winesError) {
      console.error('Error fetching wines:', winesError);
      return NextResponse.json(
        { error: 'Kunde inte hämta viner' },
        { status: 500 }
      );
    }

    // 3. Rangordna med Claude AI
    console.log(`Ranking ${wines.length} wines with Claude AI...`);
    const ranked = await rankWinesWithClaude(wines, fritext);
    console.log(`Claude returned ${ranked.length} ranked wines`);

    // 4. Berika med marknadspriser från Wine-Searcher
    console.log(`Fetching market prices for ${ranked.length} wines...`);
    const enrichedWines = await Promise.all(
      ranked.map(async (wine) => {
        let marketData = null;

        // Försök hämta marknadspriser (om Wine-Searcher är konfigurerat)
        try {
          const searchQuery = `${wine.producent} ${wine.namn}`;
          const prices = await wineSearcherClient.getPricesByName(
            searchQuery,
            undefined,
            'SEK'
          );

          if (prices && prices.results && prices.results.length > 0) {
            marketData = {
              lowest_price: prices.results[0].price,
              merchant_name: prices.results[0].merchant_name,
              merchant_count: prices.total_results,
              price_difference: wine.pris_sek - prices.results[0].price,
              price_difference_percent: (
                ((wine.pris_sek - prices.results[0].price) / prices.results[0].price) * 100
              ).toFixed(1),
            };
          }
        } catch (error) {
          // Wine-Searcher anrop misslyckades - fortsätt utan prisdata
          console.log(`Could not fetch prices for ${wine.namn}:`, error instanceof Error ? error.message : 'Unknown error');
        }

        return {
          wine,
          marketData,
        };
      })
    );

    // 5. Skapa suggestions med AI-motiveringar och prisdata
    const suggestions = enrichedWines.map(({ wine, marketData }) => ({
      wine: {
        id: wine.id,
        namn: wine.namn,
        producent: wine.producent,
        land: wine.land,
        region: wine.region,
        pris_sek: wine.pris_sek,
        ekologisk: wine.ekologisk,
        biodynamiskt: wine.biodynamiskt,
        veganskt: wine.veganskt,
      },
      supplier: wines.find(w => w.id === wine.id)?.wine_suppliers?.[0]?.supplier || {
        namn: 'Vingruppen AB',
        kontakt_email: 'order@vingruppen.se',
        normalleveranstid_dagar: 3,
      },
      motivering: wine.ai_reason || wine.beskrivning || 'Ett utmärkt val för din restaurang.',
      ranking_score: wine.score,
      market_data: marketData,
    }));

    // 6. Returnera förslag med det sparade request_id
    return NextResponse.json({
      request_id,
      suggestions,
    });
  } catch (error) {
    console.error('Error in /api/suggest:', error);
    return NextResponse.json(
      { error: 'Något gick fel' },
      { status: 500 }
    );
  }
}
