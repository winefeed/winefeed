/**
 * Sommelier Outreach Service
 *
 * Orchestrates: scan result → matching pipeline → email draft → send
 */

import { getSupabaseAdmin } from '../supabase-server';
import { buildOutreachInput } from './bridge';
import { runMatchingAgentPipeline } from '../matching-agent/pipeline';
import { renderWineRecommendationEmail } from '../email-templates';
import { sendEmail, WINEFEED_FROM } from '../email-service';
import { callClaude } from '../ai/claude';
import type { DishAnalysis } from '../food-scan/types';
import type { ScoredWine, SupplierWineRow } from '../matching-agent/types';

// ============================================================================
// Types
// ============================================================================

export interface RecommendationDraft {
  id: string;
  restaurantName: string;
  wines: RecommendedWine[];
  emailSubject: string;
  emailHtml: string;
  emailText: string;
  dominantStyles: string[];
}

export interface RecommendedWine {
  wineId: string;
  name: string;
  producer: string;
  grape: string | null;
  vintage: number | null;
  priceExVat: number;
  color: string | null;
  reason: string;
  matchedDishes: string[];
}

// ============================================================================
// Generate Recommendation
// ============================================================================

/**
 * Generate a wine recommendation draft from a food scan result.
 * 1. Fetch scan result
 * 2. Bridge dishes → matching input
 * 3. Run matching pipeline
 * 4. Generate AI reasons for each wine
 * 5. Render email
 * 6. Save as draft in wine_recommendations
 */
export async function generateRecommendation(scanResultId: string): Promise<RecommendationDraft> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch scan result
  const { data: scanResult, error: scanError } = await supabase
    .from('food_scan_results')
    .select('*')
    .eq('id', scanResultId)
    .single();

  if (scanError || !scanResult) {
    throw new Error(`Scan result not found: ${scanResultId}`);
  }

  const dishes: DishAnalysis[] = scanResult.dishes_json || [];
  const restaurantName: string = scanResult.restaurant_name;

  if (dishes.length === 0) {
    throw new Error('No dishes found in scan result');
  }

  // 2. Check if restaurant is an existing customer
  const restaurantId: string | null = scanResult.restaurant_id || null;
  let isExistingCustomer = false;
  if (restaurantId) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .single();
    isExistingCustomer = !!restaurant;
  }

  // 3. Bridge dishes → matching input
  const { matchingInput, dishSummary, dominantStyles } = buildOutreachInput(restaurantName, dishes);

  // 4. Run matching pipeline (uses existing pipeline unchanged)
  const result = await runMatchingAgentPipeline(matchingInput, {
    finalTopN: 6,
    preScoreTopN: 12,
  });

  if (result.wines.length === 0) {
    throw new Error('No wines matched — try with more scan data');
  }

  // 5. Build wine reasons + match dishes (use AI description if available, else generate)
  const wines = await buildWineReasons(result.wines, restaurantName, dishSummary, dishes);

  // 6. Render email template (cold vs warm variant)
  const email = renderWineRecommendationEmail({
    restaurantName,
    dishSummary,
    isExistingCustomer,
    wines: wines.map(w => ({
      name: w.name,
      producer: w.producer,
      grape: w.grape,
      vintage: w.vintage,
      priceExVat: w.priceExVat,
      reason: w.reason,
      matchedDishes: w.matchedDishes,
    })),
  });

  // 7. Save draft
  const { data: draft, error: insertError } = await supabase
    .from('wine_recommendations')
    .insert({
      scan_result_id: scanResultId,
      restaurant_name: restaurantName,
      recommended_wines: wines,
      email_subject: email.subject,
      email_html: email.html,
      email_text: email.text,
      dominant_styles: dominantStyles,
      status: 'draft',
    })
    .select('id')
    .single();

  if (insertError || !draft) {
    throw new Error(`Failed to save draft: ${insertError?.message}`);
  }

  return {
    id: draft.id,
    restaurantName,
    wines,
    emailSubject: email.subject,
    emailHtml: email.html,
    emailText: email.text,
    dominantStyles,
  };
}

// ============================================================================
// Send Recommendation
// ============================================================================

/**
 * Send a recommendation email (or update and send).
 */
