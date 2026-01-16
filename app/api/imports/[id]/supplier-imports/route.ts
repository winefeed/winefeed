import { NextRequest, NextResponse } from 'next/server';
import { importService } from '@/lib/import-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: importId } = params;
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
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
