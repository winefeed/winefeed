import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STORAGE_BUCKET = 'documents';
const SIGNED_URL_EXPIRES_IN = 300; // 5 minutes

/**
 * GET /api/imports/[id]/documents/[docId]/download
 *
 * Download import document
 * REQUIRES: IOR, SELLER, or ADMIN role
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; docId: string }> }
) {
  const params = await props.params;
  try {
    const { id: importId, docId: documentId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must have IOR, SELLER, or ADMIN role to download import documents
    if (!actorService.hasRole(actor, 'ADMIN') &&
        !actorService.hasRole(actor, 'IOR') &&
        !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 1. Verify import case exists and belongs to tenant
    const { data: importCase, error: importError } = await supabase
      .from('imports')
      .select('id')
      .eq('id', importId)
      .eq('tenant_id', tenantId)
      .single();

    if (importError || !importCase) {
      return NextResponse.json(
        { error: 'Import case not found' },
        { status: 404 }
      );
    }

    // 2. Fetch document and verify tenant + import match
    const { data: document, error: docError } = await supabase
      .from('import_documents')
      .select('id, storage_path, type, version')
      .eq('id', documentId)
      .eq('import_id', importId)
      .eq('tenant_id', tenantId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found or access denied' },
        { status: 404 }
      );
    }

    // 3. Create signed URL from Supabase Storage
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRES_IN);

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL:', signedUrlError);
      return NextResponse.json(
        { error: 'Failed to generate download link', details: signedUrlError?.message },
        { status: 500 }
      );
    }

    // 4. Return signed URL
    return NextResponse.json(
      {
        url: signedUrlData.signedUrl,
        expires_in: SIGNED_URL_EXPIRES_IN,
        document: {
          id: document.id,
          type: document.type,
          version: document.version
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error generating download URL:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
