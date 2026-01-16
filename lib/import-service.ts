import { createClient } from '@supabase/supabase-js';

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

    const fromStatus = importCase.status;

    // 2. Validate status transition
    const validTransitions: Record<string, string[]> = {
      'NOT_REGISTERED': ['SUBMITTED'],
      'SUBMITTED': ['APPROVED', 'REJECTED'],
      'APPROVED': [],
      'REJECTED': ['SUBMITTED']
    };

    if (!validTransitions[fromStatus]?.includes(input.to_status)) {
      throw new Error(
        `Invalid transition: Cannot change status from ${fromStatus} to ${input.to_status}`
      );
    }

    // 3. Update import status
    const { error: updateError } = await supabase
      .from('imports')
      .update({ status: input.to_status, updated_at: new Date().toISOString() })
      .eq('id', input.import_id)
      .eq('tenant_id', input.tenant_id);

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`);
    }

    // 4. Create status event (audit trail)
    const { error: eventError } = await supabase
      .from('import_status_events')
      .insert({
        tenant_id: input.tenant_id,
        import_id: input.import_id,
        from_status: fromStatus,
        to_status: input.to_status,
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
      to_status: input.to_status,
      message: `Status changed from ${fromStatus} to ${input.to_status}`
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
}

export const importService = new ImportService();
