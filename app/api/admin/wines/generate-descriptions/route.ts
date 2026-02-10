/**
 * ADMIN: Generate Wine Descriptions (AI)
 *
 * POST /api/admin/wines/generate-descriptions
 *
 * Generates Swedish wine descriptions using free AI models (OpenRouter).
 * Only accessible by ADMIN users.
 *
 * Body: { wine_ids?: string[], overwrite?: boolean }
 * - wine_ids: specific wines to generate for (optional, defaults to all without description)
 * - overwrite: replace existing descriptions (default: false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { generateWineDescription, WineForDescription } from '@/lib/ai/generate-description';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

    // Parse body
    const body = await request.json().catch(() => ({}));
    const { wine_ids, overwrite = false } = body as {
      wine_ids?: string[];
      overwrite?: boolean;
    };

    // Build query
    let query = supabase
      .from('supplier_wines')
      .select('id, namn, producent, land, region, druva, color, argang, alkohol, ekologisk, biodynamiskt, veganskt, description');

    if (wine_ids && wine_ids.length > 0) {
      query = query.in('id', wine_ids);
    }

    const { data: wines, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!wines || wines.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No wines found',
        total: 0,
        generated: 0,
        skipped: 0,
        errors: [],
      });
    }

    // Filter: skip wines that already have a description (unless overwrite)
    const winesToProcess = overwrite
      ? wines
      : wines.filter(w => !w.description || w.description.trim() === '');

    if (winesToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All wines already have descriptions',
        total: wines.length,
        generated: 0,
        skipped: wines.length,
        errors: [],
      });
    }

    let generatedCount = 0;
    let skippedCount = wines.length - winesToProcess.length;
    const errors: string[] = [];

    for (const wine of winesToProcess) {
      try {
        const description = await generateWineDescription(wine as WineForDescription);

        if (description) {
          const { error: updateError } = await supabase
            .from('supplier_wines')
            .update({ description })
            .eq('id', wine.id);

          if (updateError) {
            errors.push(`Wine ${wine.id}: ${updateError.message}`);
          } else {
            generatedCount++;
          }
        } else {
          skippedCount++;
        }
      } catch (err: any) {
        errors.push(`Wine ${wine.id}: ${err.message}`);
      }

      // Rate limit delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      success: true,
      total: wines.length,
      generated: generatedCount,
      skipped: skippedCount,
      errors: errors.slice(0, 10),
    });

  } catch (error: any) {
    console.error('Error generating descriptions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
