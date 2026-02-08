/**
 * /api/admin/access/wines
 *
 * GET  — Public wine search. Params: q, type, country, region, grape, page, limit
 *        Also supports admin mode: admin=1&status=DRAFT (requires auth)
 * POST — Create wine (requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchWines, searchWinesAdmin, createWine, getWineFilters, getProducers, getOrCreateProducer } from '@/lib/access-service';
import type { WineStatus } from '@/lib/access-types';

function validateWineInput(body: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  if (!body.name?.trim()) errors.push('name required');
  if (!body.wine_type?.trim()) errors.push('wine_type required');
  if (!body.country?.trim()) errors.push('country required');
  if (!body.region?.trim()) errors.push('region required');
  if (body.vintage !== null && body.vintage !== undefined) {
    const v = Number(body.vintage);
    if (isNaN(v) || v < 1900 || v > 2099) errors.push('vintage must be 1900-2099 or null');
  }
  if (body.price_sek !== null && body.price_sek !== undefined) {
    if (isNaN(Number(body.price_sek)) || Number(body.price_sek) < 0) errors.push('price_sek must be >= 0');
  }
  if (body.status && !['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(body.status)) {
    errors.push('status must be DRAFT, ACTIVE, or ARCHIVED');
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const isAdmin = searchParams.get('admin') === '1';

    if (isAdmin) {
      // Admin mode: requires auth
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const [result, producers] = await Promise.all([
        searchWinesAdmin({
          q: searchParams.get('q') || undefined,
          status: (searchParams.get('status') as WineStatus) || undefined,
          limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
          offset: parseInt(searchParams.get('offset') || '0'),
        }),
        getProducers(),
      ]);

      return NextResponse.json({ ...result, producers });
    }

    // Public mode
    const params = {
      q: searchParams.get('q') || undefined,
      type: searchParams.get('type') || undefined,
      country: searchParams.get('country') || undefined,
      region: searchParams.get('region') || undefined,
      grape: searchParams.get('grape') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 50),
    };

    const [result, filters] = await Promise.all([
      searchWines(params),
      getWineFilters(),
    ]);

    return NextResponse.json({ ...result, filters });
  } catch (error: any) {
    console.error('Wine search error:', error);
    return NextResponse.json(
      { error: 'Failed to search wines', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateWineInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Validation failed', errors: validation.errors }, { status: 400 });
    }

    // Resolve producer: name → id (lookup or create)
    let producerId = body.producer_id || null;
    if (!producerId && body.producer_name?.trim()) {
      producerId = await getOrCreateProducer(body.producer_name);
    }
    if (!producerId) {
      return NextResponse.json({ error: 'Validation failed', errors: ['Producent krävs'] }, { status: 400 });
    }

    const wine = await createWine({
      name: body.name,
      wine_type: body.wine_type,
      vintage: body.vintage !== null && body.vintage !== undefined ? Number(body.vintage) : null,
      country: body.country,
      region: body.region,
      grape: body.grape || null,
      appellation: body.appellation || null,
      description: body.description || null,
      price_sek: body.price_sek !== null && body.price_sek !== undefined ? Number(body.price_sek) : null,
      image_url: body.image_url || null,
      status: body.status || 'DRAFT',
      producer_id: producerId,
    });

    return NextResponse.json({ wine }, { status: 201 });
  } catch (error: any) {
    console.error('Wine create error:', error);
    return NextResponse.json(
      { error: 'Failed to create wine', errors: [error.message] },
      { status: 500 }
    );
  }
}
