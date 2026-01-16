import { NextRequest, NextResponse } from 'next/server';
import { importDocumentService } from '@/lib/import-document-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: importId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
    }

    // Generate 5369_03 document
    const result = await importDocumentService.generate5369(
      importId,
      tenantId,
      userId || undefined
    );

    return NextResponse.json(
      {
        document_id: result.document.id,
        type: result.document.type,
        version: result.document.version,
        sha256: result.document.sha256,
        storage_path: result.document.storage_path,
        created_at: result.document.created_at,
        message: `5369_03 document generated successfully (version ${result.version})`
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error generating 5369 document:', error);

    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Import case not found' },
        { status: 404 }
      );
    }

    if (error.message?.includes('upload')) {
      return NextResponse.json(
        { error: 'Failed to upload document to storage', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
