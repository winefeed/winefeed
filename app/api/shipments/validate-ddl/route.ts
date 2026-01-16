/**
 * POST /api/shipments/validate-ddl
 *
 * Validate DDL for under-suspension shipment (GATING LOGIC)
 *
 * Critical business rule:
 * Shipments "under suspension" (EMCS) can ONLY be delivered to restaurants
 * with DDL status = APPROVED for that importer + delivery address.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDDLService } from '@/lib/compliance/ddl-service';
import { ValidateDDLForShipmentRequest } from '@/lib/compliance/types';

export async function POST(request: NextRequest) {
  try {
    // Get tenant context
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 401 }
      );
    }

    // Parse request
    const body: ValidateDDLForShipmentRequest = await request.json();

    // Validate required fields
    if (!body.restaurant_id) {
      return NextResponse.json(
        { error: 'restaurant_id required' },
        { status: 400 }
      );
    }

    if (!body.importer_id) {
      return NextResponse.json(
        { error: 'importer_id required' },
        { status: 400 }
      );
    }

    if (
      !body.delivery_address ||
      !body.delivery_address.line1 ||
      !body.delivery_address.postal_code ||
      !body.delivery_address.city
    ) {
      return NextResponse.json(
        { error: 'Complete delivery_address required (line1, postal_code, city)' },
        { status: 400 }
      );
    }

    // Validate DDL
    const ddlService = createDDLService();
    const result = await ddlService.validateForShipment(
      body.restaurant_id,
      body.importer_id,
      body.delivery_address,
      tenantId
    );

    // Return result
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Validate DDL error:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
