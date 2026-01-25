import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/import-service';
import { actorService } from '@/lib/actor-service';

/**
 * POST /api/imports/[id]/attach-supplier-import
 *
 * Attach supplier import to import case
 * REQUIRES: IOR or ADMIN role
 */
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

    // Must have IOR or ADMIN role to attach supplier imports
    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'IOR')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { supplier_import_id } = body;

    if (!supplier_import_id) {
      return NextResponse.json(
        { error: 'Missing required field: supplier_import_id' },
        { status: 400 }
      );
    }

    await importService.attachSupplierImport({
      import_id: importId,
      supplier_import_id,
      tenant_id: tenantId
    });

    return NextResponse.json(
      { message: 'Supplier import attached successfully', import_id: importId, supplier_import_id },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error attaching supplier import:', error);

    if (error.message?.includes('Tenant mismatch')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
