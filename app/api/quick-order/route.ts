import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { runMatchingAgentPipeline } from '@/lib/matching-agent/pipeline';
import { buildSommelierContext } from '@/lib/sommelier-context';
import { createRouteClients } from '@/lib/supabase/route-client';
import { callClaude } from '@/lib/ai/claude';

/**
 * POST /api/quick-order
 *
 * Snabbbeställning: Tar fritext, tolkar med AI, skapar förfrågan,
 * kör matchning och returnerar resultat (användaren väljer viner innan dispatch).
 */
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

    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'RESTAURANT')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { adminClient } = await createRouteClients();
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return NextResponse.json(
        { error: 'Skriv minst 5 tecken för att beskriva din beställning' },
        { status: 400 }
      );
    }

    // Step 1: Parse free text with AI
    const parsePrompt = `Tolka denna vinbeställning från en restaurang. Extrahera följande fält om de finns:
- wine_type: typ av vin (red/white/sparkling/rose/orange/alcohol_free) eller null
- description: kort beskrivning av vad de söker
- quantity: antal flaskor (nummer) eller null
- budget_max: max budget per flaska i SEK (nummer) eller null
- delivery_city: leveransort eller null
- delivery_time: leveranstid (this_week/two_weeks/flexible) eller null
- country: land/region om nämnt eller null
- grape: druva om nämnd eller null

Svara ENBART med giltig JSON, inget annat.

Beställning: "${text.trim()}"`;

    let parsed: {
      wine_type?: string;
      description?: string;
      quantity?: number;
      budget_max?: number;
      delivery_city?: string;
      delivery_time?: string;
      country?: string;
      grape?: string;
    } = {};

    try {
      const aiResponse = await callClaude(parsePrompt, 500);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('AI parse failed, using raw text:', parseError);
      parsed = { description: text.trim() };
    }

    // Step 2: Resolve restaurant
    let restaurantId = actor.restaurant_id;

    if (!restaurantId) {
      if (actorService.hasRole(actor, 'ADMIN')) {
        const { data: fallbackRow } = await adminClient
          .from('restaurants')
          .select('id')
          .limit(1)
          .single();
        restaurantId = fallbackRow?.id || null;
        if (!restaurantId) {
          return NextResponse.json(
            { error: 'Ingen restaurang finns i systemet.' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Du måste vara kopplad till en restaurang' },
          { status: 400 }
        );
      }
    }

    // Step 3: Save request to database
    const effectiveBudgetMax = parsed.budget_max || 500;
    const { data: savedRequest, error: requestError } = await adminClient
      .from('requests')
      .insert({
        restaurant_id: restaurantId,
        fritext: text.trim(),
        budget_per_flaska: effectiveBudgetMax,
        antal_flaskor: parsed.quantity || null,
        leverans_senast: null,
        specialkrav: null,
        status: 'OPEN',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (requestError || !savedRequest) {
      console.error('Failed to save quick-order request:', requestError);
      return NextResponse.json(
        { error: 'Kunde inte spara förfrågan' },
        { status: 500 }
      );
    }

    const requestId = savedRequest.id;

    // Step 4: Run matching pipeline
    const sommelierCtx = await buildSommelierContext(restaurantId!, tenantId);

    const result = await runMatchingAgentPipeline({
      fritext: parsed.description || text.trim(),
      structuredFilters: {
        color: parsed.wine_type || undefined,
        budget_max: effectiveBudgetMax,
        country: parsed.country || undefined,
        grape: parsed.grape || undefined,
        antal_flaskor: parsed.quantity || undefined,
        leverans_ort: parsed.delivery_city || undefined,
      },
      restaurantContext: sommelierCtx.promptContext || undefined,
    });

    // Step 5: Build suggestions (same format as /api/suggest)
    const suggestions = result.wines.map((sw) => {
      const wine = sw.wine;
      const supplier = result.suppliersMap[wine.supplier_id];
      return {
        wine: {
          id: wine.id,
          namn: wine.name,
          producent: wine.producer,
          land: wine.country,
          region: wine.region,
          appellation: wine.appellation,
          druva: wine.grape,
          color: wine.color,
          argang: wine.vintage,
          pris_sek: wine.price_ex_vat_sek ? Math.round(wine.price_ex_vat_sek / 100) : 0,
          alkohol: wine.alcohol_pct,
          volym_ml: wine.bottle_size_ml,
          beskrivning: wine.description,
          sku: wine.sku,
          lager: wine.stock_qty,
          moq: wine.moq,
          kartong: wine.case_size,
          ledtid_dagar: wine.lead_time_days,
        },
        supplier: supplier ? {
          id: supplier.id,
          namn: supplier.namn,
          kontakt_email: supplier.kontakt_email,
          min_order_bottles: supplier.min_order_bottles,
          provorder_enabled: supplier.provorder_enabled,
          provorder_fee_sek: supplier.provorder_fee_sek,
        } : {
          namn: 'Okänd leverantör',
          kontakt_email: null,
          provorder_enabled: false,
          provorder_fee_sek: 500,
        },
        motivering: wine.description || 'Ett utmärkt val för din restaurang.',
        ranking_score: sw.score / 100,
      };
    });

    return NextResponse.json({
      success: true,
      request_id: requestId,
      suggestions,
      parsed,
    });
  } catch (error: any) {
    console.error('Error in /api/quick-order:', error);
    return NextResponse.json(
      { error: 'Något gick fel', details: error?.message },
      { status: 500 }
    );
  }
}
