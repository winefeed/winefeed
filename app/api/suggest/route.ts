import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { runMatchingAgentPipeline } from '@/lib/matching-agent/pipeline';
import { buildSommelierContext } from '@/lib/sommelier-context';
import { createRouteClients } from '@/lib/supabase/route-client';

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

    const { adminClient } = await createRouteClients();

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
        const { data: fallbackRow } = await adminClient
          .from('restaurants')
          .select('id')
          .limit(1)
          .single();
        const fallbackRestaurant = fallbackRow?.id || null;
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

    const { data: savedRequest, error: requestError } = await adminClient
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

    // Build sommelier context (restaurant profile + order history for personalization)
    const sommelierCtx = await buildSommelierContext(restaurantId!, tenantId);
    if (sommelierCtx.promptContext) {
      console.log('[Suggest] Sommelier context loaded:', {
        hasCuisine: !!sommelierCtx.profile?.cuisine_type?.length,
        hasSegment: !!sommelierCtx.profile?.price_segment,
        hasHistory: !!sommelierCtx.history,
      });
    }

    // Run Matching Agent pipeline (AI parse → lookup → smart query → pre-score → AI re-rank)
    const result = await runMatchingAgentPipeline({
      fritext: fritext || description || '',
      structuredFilters: {
        color,
        budget_min,
        budget_max: effectiveBudgetMax,
        country,
        grape,
        certifications: effectiveCertifications,
        antal_flaskor,
        leverans_ort,
      },
      restaurantContext: sommelierCtx.promptContext || undefined,
    });

    if (result.wines.length === 0) {
      return NextResponse.json({
        request_id,
        suggestions: [],
        message: 'Inga viner hittades som matchar dina kriterier. Prova att bredda sökningen.',
      });
    }

    // Build suggestions response — same format as before for results page compatibility
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
        ranking_score: sw.score / 100, // Normalize to 0-1 for compatibility
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
      total_matches: result.totalDbMatches,
      pipeline_timing: result.timing,
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

