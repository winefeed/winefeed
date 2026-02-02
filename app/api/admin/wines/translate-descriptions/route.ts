/**
 * ADMIN: Translate Wine Descriptions
 *
 * POST /api/admin/wines/translate-descriptions
 *
 * Translates all non-Swedish wine descriptions to Swedish.
 * Only accessible by ADMIN users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { translateToSwedish } from '@/lib/ai/translate';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Simple check if text is likely English (not Swedish)
function isLikelyEnglish(text: string): boolean {
  if (!text || text.length < 10) return false;

  const lowerText = text.toLowerCase();

  // Common English words that indicate non-Swedish
  const englishIndicators = [
    'the', 'and', 'with', 'for', 'from', 'this', 'that', 'which', 'notes',
    'flavors', 'aromas', 'finish', 'palate', 'cherry', 'raspberry', 'blackberry',
    'strawberry', 'apple', 'pear', 'vanilla', 'chocolate', 'coffee', 'spice',
    'herbs', 'flowers', 'tannins', 'acidity', 'sweetness', 'fruity', 'spicy',
    'elegant', 'full-bodied', 'light', 'fresh', 'dry', 'sweet', 'rich', 'soft',
    'bursting', 'vibrant', 'pure', 'easy', 'drinkability', 'refreshing',
    'lively', 'crisp', 'balanced', 'smooth', 'intense', 'complex',
  ];

  let englishScore = 0;
  for (const word of englishIndicators) {
    if (lowerText.includes(word)) englishScore++;
  }

  return englishScore >= 2;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all wines with descriptions
    const { data: wines, error: fetchError } = await supabase
      .from('supplier_wines')
      .select('id, description')
      .not('description', 'is', null)
      .neq('description', '');

    if (fetchError) {
      throw fetchError;
    }

    if (!wines || wines.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No wines with descriptions found',
        translated: 0
      });
    }

    // Filter to wines with likely English descriptions
    const winesToTranslate = wines.filter(w =>
      w.description && isLikelyEnglish(w.description)
    );

    if (winesToTranslate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All descriptions appear to be in Swedish already',
        total: wines.length,
        translated: 0
      });
    }

    let translatedCount = 0;
    const errors: string[] = [];

    // Translate each wine description
    for (const wine of winesToTranslate) {
      try {
        const translated = await translateToSwedish(wine.description);

        // Only update if translation is different
        if (translated && translated !== wine.description) {
          const { error: updateError } = await supabase
            .from('supplier_wines')
            .update({ description: translated })
            .eq('id', wine.id);

          if (updateError) {
            errors.push(`Wine ${wine.id}: ${updateError.message}`);
          } else {
            translatedCount++;
          }
        }
      } catch (err: any) {
        errors.push(`Wine ${wine.id}: ${err.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      success: true,
      total: wines.length,
      needsTranslation: winesToTranslate.length,
      translated: translatedCount,
      errors: errors.slice(0, 10),
    });

  } catch (error: any) {
    console.error('Error translating descriptions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
