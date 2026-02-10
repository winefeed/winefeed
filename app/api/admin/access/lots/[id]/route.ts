/**
 * /api/admin/access/lots/[id]
 *
 * PUT    — Update a lot
 * DELETE — Soft-delete a lot (sets available=false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireVinkollAdmin } from '@/lib/access-admin-guard';
import { updateLot, deleteLot } from '@/lib/access-service';

export async function PUT(
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

    const input: Record<string, unknown> = {};
    if (body.importer_id !== undefined) input.importer_id = body.importer_id || null;
    if (body.note_public !== undefined) input.note_public = body.note_public || null;
    if (body.note_private !== undefined) input.note_private = body.note_private || null;
    if (body.price_sek !== undefined) input.price_sek = body.price_sek !== null ? Number(body.price_sek) : null;
    if (body.min_quantity !== undefined) input.min_quantity = Number(body.min_quantity);
    if (body.contact_email !== undefined) input.contact_email = body.contact_email || null;
    if (body.available !== undefined) input.available = body.available;

    const lot = await updateLot(id, input as any);

    return NextResponse.json({ lot });
  } catch (error: any) {
    console.error('Lot update error:', error);
    return NextResponse.json(
      { error: 'Failed to update lot', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireVinkollAdmin();
    if (guard.error) return guard.error;

    const { id } = await params;
    await deleteLot(id);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Lot delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete lot', message: error.message },
      { status: 500 }
    );
  }
}
