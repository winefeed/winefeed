import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rankWinesWithClaude } from '@/lib/ai/rank-wines';
import { wineSearcherClient } from '@/lib/wine-searcher/client';

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

    // TODO: Auth - Tillfälligt inaktiverat för MVP-test
    // const supabase = await createClient();
    // const { data: { user }, error: authError } = await supabase.auth.getUser();
    // if (authError || !user) {
    //   return NextResponse.json({ error: 'Ej autentiserad' }, { status: 401 });
    // }

    // Skapa Supabase-klient (utan auth för MVP-test)
    const supabase = await createClient();

    // TODO: Spara request i DB när auth fungerar
    // För nu: Skip saving request, bara testa vinfiltrering
    const mock_request_id = 'test-request-' + Date.now();

    // 1. Filtrera viner (SQL)
    const { data: wines, error: winesError } = await supabase
      .from('wines')
      .select(`
        *,
        wine_suppliers (
          supplier:suppliers (*)
        )
      `)
      .lte('pris_sek', budget_per_flaska * 1.3) // Tillåt 30% överskridning
      .eq('lagerstatus', 'tillgänglig')
      .limit(20);

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

    // TODO: Spara suggestions i DB när auth fungerar
    // const suggestionsToSave = suggestions.map((s) => ({
    //   request_id: request_record.id,
    //   wine_id: s.wine.id,
    //   motivering: s.motivering,
    //   ranking_score: s.ranking_score,
    // }));
    // const { error: suggestionsError } = await supabase
    //   .from('suggestions')
    //   .insert(suggestionsToSave);

    // 6. Returnera förslag (för MVP-test utan DB-save)
    return NextResponse.json({
      request_id: mock_request_id,
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
