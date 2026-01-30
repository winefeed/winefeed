import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/import-service';
import { actorService } from '@/lib/actor-service';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: importId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Only IOR, SELLER, or ADMIN can view linked supplier imports
    if (!actorService.hasRole(actor, 'ADMIN') &&
        !actorService.hasRole(actor, 'IOR') &&
        !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supplierImports = await importService.getLinkedSupplierImports(importId, tenantId);

    return NextResponse.json({ import_id: importId, supplier_imports: supplierImports }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching linked supplier imports:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
