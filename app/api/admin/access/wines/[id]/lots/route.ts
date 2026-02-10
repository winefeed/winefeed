/**
 * /api/admin/access/wines/[id]/lots
 *
 * GET  — List lots for a wine
 * POST — Create a new lot for a wine
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireVinkollAdmin } from '@/lib/access-admin-guard';
import { getLotsByWineId, createLot } from '@/lib/access-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireVinkollAdmin();
    if (guard.error) return guard.error;

    const { id } = await params;
    const lots = await getLotsByWineId(id);

    return NextResponse.json({ lots });
  } catch (error: any) {
    console.error('Lots fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lots', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireVinkollAdmin();
    if (guard.error) return guard.error;

    const { id } = await params;
    const body = await request.json();

    // Validate
    const errors: string[] = [];
    if (body.price_sek !== undefined && body.price_sek !== null) {
      if (isNaN(Number(body.price_sek)) || Number(body.price_sek) < 0) errors.push('price_sek måste vara >= 0');
    }
    if (body.min_quantity !== undefined) {
      if (isNaN(Number(body.min_quantity)) || Number(body.min_quantity) < 1) errors.push('min_quantity måste vara >= 1');
    }
    if (errors.length) {
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
    }

    const lot = await createLot({
      wine_id: id,
      importer_id: body.importer_id || null,
      note_public: body.note_public || null,
      note_private: body.note_private || null,
      price_sek: body.price_sek !== undefined && body.price_sek !== null ? Number(body.price_sek) : null,
      min_quantity: body.min_quantity ? Number(body.min_quantity) : 1,
      contact_email: body.contact_email || null,
      available: body.available !== undefined ? body.available : true,
    });

    return NextResponse.json({ lot }, { status: 201 });
  } catch (error: any) {
    console.error('Lot create error:', error);
    return NextResponse.json(
      { error: 'Failed to create lot', message: error.message },
      { status: 500 }
    );
  }
}
