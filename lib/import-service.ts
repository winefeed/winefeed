import { createClient } from '@supabase/supabase-js';
import {
  validateImportTransition,
  ImportStatus,
  InvalidStatusTransitionError,
  getAllowedTransitions,
} from './state-machine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface CreateImportCaseInput {
  tenant_id: string;
  restaurant_id: string;
  importer_id: string;
  delivery_location_id: string;
  supplier_id: string | null;
  created_by: string | null;
}

export interface SetImportStatusInput {
  import_id: string;
  tenant_id: string;
  to_status: string;
  changed_by: string;
  note: string | null;
}

export interface AttachSupplierImportInput {
  import_id: string;
  supplier_import_id: string;
  tenant_id: string;
}

class ImportService {
  async createImportCase(input: CreateImportCaseInput) {
    const { data, error } = await supabase
      .from('imports')
      .insert({
        tenant_id: input.tenant_id,
        restaurant_id: input.restaurant_id,
        importer_id: input.importer_id,
        delivery_location_id: input.delivery_location_id,
        supplier_id: input.supplier_id,
        created_by: input.created_by,
        status: 'NOT_REGISTERED'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create import case: ${error.message}`);
    }

    return data;
  }

  async getImportCase(importId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('imports')
      .select(`
        *,
        restaurant:restaurants(id, name, contact_email, contact_phone),
        importer:importers(id, legal_name, org_number, contact_email),
        delivery_location:direct_delivery_locations(id, delivery_address_line1, postal_code, city, status),
        supplier:suppliers(id, namn, kontakt_email),
        status_events:import_status_events(*)
      `)
      .eq('id', importId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch import case: ${error.message}`);
    }

    return data;
  }

