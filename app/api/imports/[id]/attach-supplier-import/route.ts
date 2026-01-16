import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/import-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: importId } = params;
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
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
