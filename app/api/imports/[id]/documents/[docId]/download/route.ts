import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STORAGE_BUCKET = 'documents';
const SIGNED_URL_EXPIRES_IN = 300; // 5 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const { id: importId, docId: documentId } = params;
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
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
