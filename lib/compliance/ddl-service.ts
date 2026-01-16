/**
 * DIRECT DELIVERY LOCATION (DDL) - Service Layer
 *
 * Core business logic for DDL compliance system
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DirectDeliveryLocation,
  DDLDocument,
  DDLStatusEvent,
  DDLStatus,
  CreateDDLRequest,
  CreateDDLResponse,
  GenerateDocumentResponse,
  SubmitDDLResponse,
  ApproveDDLResponse,
  RejectDDLResponse,
  ValidateDDLForShipmentResponse,
  GetDDLDetailsResponse,
  DDLApplicationData,
  DDLValidationError,
  DDLStatusTransitionError,
  DDLNotFoundError,
  DDLShipmentGatingError,
  ListDDLsRequest,
  ListDDLsResponse
} from './types';
import {
  validateCreateDDLRequest,
  validateStatusTransition,
  addressesMatch,
  canGenerateDocument,
  canSubmit,
  canApproveOrReject,
  generateInternalReference
} from './validation';
import { ddlDocumentGenerator } from './ddl-document-generator';

// ============================================================================
// DDL Service
// ============================================================================

export class DDLService {
  private supabase: SupabaseClient;
  private storageClient: any; // Storage client (S3/Supabase)

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.storageClient = this.supabase.storage.from('ddl-documents');
  }

  // ==========================================================================
  // CREATE DDL
  // ==========================================================================

  async createDDL(
    tenantId: string,
    request: CreateDDLRequest,
    userId: string
  ): Promise<CreateDDLResponse> {
    // Validate request
    const validation = validateCreateDDLRequest(request);
    if (!validation.valid) {
      throw new DDLValidationError('Validation failed', validation.errors);
    }

    // Check for duplicate (same tenant + restaurant + importer + address)
    const { data: existing } = await this.supabase
      .from('direct_delivery_locations')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('restaurant_id', request.restaurant_id)
      .eq('importer_id', request.importer_id)
      .eq('delivery_address_line1', request.delivery_address.line1)
      .eq('postal_code', request.delivery_address.postal_code)
      .eq('city', request.delivery_address.city)
      .maybeSingle();

    if (existing) {
      throw new DDLValidationError(
        `DDL already exists for this address (ID: ${existing.id}, Status: ${existing.status})`,
        ['Duplicate DDL detected']
      );
    }

    // Create DDL record
    const { data: ddl, error } = await this.supabase
      .from('direct_delivery_locations')
      .insert({
        tenant_id: tenantId,
        restaurant_id: request.restaurant_id,
        importer_id: request.importer_id,
        legal_name: request.legal_name,
        org_number: request.org_number,
        delivery_address_line1: request.delivery_address.line1,
        delivery_address_line2: request.delivery_address.line2,
        postal_code: request.delivery_address.postal_code,
        city: request.delivery_address.city,
        country_code: request.delivery_address.country_code,
        contact_name: request.contact.name,
        contact_email: request.contact.email,
        contact_phone: request.contact.phone,
        consent_given: request.consent_given,
        consent_timestamp: new Date().toISOString(),
        status: DDLStatus.NOT_REGISTERED
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create DDL: ${error.message}`);
    }

    return {
      ddl_id: ddl.id,
      status: ddl.status,
      message: 'DDL skapad. Generera dokument och skicka in för godkännande.'
    };
  }

  // ==========================================================================
  // GENERATE DOCUMENT
  // ==========================================================================

  async generateDocument(
    ddlId: string,
    tenantId: string,
    userId: string
  ): Promise<GenerateDocumentResponse> {
    // Get DDL
    const { data: ddl, error: ddlError } = await this.supabase
      .from('direct_delivery_locations')
      .select('*')
      .eq('id', ddlId)
      .eq('tenant_id', tenantId)
      .single();

    if (ddlError || !ddl) {
      throw new DDLNotFoundError(`DDL not found: ${ddlId}`);
    }

    // Check if document can be generated
    const canGenerate = canGenerateDocument(ddl.status);
    if (!canGenerate.valid) {
      throw new DDLValidationError(
        'Cannot generate document',
        canGenerate.errors
      );
    }

    // Get next version number
    const { data: existingDocs } = await this.supabase
      .from('ddl_documents')
      .select('version')
      .eq('ddl_id', ddlId)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existingDocs && existingDocs.length > 0
      ? existingDocs[0].version + 1
      : 1;

    // Get importer details
    const { data: importer } = await this.supabase
      .from('importers')
      .select('legal_name, org_number, contact_name, contact_email, contact_phone')
      .eq('id', ddl.importer_id)
      .single();

    if (!importer) {
      throw new Error(`Importer not found: ${ddl.importer_id}`);
    }

    // Prepare application data
    const internalReference = generateInternalReference(ddlId, nextVersion);

    const applicationData: DDLApplicationData = {
      ddl_id: ddlId,
      internal_reference: internalReference,
      version: nextVersion,
      created_at: new Date().toISOString(),
      importer: {
        legal_name: importer.legal_name,
        org_number: importer.org_number,
        contact_name: importer.contact_name,
        contact_email: importer.contact_email,
        contact_phone: importer.contact_phone
      },
      restaurant: {
        legal_name: ddl.legal_name,
        org_number: ddl.org_number
      },
      delivery_address: {
        line1: ddl.delivery_address_line1,
        line2: ddl.delivery_address_line2,
        postal_code: ddl.postal_code,
        city: ddl.city,
        country_code: ddl.country_code
      },
      contact: {
        name: ddl.contact_name,
        email: ddl.contact_email,
        phone: ddl.contact_phone
      },
      consent_given: ddl.consent_given,
      consent_timestamp: ddl.consent_timestamp
    };

    // Generate PDF
    const { pdfBuffer, fileHash } = await ddlDocumentGenerator.generateApplicationPDF(
      applicationData
    );

    // Upload to storage
    const fileName = `${tenantId}/${ddlId}/application-v${nextVersion}.pdf`;
    const { error: uploadError } = await this.storageClient.upload(
      fileName,
      pdfBuffer,
      {
        contentType: 'application/pdf',
        upsert: false
      }
    );

    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = this.storageClient.getPublicUrl(fileName);
    const fileUrl = urlData.publicUrl;

    // Create document record
    const { data: document, error: docError } = await this.supabase
      .from('ddl_documents')
      .insert({
        tenant_id: tenantId,
        ddl_id: ddlId,
        document_type: 'SKV_5369_03',
        version: nextVersion,
        file_url: fileUrl,
        file_hash: fileHash,
        created_by_user_id: userId,
        metadata_json: {
          date: new Date().toISOString(),
          internal_reference: internalReference,
          generation_params: {
            importer_name: importer.legal_name,
            restaurant_name: ddl.legal_name,
            delivery_address: `${ddl.delivery_address_line1}, ${ddl.postal_code} ${ddl.city}`
          }
        }
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Failed to create document record: ${docError.message}`);
    }

    // Update DDL with current_document_id
    await this.supabase
      .from('direct_delivery_locations')
      .update({ current_document_id: document.id })
      .eq('id', ddlId);

    return {
      document_id: document.id,
      version: nextVersion,
      file_url: fileUrl,
      internal_reference: internalReference,
      file_hash: fileHash
    };
  }

  // ==========================================================================
  // SUBMIT DDL
  // ==========================================================================

  async submitDDL(
    ddlId: string,
    tenantId: string,
    userId: string,
    note?: string
  ): Promise<SubmitDDLResponse> {
    // Get DDL
    const { data: ddl, error } = await this.supabase
      .from('direct_delivery_locations')
      .select('*, current_document_id')
      .eq('id', ddlId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !ddl) {
      throw new DDLNotFoundError(`DDL not found: ${ddlId}`);
    }

    // Validate can submit
    const canSubmitCheck = canSubmit(ddl.status, !!ddl.current_document_id);
    if (!canSubmitCheck.valid) {
      throw new DDLValidationError('Cannot submit DDL', canSubmitCheck.errors);
    }

    // Validate status transition
    const transitionCheck = validateStatusTransition(
      ddl.status,
      DDLStatus.SUBMITTED
    );
    if (!transitionCheck.valid) {
      throw new DDLStatusTransitionError(
        transitionCheck.errors[0],
        ddl.status,
        DDLStatus.SUBMITTED
      );
    }

    // Update status
    const { error: updateError } = await this.supabase
      .from('direct_delivery_locations')
      .update({
        status: DDLStatus.SUBMITTED,
        status_updated_at: new Date().toISOString()
      })
      .eq('id', ddlId);

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`);
    }

    // Create status event
    await this.createStatusEvent(
      ddlId,
      tenantId,
      ddl.status,
      DDLStatus.SUBMITTED,
      note || 'Inskickad för godkännande',
      userId
    );

    return {
      status: DDLStatus.SUBMITTED,
      status_updated_at: new Date().toISOString(),
      message: 'DDL inskickad för godkännande'
    };
  }

  // ==========================================================================
  // APPROVE DDL
  // ==========================================================================

  async approveDDL(
    ddlId: string,
    tenantId: string,
    userId: string,
    note?: string
  ): Promise<ApproveDDLResponse> {
    return this.changeStatus(
      ddlId,
      tenantId,
      userId,
      DDLStatus.APPROVED,
      note || 'Godkänd av compliance admin'
    );
  }

  // ==========================================================================
  // REJECT DDL
  // ==========================================================================

  async rejectDDL(
    ddlId: string,
    tenantId: string,
    userId: string,
    note: string
  ): Promise<RejectDDLResponse> {
    if (!note || note.trim().length < 10) {
      throw new DDLValidationError('Note required for rejection (min 10 characters)', []);
    }

    return this.changeStatus(ddlId, tenantId, userId, DDLStatus.REJECTED, note);
  }

  // ==========================================================================
  // VALIDATE DDL FOR SHIPMENT (Gating Logic)
  // ==========================================================================

  async validateForShipment(
    restaurantId: string,
    importerId: string,
    deliveryAddress: {
      line1: string;
      postal_code: string;
      city: string;
    },
    tenantId: string
  ): Promise<ValidateDDLForShipmentResponse> {
    // Find matching DDL
    const { data: ddls, error } = await this.supabase
      .from('direct_delivery_locations')
      .select('id, status, delivery_address_line1, postal_code, city')
      .eq('tenant_id', tenantId)
      .eq('restaurant_id', restaurantId)
      .eq('importer_id', importerId);

    if (error) {
      throw new Error(`Failed to fetch DDLs: ${error.message}`);
    }

    if (!ddls || ddls.length === 0) {
      return {
        valid: false,
        error: 'Direkt leveransplats saknas för denna restaurang och importör'
      };
    }

    // Check if any DDL matches the address and is APPROVED
    for (const ddl of ddls) {
      const match = addressesMatch(
        {
          line1: ddl.delivery_address_line1,
          postal_code: ddl.postal_code,
          city: ddl.city
        },
        deliveryAddress
      );

      if (match.matches) {
        if (ddl.status === DDLStatus.APPROVED) {
          return {
            valid: true,
            ddl_id: ddl.id,
            status: DDLStatus.APPROVED
          };
        } else {
          return {
            valid: false,
            ddl_id: ddl.id,
            status: ddl.status as DDLStatus,
            error: `Direkt leveransplats är inte godkänd. Status: ${ddl.status}`
          };
        }
      }
    }

    return {
      valid: false,
      error: 'Leveransadressen matchar inte någon registrerad Direkt leveransplats'
    };
  }

  // ==========================================================================
  // GET DDL DETAILS
  // ==========================================================================

  async getDDLDetails(
    ddlId: string,
    tenantId: string
  ): Promise<GetDDLDetailsResponse> {
    // Get DDL
    const { data: ddl, error: ddlError } = await this.supabase
      .from('direct_delivery_locations')
      .select('*')
      .eq('id', ddlId)
      .eq('tenant_id', tenantId)
      .single();

    if (ddlError || !ddl) {
      throw new DDLNotFoundError(`DDL not found: ${ddlId}`);
    }

    // Get documents
    const { data: documents } = await this.supabase
      .from('ddl_documents')
      .select('*')
      .eq('ddl_id', ddlId)
      .order('version', { ascending: false });

    // Get status history
    const { data: statusHistory } = await this.supabase
      .from('ddl_status_events')
      .select('*')
      .eq('ddl_id', ddlId)
      .order('created_at', { ascending: false });

    return {
      ddl: ddl as DirectDeliveryLocation,
      documents: (documents || []) as DDLDocument[],
      status_history: (statusHistory || []) as DDLStatusEvent[]
    };
  }

  // ==========================================================================
  // LIST DDLs
  // ==========================================================================

  async listDDLs(request: ListDDLsRequest): Promise<ListDDLsResponse> {
    let query = this.supabase
      .from('direct_delivery_locations')
      .select('*', { count: 'exact' })
      .eq('tenant_id', request.tenant_id);

    if (request.restaurant_id) {
      query = query.eq('restaurant_id', request.restaurant_id);
    }

    if (request.importer_id) {
      query = query.eq('importer_id', request.importer_id);
    }

    if (request.status) {
      query = query.eq('status', request.status);
    }

    const limit = request.limit || 50;
    const offset = request.offset || 0;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list DDLs: ${error.message}`);
    }

    return {
      ddls: (data || []) as DirectDeliveryLocation[],
      total: count || 0,
      limit,
      offset
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async changeStatus(
    ddlId: string,
    tenantId: string,
    userId: string,
    toStatus: DDLStatus,
    note: string
  ): Promise<any> {
    // Get DDL
    const { data: ddl, error } = await this.supabase
      .from('direct_delivery_locations')
      .select('status')
      .eq('id', ddlId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !ddl) {
      throw new DDLNotFoundError(`DDL not found: ${ddlId}`);
    }

    // Validate can approve/reject
    const canChangeCheck = canApproveOrReject(ddl.status);
    if (!canChangeCheck.valid) {
      throw new DDLValidationError('Cannot change status', canChangeCheck.errors);
    }

    // Validate status transition
    const transitionCheck = validateStatusTransition(ddl.status, toStatus);
    if (!transitionCheck.valid) {
      throw new DDLStatusTransitionError(
        transitionCheck.errors[0],
        ddl.status,
        toStatus
      );
    }

    // Update status
    const { error: updateError } = await this.supabase
      .from('direct_delivery_locations')
      .update({
        status: toStatus,
        status_updated_at: new Date().toISOString()
      })
      .eq('id', ddlId);

    if (updateError) {
      throw new Error(`Failed to update status: ${updateError.message}`);
    }

    // Create status event
    await this.createStatusEvent(
      ddlId,
      tenantId,
      ddl.status,
      toStatus,
      note,
      userId
    );

    return {
      status: toStatus,
      status_updated_at: new Date().toISOString(),
      message: `DDL ${toStatus === DDLStatus.APPROVED ? 'godkänd' : 'avvisad'}`
    };
  }

  private async createStatusEvent(
    ddlId: string,
    tenantId: string,
    fromStatus: string,
    toStatus: string,
    note: string,
    userId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ddl_status_events')
      .insert({
        tenant_id: tenantId,
        ddl_id: ddlId,
        from_status: fromStatus,
        to_status: toStatus,
        note,
        changed_by_user_id: userId
      });

    if (error) {
      console.error('Failed to create status event:', error);
      // Don't throw - this is audit trail, shouldn't block main operation
    }
  }
}

// ============================================================================
// Export Service Instance (Singleton)
// ============================================================================

export function createDDLService(): DDLService {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return new DDLService(supabaseUrl, supabaseKey);
}
