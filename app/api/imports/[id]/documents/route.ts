import { NextRequest, NextResponse } from 'next/server';
import { importDocumentService } from '@/lib/import-document-service';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STORAGE_BUCKET = 'documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * GET /api/imports/[id]/documents
 *
 * List documents for import case
 * REQUIRES: IOR, SELLER, or ADMIN role
 */
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

    // Must have IOR, SELLER, or ADMIN role to list import documents
    if (!actorService.hasRole(actor, 'ADMIN') &&
        !actorService.hasRole(actor, 'IOR') &&
        !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // List all documents for this import case
    const documents = await importDocumentService.listDocuments(importId, tenantId);

    // Get document requirements
    const { data: requirements } = await supabase
      .from('import_document_requirements')
      .select('document_type, document_name, is_required_now, is_satisfied, latest_document_status')
      .eq('import_id', importId);

    return NextResponse.json(
      {
        import_id: importId,
        documents,
        requirements: requirements || [],
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

/**
 * POST /api/imports/[id]/documents
 *
 * Upload a document for import case
 * REQUIRES: IOR or ADMIN role
 *
 * Body (multipart/form-data):
 * - file: File (required)
 * - type: string (document type code, required)
 * - notes: string (optional)
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: importId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Only IOR or ADMIN can upload documents
    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'IOR')) {
      return NextResponse.json({ error: 'Only importers can upload documents' }, { status: 403 });
    }

    // Verify import exists and belongs to tenant
    const { data: importCase, error: importError } = await supabase
      .from('imports')
      .select('id, status, importer_id')
      .eq('id', importId)
      .eq('tenant_id', tenantId)
      .single();

    if (importError || !importCase) {
      return NextResponse.json({ error: 'Import case not found' }, { status: 404 });
    }

    // Verify actor has access to this import (their importer_id matches)
    if (!actorService.hasRole(actor, 'ADMIN') && actor.importer_id !== importCase.importer_id) {
      return NextResponse.json({ error: 'Not authorized for this import case' }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('type') as string | null;
    const notes = formData.get('notes') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing required field: file' }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json({ error: 'Missing required field: type' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate document type exists
    const { data: docType, error: docTypeError } = await supabase
      .from('import_document_types')
      .select('code, name_sv, required_for_status')
      .eq('code', documentType)
      .eq('is_active', true)
      .single();

    if (docTypeError || !docType) {
      return NextResponse.json({ error: `Invalid document type: ${documentType}` }, { status: 400 });
    }

    // Get file buffer and calculate hash
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Determine next version for this document type
    const { data: existingDocs } = await supabase
      .from('import_documents')
      .select('version')
      .eq('import_id', importId)
      .eq('tenant_id', tenantId)
      .eq('type', documentType)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existingDocs && existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;

    // Generate storage path
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const storagePath = `documents/${tenantId}/imports/${importId}/${documentType.toLowerCase()}/v${nextVersion}.${fileExtension}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Check if this document type is required for current status
    const isRequired = docType.required_for_status?.includes(importCase.status) || false;

    // Insert document record
    const { data: document, error: insertError } = await supabase
      .from('import_documents')
      .insert({
        tenant_id: tenantId,
        import_id: importId,
        type: documentType,
        version: nextVersion,
        storage_path: storagePath,
        sha256: fileHash,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        status: 'PENDING',
        is_required: isRequired,
        notes: notes || null,
        created_by: userId
      })
      .select()
      .single();

    if (insertError) {
      // Cleanup: delete uploaded file
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: `Failed to save document record: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        document: {
          id: document.id,
          type: document.type,
          type_name: docType.name_sv,
          version: document.version,
          file_name: document.file_name,
          status: document.status,
          is_required: document.is_required,
          created_at: document.created_at
        },
        message: `Dokument "${docType.name_sv}" uppladdad (version ${nextVersion})`
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