  async setImportStatus(input: SetImportStatusInput) {
    // 1. Get current import case
    const { data: importCase, error: fetchError } = await supabase
      .from('imports')
      .select('status')
      .eq('id', input.import_id)
      .eq('tenant_id', input.tenant_id)
      .single();

    if (fetchError) {
      throw new Error(`Import case not found: ${fetchError.message}`);
    }

    const fromStatus = importCase.status as ImportStatus;
    const toStatus = input.to_status as ImportStatus;

    // 2. Validate status transition using state machine
    try {
      validateImportTransition(fromStatus, toStatus);
    } catch (err) {
      if (err instanceof InvalidStatusTransitionError) {
        throw new Error(
          `Invalid transition: Cannot change status from ${fromStatus} to ${toStatus}. ` +
          `Allowed: [${err.allowedTransitions.join(', ') || 'none'}]`
        );
      }
      throw err;
    }

    // 3. Build update object with status-specific fields
    const updateData: Record<string, any> = {
      status: toStatus,
      updated_at: new Date().toISOString()
    };

    // Add timestamp fields based on status
    if (toStatus === 'SUBMITTED') {
      updateData.submitted_at = new Date().toISOString();
    } else if (toStatus === 'APPROVED') {
      updateData.approved_at = new Date().toISOString();
    } else if (toStatus === 'REJECTED') {
      updateData.rejected_at = new Date().toISOString();
    } else if (toStatus === 'CLEARED') {
      updateData.cleared_at = new Date().toISOString();
    } else if (toStatus === 'CLOSED') {
      updateData.closed_at = new Date().toISOString();
    }

    // 4. Update import status
    const { error: updateError } = await supabase
      .from('imports')
      .update(updateData)
      .eq('id', input.import_id)
      .eq('tenant_id', input.tenant_id);

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`);
    }

    // 5. Create status event (audit trail)
    const { error: eventError } = await supabase
      .from('import_status_events')
      .insert({
        tenant_id: input.tenant_id,
        import_id: input.import_id,
        from_status: fromStatus,
        to_status: toStatus,
        note: input.note,
        changed_by_user_id: input.changed_by
      });

    if (eventError) {
      console.error('Failed to create status event:', eventError);
      // Don't fail the request, just log
    }

    return {
      import_id: input.import_id,
      from_status: fromStatus,
      to_status: toStatus,
      allowed_next: getAllowedTransitions('import', toStatus),
      message: `Status changed from ${fromStatus} to ${toStatus}`
    };
  }

  async attachSupplierImport(input: AttachSupplierImportInput) {
    // 1. Verify import case exists and belongs to tenant
    const { data: importCase, error: importError } = await supabase
      .from('imports')
      .select('id')
      .eq('id', input.import_id)
      .eq('tenant_id', input.tenant_id)
      .single();

    if (importError) {
      throw new Error(`Import case not found or tenant mismatch`);
    }

    // 2. Verify supplier_import exists and belongs to same tenant
    const { data: supplierImport, error: supplierImportError } = await supabase
      .from('supplier_imports')
      .select('tenant_id')
      .eq('id', input.supplier_import_id)
      .single();

    if (supplierImportError) {
      throw new Error(`Supplier import not found`);
    }

    // 3. Verify tenant match (prevent cross-tenant attach)
    if (supplierImport.tenant_id !== input.tenant_id) {
      throw new Error(`Tenant mismatch: Cannot attach supplier import from different tenant`);
    }

    // 4. Update supplier_imports.import_id
    const { error: updateError } = await supabase
      .from('supplier_imports')
      .update({ import_id: input.import_id })
      .eq('id', input.supplier_import_id)
      .eq('tenant_id', input.tenant_id);

    if (updateError) {
      throw new Error(`Failed to attach supplier import: ${updateError.message}`);
    }
  }

  async getLinkedSupplierImports(importId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('supplier_imports')
      .select('*')
      .eq('import_id', importId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to fetch linked supplier imports: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get document requirements for an import case
   *
   * Returns which documents are required, which are satisfied,
   * and what's missing.
   */
  async getDocumentRequirements(importId: string, tenantId: string) {
    // Get requirements from the view
    const { data: requirements, error } = await supabase
      .from('import_document_requirements')
      .select('*')
      .eq('import_id', importId);

    if (error) {
      throw new Error(`Failed to fetch document requirements: ${error.message}`);
    }

    // Separate into required and optional
    const required = (requirements || []).filter(r => r.is_required_now);
    const optional = (requirements || []).filter(r => !r.is_required_now);

    // Check which required docs are missing
    const missing = required.filter(r => !r.is_satisfied);
    const pending = required.filter(r => r.latest_document_status === 'PENDING');

    return {
      all: requirements || [],
      required,
      optional,
      missing,
      pending,
      all_required_satisfied: missing.length === 0,
      has_pending_documents: pending.length > 0,
    };
  }

  /**
   * Check if import can transition to next status based on documents
   *
   * Returns true if all required documents for the target status are verified.
   */
  async canTransitionWithDocuments(
    importId: string,
    tenantId: string,
    toStatus: ImportStatus
  ): Promise<{ canTransition: boolean; reason?: string; missingDocs?: string[] }> {
    // Get document types required for target status
    const { data: docTypes, error } = await supabase
      .from('import_document_types')
      .select('code, name_sv, required_for_status')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch document types: ${error.message}`);
    }

    // Filter to docs required for target status
    const requiredTypes = (docTypes || [])
      .filter(dt => dt.required_for_status?.includes(toStatus))
      .map(dt => ({ code: dt.code, name: dt.name_sv }));

    if (requiredTypes.length === 0) {
      // No document requirements for this status
      return { canTransition: true };
    }

    // Check which are verified
    const { data: verifiedDocs, error: docsError } = await supabase
      .from('import_documents')
      .select('type')
      .eq('import_id', importId)
      .eq('tenant_id', tenantId)
      .eq('status', 'VERIFIED');

    if (docsError) {
      throw new Error(`Failed to check document status: ${docsError.message}`);
    }

    const verifiedTypes = new Set((verifiedDocs || []).map(d => d.type));
    const missingDocs = requiredTypes
      .filter(rt => !verifiedTypes.has(rt.code))
      .map(rt => rt.name);

    if (missingDocs.length > 0) {
      return {
        canTransition: false,
        reason: `Saknade verifierade dokument: ${missingDocs.join(', ')}`,
        missingDocs,
      };
    }

    return { canTransition: true };
  }
}

export const importService = new ImportService();
