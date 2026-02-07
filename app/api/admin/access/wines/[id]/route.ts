/**
 * /api/admin/access/wines/[id]
 *
 * GET    — Public wine detail with available lots + importer info
 * PUT    — Update wine (requires auth)
 * DELETE — Archive wine (requires auth, soft delete → status='ARCHIVED')
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWineById, updateWine, archiveWine } from '@/lib/access-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wine = await getWineById(id);

    if (!wine) {
      return NextResponse.json(
        { error: 'Wine not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(wine);
  } catch (error: any) {
    console.error('Wine detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wine', message: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate fields that are provided
    const errors: string[] = [];
    if (body.name !== undefined && !body.name?.trim()) errors.push('name cannot be empty');
    if (body.wine_type !== undefined && !body.wine_type?.trim()) errors.push('wine_type cannot be empty');
    if (body.country !== undefined && !body.country?.trim()) errors.push('country cannot be empty');
    if (body.region !== undefined && !body.region?.trim()) errors.push('region cannot be empty');
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
    if (errors.length) {
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
    }

    const wine = await updateWine(id, {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.wine_type !== undefined && { wine_type: body.wine_type }),
      ...(body.vintage !== undefined && { vintage: body.vintage !== null ? Number(body.vintage) : null }),
      ...(body.country !== undefined && { country: body.country }),
      ...(body.region !== undefined && { region: body.region }),
      ...(body.grape !== undefined && { grape: body.grape || null }),
      ...(body.appellation !== undefined && { appellation: body.appellation || null }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.price_sek !== undefined && { price_sek: body.price_sek !== null ? Number(body.price_sek) : null }),
      ...(body.image_url !== undefined && { image_url: body.image_url || null }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.producer_id !== undefined && { producer_id: body.producer_id || null }),
    });

    return NextResponse.json({ wine });
  } catch (error: any) {
    console.error('Wine update error:', error);
    return NextResponse.json(
      { error: 'Failed to update wine', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const wine = await archiveWine(id);

    return NextResponse.json({ wine });
  } catch (error: any) {
    console.error('Wine archive error:', error);
    return NextResponse.json(
      { error: 'Failed to archive wine', message: error.message },
      { status: 500 }
    );
  }
}
