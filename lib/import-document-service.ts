import { createClient } from '@supabase/supabase-js';
import { ddlDocumentGenerator } from './compliance/ddl-document-generator';
import { DDLApplicationData } from './compliance/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const STORAGE_BUCKET = 'documents';

export interface GenerateDocumentResult {
  document: {
    id: string;
    type: string;
    version: number;
    sha256: string;
    storage_path: string;
    created_at: string;
  };
  storage_path: string;
  version: number;
}

interface ImportCaseForDocument {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  importer_id: string;
  delivery_location_id: string;
  created_at: string;
  restaurant: {
    name: string;
    org_number: string;
    contact_email: string;
    contact_phone: string;
  };
  importer: {
    legal_name: string;
    org_number: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    address_line1: string;
    address_line2: string | null;
    postal_code: string;
    city: string;
    country_code: string;
  };
  delivery_location: {
    delivery_address_line1: string;
    delivery_address_line2: string | null;
    postal_code: string;
    city: string;
    country_code: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    consent_given: boolean;
    consent_timestamp: string | null;
  };
}

/**
 * Import Document Service
 *
 * Handles generation and storage of import case documents (5369_03, etc).
 * Supports versioning and SHA-256 hashing for integrity.
 */
class ImportDocumentService {
  /**
   * Generate 5369_03 PDF for import case
   *
   * @param importId - Import case ID
   * @param tenantId - Tenant ID for isolation
   * @param actorId - User ID generating the document (optional)
   * @returns Document metadata with storage path
   */
  async generate5369(
    importId: string,
    tenantId: string,
    actorId?: string
  ): Promise<GenerateDocumentResult> {
    // DEBUG LOGGING
    console.log('[DEBUG] generate5369 called with:', { importId, tenantId, actorId });
    console.log('[DEBUG] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('[DEBUG] Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch import case with all required data
    const { data: importCase, error: fetchError } = await supabase
      .from('imports')
      .select(`
        id,
        tenant_id,
        restaurant_id,
        importer_id,
        delivery_location_id,
        created_at,
        restaurant:restaurants!inner(name, org_number, contact_email, contact_phone),
        importer:importers!inner(legal_name, org_number, contact_name, contact_email, contact_phone, address_line1, address_line2, postal_code, city, country_code),
        delivery_location:direct_delivery_locations!inner(
          delivery_address_line1,
          delivery_address_line2,
          postal_code,
          city,
          country_code,
          contact_name,
          contact_email,
          contact_phone,
          consent_given,
          consent_timestamp
        )
      `)
      .eq('id', importId)
      .eq('tenant_id', tenantId)
      .single();

    // DEBUG LOGGING
    console.log('[DEBUG] Query result:', {
      hasData: !!importCase,
      hasError: !!fetchError,
      errorDetails: fetchError
    });

    if (fetchError || !importCase) {
      console.error('[DEBUG] Query failed! Error:', fetchError);
      console.error('[DEBUG] Data:', importCase);
      throw new Error(`Import case not found: ${fetchError?.message || 'Not found'}`);
    }

    const typedImportCase = importCase as unknown as ImportCaseForDocument;

    // 2. Determine next version
    const nextVersion = await this.getNextVersion(tenantId, importId, 'SKV_5369_03');

    // 3. Generate internal reference
    const internalReference = this.generateInternalReference(importId, nextVersion);

    // 4. Prepare data for PDF generator
    const pdfData: DDLApplicationData = {
      ddl_id: importId, // Reuse field name (PDF generator doesn't care)
      internal_reference: internalReference,
      version: nextVersion,
      created_at: typedImportCase.created_at,
      importer: {
        legal_name: typedImportCase.importer.legal_name,
        org_number: typedImportCase.importer.org_number,
        contact_name: typedImportCase.importer.contact_name,
        contact_email: typedImportCase.importer.contact_email,
        contact_phone: typedImportCase.importer.contact_phone,
        address_line1: typedImportCase.importer.address_line1,
        address_line2: typedImportCase.importer.address_line2,
        postal_code: typedImportCase.importer.postal_code,
        city: typedImportCase.importer.city,
        country_code: typedImportCase.importer.country_code
      },
      restaurant: {
        legal_name: typedImportCase.restaurant.name,
        org_number: typedImportCase.restaurant.org_number
      },
      delivery_address: {
        line1: typedImportCase.delivery_location.delivery_address_line1,
        line2: typedImportCase.delivery_location.delivery_address_line2 || undefined,
        postal_code: typedImportCase.delivery_location.postal_code,
        city: typedImportCase.delivery_location.city,
        country_code: typedImportCase.delivery_location.country_code || 'SE'
      },
      contact: {
        name: typedImportCase.delivery_location.contact_name,
        email: typedImportCase.delivery_location.contact_email,
        phone: typedImportCase.delivery_location.contact_phone
      },
      consent_given: typedImportCase.delivery_location.consent_given,
      consent_timestamp: typedImportCase.delivery_location.consent_timestamp || typedImportCase.created_at
    };

    // 5. Generate PDF
    const { pdfBuffer, fileHash } = await ddlDocumentGenerator.generateApplicationPDF(pdfData);

    // 6. Upload to Supabase Storage
    const storagePath = `documents/${tenantId}/imports/${importId}/5369/v${nextVersion}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // 7. Insert document record
    const { data: document, error: insertError } = await supabase
      .from('import_documents')
      .insert({
        tenant_id: tenantId,
        import_id: importId,
        type: 'SKV_5369_03',
        version: nextVersion,
        storage_path: storagePath,
        sha256: fileHash,
        file_size_bytes: pdfBuffer.length,
        created_by: actorId || null
      })
      .select()
      .single();

    if (insertError || !document) {
      // Cleanup: try to delete uploaded file
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw new Error(`Failed to save document record: ${insertError?.message || 'Unknown error'}`);
    }

    return {
      document: {
        id: document.id,
        type: document.type,
        version: document.version,
        sha256: document.sha256,
        storage_path: document.storage_path,
        created_at: document.created_at
      },
      storage_path: storagePath,
      version: nextVersion
    };
  }

  /**
   * List all documents for an import case
   *
   * @param importId - Import case ID
   * @param tenantId - Tenant ID for isolation
   * @returns Array of documents
   */
  async listDocuments(importId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('import_documents')
      .select('*')
      .eq('import_id', importId)
      .eq('tenant_id', tenantId)
      .order('version', { ascending: false });

    if (error) {
      throw new Error(`Failed to list documents: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get next version number for a document type
   *
   * @param tenantId - Tenant ID
   * @param importId - Import case ID
   * @param documentType - Document type (e.g. 'SKV_5369_03')
   * @returns Next version number (1 if no documents exist)
   */
  private async getNextVersion(
    tenantId: string,
    importId: string,
    documentType: string
  ): Promise<number> {
    const { data, error } = await supabase
      .from('import_documents')
      .select('version')
      .eq('tenant_id', tenantId)
      .eq('import_id', importId)
      .eq('type', documentType)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to determine next version: ${error.message}`);
    }

    return data ? data.version + 1 : 1;
  }

  /**
   * Generate internal reference string
   *
   * Format: IMPORT-{short-id}-{date}-v{version}
   *
   * @param importId - Import case ID
   * @param version - Document version
   * @returns Internal reference string
   */
  private generateInternalReference(importId: string, version: number): string {
    const shortId = importId.substring(0, 8);
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `IMPORT-${shortId}-${date}-v${version}`;
  }
}

export const importDocumentService = new ImportDocumentService();