export async function sendRecommendation(
  recommendationId: string,
  recipientEmail: string,
  editedSubject?: string,
  editedHtml?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch recommendation
  const { data: rec, error: fetchError } = await supabase
    .from('wine_recommendations')
    .select('*')
    .eq('id', recommendationId)
    .single();

  if (fetchError || !rec) {
    return { success: false, error: `Recommendation not found: ${recommendationId}` };
  }

  if (rec.status === 'sent') {
    return { success: false, error: 'Already sent' };
  }

  const subject = editedSubject || rec.email_subject;
  const html = editedHtml || rec.email_html;
  const text = rec.email_text;

  // 2. Send email
  const { success, error, resendId } = await sendEmail({
    to: recipientEmail,
    subject,
    html,
    text,
    from: WINEFEED_FROM,
  });

  // 3. Update status
  if (success) {
    await supabase
      .from('wine_recommendations')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        resend_id: resendId || null,
        recipient_email: recipientEmail,
        email_subject: subject,
        ...(editedHtml ? { email_html: html } : {}),
      })
      .eq('id', recommendationId);
  } else {
    await supabase
      .from('wine_recommendations')
      .update({ status: 'failed', recipient_email: recipientEmail })
      .eq('id', recommendationId);
  }

  return { success, error };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Match a wine to specific dishes from the menu based on color/region/grape overlap.
 */
function findMatchedDishes(wine: SupplierWineRow, dishes: DishAnalysis[]): string[] {
  const matched = dishes.filter(d => {
    if (!d.matched) return false;

    // Color match: wine color appears in dish's recommended colors
    const colorMatch = wine.color && d.colors.some(c =>
      c.toLowerCase() === wine.color!.toLowerCase()
    );

    // Region match: wine region appears in dish's recommended regions
    const regionMatch = wine.region && d.regions.some(r =>
      wine.region!.toLowerCase().includes(r.toLowerCase()) ||
      r.toLowerCase().includes(wine.region!.toLowerCase())
    );

    // Grape match: wine grape appears in dish's recommended grapes
    const grapeMatch = wine.grape && d.grapes.some(g =>
      wine.grape!.toLowerCase().includes(g.toLowerCase()) ||
      g.toLowerCase().includes(wine.grape!.toLowerCase())
    );

    return colorMatch && (regionMatch || grapeMatch);
  });

  // Return dish names, max 4
  return matched
    .slice(0, 4)
    .map(d => d.dish_name_original || d.dish_name);
}

/**
 * Build a per-wine reason from the AI re-rank description or generate one.
 */
async function buildWineReasons(
  scoredWines: ScoredWine[],
  restaurantName: string,
  dishSummary: string,
  dishes: DishAnalysis[],
): Promise<RecommendedWine[]> {
  const wines: RecommendedWine[] = [];

  for (const sw of scoredWines) {
    const w = sw.wine;
    const matchedDishes = findMatchedDishes(w, dishes);

    // Generate reason mentioning specific dishes
    const dishContext = matchedDishes.length > 0
      ? matchedDishes.join(', ')
      : dishSummary;

    let reason = '';

    // Generate a short reason with Claude Haiku
    try {
      reason = await callClaude(
        `Restaurang: "${restaurantName}"\n` +
        `Rätter: ${dishContext}\n` +
        `Vin: "${w.name}" från ${w.producer} (${w.grape || 'okänd druva'}, ${w.country})\n\n` +
        `Skriv EN mening på svenska som förklarar varför detta vin passar till dessa rätter. ` +
        `Nämn gärna specifika rätter från listan. Skriv naturlig, ledig svenska — inte översatt engelska. ` +
        `Svara ENBART med meningen.`,
        150,
        'Du är en svensk sommelier som skriver korta, naturliga vinrekommendationer på svenska. Du skriver ALLTID på svenska, aldrig engelska. Din ton är professionell men varm.',
      );
      reason = reason.trim();
    } catch {
      reason = `Passar bra till ${dishContext}`;
    }

    wines.push({
      wineId: w.id,
      name: w.name,
      producer: w.producer,
      grape: w.grape,
      vintage: w.vintage,
      priceExVat: w.price_ex_vat_sek,
      color: w.color,
      reason,
      matchedDishes,
    });
  }

  return wines;
}
