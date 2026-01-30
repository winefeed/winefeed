/**
 * IMPORT DOCUMENT API - Individual Document Operations
 *
 * GET /api/imports/[id]/documents/[docId]
 * Get single document details
 *
 * PATCH /api/imports/[id]/documents/[docId]
 * Update document status (verify/reject)
 *
 * DELETE /api/imports/[id]/documents/[docId]
 * Delete a document (only PENDING documents)
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STORAGE_BUCKET = 'documents';

/**
 * GET /api/imports/[id]/documents/[docId]
 *
 * Get single document details
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; docId: string }> }
) {
  const params = await props.params;
  try {
    const { id: importId, docId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must have IOR, SELLER, or ADMIN role
    if (!actorService.hasAnyRole(actor, ['ADMIN', 'IOR', 'SELLER'])) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch document with type info
    const { data: document, error } = await supabase
      .from('import_documents')
      .select(`
        *,
        document_type:import_document_types!type(name_sv, name_en, description)
      `)
      .eq('id', docId)
      .eq('import_id', importId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ document }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/imports/[id]/documents/[docId]
 *
 * Update document status
 *
 * Actions:
 * - 'submit_for_review': IOR marks document ready for admin review (PENDING → SUBMITTED_FOR_REVIEW)
 * - 'verify': ADMIN verifies document (PENDING/SUBMITTED_FOR_REVIEW → VERIFIED)
 * - 'reject': ADMIN rejects document (PENDING/SUBMITTED_FOR_REVIEW → REJECTED)
 *
 * Body:
 * - action: 'submit_for_review' | 'verify' | 'reject' (required)
 * - rejection_reason: string (required if action = 'reject')
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string; docId: string }> }
) {
  const params = await props.params;
  try {
    const { id: importId, docId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    const body = await request.json();
    const { action, rejection_reason } = body;

    if (!action || !['submit_for_review', 'verify', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "submit_for_review", "verify", or "reject"' },
        { status: 400 }
      );
    }

    // Authorization based on action
    if (action === 'submit_for_review') {
      // IOR or ADMIN can submit for review
      if (!actorService.hasAnyRole(actor, ['IOR', 'ADMIN'])) {
        return NextResponse.json(
          { error: 'Only importers can submit documents for review' },
          { status: 403 }
        );
      }
    } else {
      // Only ADMIN can verify/reject
      if (!actorService.hasRole(actor, 'ADMIN')) {
        return NextResponse.json(
          { error: 'Only administrators can verify or reject documents' },
          { status: 403 }
        );
      }
    }

    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json(
        { error: 'rejection_reason is required when rejecting a document' },
        { status: 400 }
      );
    }

    // Fetch current document
    const { data: document, error: fetchError } = await supabase
      .from('import_documents')
      .select('id, status, type, import_id')
      .eq('id', docId)
      .eq('import_id', importId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Validate status transitions
    const validFromStatuses: Record<string, string[]> = {
      submit_for_review: ['PENDING'],
      verify: ['PENDING', 'SUBMITTED_FOR_REVIEW'],
      reject: ['PENDING', 'SUBMITTED_FOR_REVIEW'],
    };

    if (!validFromStatuses[action].includes(document.status)) {
      return NextResponse.json(
        {
          error: `Cannot ${action} document with status "${document.status}". ` +
            `Allowed statuses: ${validFromStatuses[action].join(', ')}`
        },
        { status: 400 }
      );
    }

    // Build update object based on action
    const updateData: Record<string, any> = {};

    if (action === 'submit_for_review') {
      updateData.status = 'SUBMITTED_FOR_REVIEW';
      updateData.submitted_for_review_at = new Date().toISOString();
      updateData.submitted_for_review_by = userId;
    } else if (action === 'verify') {
      updateData.status = 'VERIFIED';
      updateData.verified_by = userId;
      updateData.verified_at = new Date().toISOString();
    } else if (action === 'reject') {
      updateData.status = 'REJECTED';
      updateData.verified_by = userId;
      updateData.verified_at = new Date().toISOString();
      updateData.rejection_reason = rejection_reason;
    }

    // Update document
    const { data: updatedDocument, error: updateError } = await supabase
      .from('import_documents')
      .update(updateData)
      .eq('id', docId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating document:', updateError);
      return NextResponse.json(
        { error: `Failed to ${action} document: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Get document type name for response
    const { data: docType } = await supabase
      .from('import_document_types')
      .select('name_sv')
      .eq('code', document.type)
      .single();

    const messages: Record<string, string> = {
      submit_for_review: `Dokument "${docType?.name_sv || document.type}" skickat för granskning`,
      verify: `Dokument "${docType?.name_sv || document.type}" verifierat`,
      reject: `Dokument "${docType?.name_sv || document.type}" avvisat: ${rejection_reason}`,
    };

    return NextResponse.json(
      {
        success: true,
        document: updatedDocument,
        message: messages[action],
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/imports/[id]/documents/[docId]
 *
 * Delete a document
 * REQUIRES: IOR or ADMIN role
 *
 * Guards:
 * - Cannot delete VERIFIED documents (unless ADMIN)
 * - Cannot delete last verified required document for current import status
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; docId: string }> }
) {
  const params = await props.params;
  try {
    const { id: importId, docId } = params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Only IOR or ADMIN can delete documents
    if (!actorService.hasAnyRole(actor, ['ADMIN', 'IOR'])) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch current document with import info
    const { data: document, error: fetchError } = await supabase
      .from('import_documents')
      .select('id, status, storage_path, type, import_id, is_required')
      .eq('id', docId)
      .eq('import_id', importId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Guard: Cannot delete VERIFIED documents (unless ADMIN with explicit override)
    if (document.status === 'VERIFIED') {
      // Check if this is the last verified document of this required type
      const { data: importCase } = await supabase
        .from('imports')
        .select('status')
        .eq('id', importId)
        .single();

      // Check if this doc type is required for current status
      const { data: docType } = await supabase
        .from('import_document_types')
        .select('required_for_status')
        .eq('code', document.type)
        .single();

      const isRequiredForCurrentStatus = docType?.required_for_status?.includes(importCase?.status);

      if (isRequiredForCurrentStatus) {
        // Count other verified docs of this type
        const { count } = await supabase
          .from('import_documents')
          .select('id', { count: 'exact', head: true })
          .eq('import_id', importId)
          .eq('tenant_id', tenantId)
          .eq('type', document.type)
          .eq('status', 'VERIFIED')
          .neq('id', docId);

        if (count === 0) {
          return NextResponse.json(
            {
              error: 'Kan inte radera: detta är det enda verifierade dokumentet av denna typ som krävs för nuvarande status. ' +
                'Ladda upp ett nytt dokument först.',
              code: 'LAST_VERIFIED_REQUIRED_DOC'
            },
            { status: 400 }
          );
        }
      }

      // Even if not last required, only ADMIN can delete verified docs
      if (!actorService.hasRole(actor, 'ADMIN')) {
        return NextResponse.json(
          { error: 'Endast administratörer kan radera verifierade dokument.' },
          { status: 403 }
        );
      }
    }

    // Delete from storage
    if (document.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([document.storage_path]);

      if (storageError) {
        console.warn('Failed to delete file from storage:', storageError);
        // Continue anyway - database record is more important
      }
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('import_documents')
      .delete()
      .eq('id', docId)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      console.error('Error deleting document:', deleteError);
      return NextResponse.json(
        { error: `Failed to delete document: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Dokument raderat'
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
