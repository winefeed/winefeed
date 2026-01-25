import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/import-service';
import { actorService } from '@/lib/actor-service';

/**
 * GET /api/imports/[id]
 *
 * Get import case details
 * REQUIRES: IOR, SELLER, or ADMIN role
 */
export async function GET(
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

    // Must have IOR, SELLER, or ADMIN role to view imports
    if (!actorService.hasRole(actor, 'ADMIN') &&
        !actorService.hasRole(actor, 'IOR') &&
        !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const importCase = await importService.getImportCase(importId, tenantId);

    if (!importCase) {
      return NextResponse.json({ error: 'Import case not found' }, { status: 404 });
    }

    // Additional ownership check for non-admins
    if (!actorService.hasRole(actor, 'ADMIN')) {
      // IOR users can only see imports they manage
      if (actorService.hasRole(actor, 'IOR') && importCase.importer_of_record_id !== actor.importer_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      // Sellers can only see imports related to their orders
      if (actorService.hasRole(actor, 'SELLER') && importCase.supplier_id !== actor.supplier_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json(importCase, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching import case:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
