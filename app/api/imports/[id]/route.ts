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

    const importCase = await importService.getImportCase(importId, tenantId);

    if (!importCase) {
      return NextResponse.json({ error: 'Import case not found' }, { status: 404 });
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
