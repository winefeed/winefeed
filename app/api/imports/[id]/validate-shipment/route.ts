import { NextRequest, NextResponse } from 'next/server';
import { shipmentValidationService } from '@/lib/shipment-validation-service';
import { actorService } from '@/lib/actor-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: importId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Only IOR or ADMIN can validate shipments
    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'IOR')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Validate shipment readiness
    const result = await shipmentValidationService.validateForShipment(importId, tenantId);

    // Return validation result (200 regardless of valid/invalid)
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error('Error validating shipment:', error);

    // Handle "not found" as 404
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        {
          valid: false,
          error_code: 'IMPORT_NOT_FOUND',
          error_message: 'Importcase hittades inte.'
        },
        { status: 404 }
      );
    }

    // Other errors as 500
    return NextResponse.json(
      {
        valid: false,
        error_code: 'INTERNAL_ERROR',
        error_message: 'Ett internt fel uppstod vid validering.'
      },
      { status: 500 }
    );
  }
}
