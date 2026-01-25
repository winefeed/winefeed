import { NextRequest, NextResponse } from 'next/server';
import { importDocumentService } from '@/lib/import-document-service';
import { actorService } from '@/lib/actor-service';

/**
 * GET /api/imports/[id]/documents
 *
 * List documents for import case
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

    // Must have IOR, SELLER, or ADMIN role to list import documents
    if (!actorService.hasRole(actor, 'ADMIN') &&
        !actorService.hasRole(actor, 'IOR') &&
        !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
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
