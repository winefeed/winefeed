import { NextRequest, NextResponse } from 'next/server';
import { importDocumentService } from '@/lib/import-document-service';

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

    // List all documents for this import case
    const documents = await importDocumentService.listDocuments(importId, tenantId);

    return NextResponse.json(
      {
        import_id: importId,
        documents,
        count: documents.length
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error listing documents:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
