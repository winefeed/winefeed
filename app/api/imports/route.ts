import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/import-service';

export async function POST(request: NextRequest) {
  try {
    // Extract tenant context from headers
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { restaurant_id, importer_id, delivery_location_id, supplier_id } = body;

    // Validate required fields
    if (!restaurant_id || !importer_id || !delivery_location_id) {
      return NextResponse.json(
        { error: 'Missing required fields: restaurant_id, importer_id, delivery_location_id' },
        { status: 400 }
      );
    }

    // Create import case
    const importCase = await importService.createImportCase({
      tenant_id: tenantId,
      restaurant_id,
      importer_id,
      delivery_location_id,
      supplier_id: supplier_id || null,
      created_by: userId
    });

    return NextResponse.json(importCase, { status: 201 });

  } catch (error: any) {
    console.error('Error creating import case:', error);

    if (error.message?.includes('Foreign key violation')) {
      return NextResponse.json(
        { error: 'Invalid reference: restaurant, importer, or delivery location not found' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
