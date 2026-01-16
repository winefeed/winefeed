/**
 * DIRECT DELIVERY LOCATION (DDL) - Type Definitions
 *
 * Types for Skatteverket "Direkt leveransplats" (form 5369_03) compliance
 */

// ============================================================================
// Enums
// ============================================================================

export enum DDLStatus {
  NOT_REGISTERED = 'NOT_REGISTERED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

export enum DDLDocumentType {
  SKV_5369_03 = 'SKV_5369_03'
}

// ============================================================================
// Core Models
// ============================================================================

export interface DirectDeliveryLocation {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  importer_id: string;

  // Legal entity
  legal_name: string;
  org_number: string;

  // Delivery address
  delivery_address_line1: string;
  delivery_address_line2?: string;
  postal_code: string;
  city: string;
  country_code: string;

  // Contact
  contact_name: string;
  contact_email: string;
  contact_phone: string;

  // Consent
  consent_given: boolean;
  consent_timestamp?: string;

  // Status
  status: DDLStatus;
  status_updated_at: string;

  // Document reference
  current_document_id?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface DDLDocument {
  id: string;
  tenant_id: string;
  ddl_id: string;
  document_type: DDLDocumentType;
  version: number;
  file_url: string;
  file_hash: string;
  created_by_user_id: string;
  created_at: string;
  metadata_json: DDLDocumentMetadata;
}

export interface DDLDocumentMetadata {
  date: string;
  internal_reference: string;
  generation_params: {
    importer_name: string;
    restaurant_name: string;
    delivery_address: string;
  };
}

export interface DDLStatusEvent {
  id: string;
  tenant_id: string;
  ddl_id: string;
  from_status: string;
  to_status: string;
  note?: string;
  changed_by_user_id: string;
  created_at: string;
}

// ============================================================================
// Request/Response DTOs
// ============================================================================

export interface CreateDDLRequest {
  restaurant_id: string;
  importer_id: string;
  org_number: string;
  legal_name: string;
  delivery_address: {
    line1: string;
    line2?: string;
    postal_code: string;
    city: string;
    country_code: string;
  };
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  consent_given: boolean;
}

export interface CreateDDLResponse {
  ddl_id: string;
  status: DDLStatus;
  message: string;
}

export interface GenerateDocumentRequest {
  ddl_id: string;
}

export interface GenerateDocumentResponse {
  document_id: string;
  version: number;
  file_url: string;
  internal_reference: string;
  file_hash: string;
}

export interface SubmitDDLRequest {
  note?: string;
}

export interface SubmitDDLResponse {
  status: DDLStatus;
  status_updated_at: string;
  message: string;
}

export interface ApproveDDLRequest {
  note?: string;
}

export interface ApproveDDLResponse {
  status: DDLStatus;
  status_updated_at: string;
  message: string;
}

export interface RejectDDLRequest {
  note: string;
}

export interface RejectDDLResponse {
  status: DDLStatus;
  status_updated_at: string;
  message: string;
}

export interface ValidateDDLForShipmentRequest {
  restaurant_id: string;
  importer_id: string;
  delivery_address: {
    line1: string;
    postal_code: string;
    city: string;
  };
}

export interface ValidateDDLForShipmentResponse {
  valid: boolean;
  ddl_id?: string;
  status?: DDLStatus;
  error?: string;
}

export interface ListDDLsRequest {
  tenant_id: string;
  restaurant_id?: string;
  importer_id?: string;
  status?: DDLStatus;
  limit?: number;
  offset?: number;
}

export interface ListDDLsResponse {
  ddls: DirectDeliveryLocation[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetDDLDetailsResponse {
  ddl: DirectDeliveryLocation;
  documents: DDLDocument[];
  status_history: DDLStatusEvent[];
}

// ============================================================================
// Document Generation
// ============================================================================

export interface DDLApplicationData {
  ddl_id: string;
  internal_reference: string;
  version: number;
  created_at: string;

  // Importer
  importer: {
    legal_name: string;
    org_number: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    address_line1: string;
    address_line2?: string;
    postal_code: string;
    city: string;
    country_code: string;
  };

  // Restaurant
  restaurant: {
    legal_name: string;
    org_number: string;
  };

  // Delivery address
  delivery_address: {
    line1: string;
    line2?: string;
    postal_code: string;
    city: string;
    country_code: string;
  };

  // Contact person
  contact: {
    name: string;
    email: string;
    phone: string;
  };

  // Consent
  consent_given: boolean;
  consent_timestamp: string;
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface OrgNumberValidation {
  valid: boolean;
  formatted: string;  // Standardized format: NNNNNN-NNNN
  error?: string;
}

// ============================================================================
// Bolagsverket Integration (Stub)
// ============================================================================

export interface BolagsverketCompanyInfo {
  org_number: string;
  legal_name: string;
  address?: {
    street: string;
    postal_code: string;
    city: string;
  };
}

// ============================================================================
// Shipment Validation
// ============================================================================

export interface ShipmentType {
  is_under_suspension: boolean;
  importer_id: string;
  restaurant_id: string;
  delivery_address: {
    line1: string;
    line2?: string;
    postal_code: string;
    city: string;
  };
}

export interface DDLGatingResult {
  allowed: boolean;
  ddl_id?: string;
  status?: DDLStatus;
  reason: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class DDLValidationError extends Error {
  constructor(
    message: string,
    public errors: string[]
  ) {
    super(message);
    this.name = 'DDLValidationError';
  }
}

export class DDLStatusTransitionError extends Error {
  constructor(
    message: string,
    public from_status: DDLStatus,
    public to_status: DDLStatus
  ) {
    super(message);
    this.name = 'DDLStatusTransitionError';
  }
}

export class DDLNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DDLNotFoundError';
  }
}

export class DDLDocumentGenerationError extends Error {
  constructor(
    message: string,
    public ddl_id: string
  ) {
    super(message);
    this.name = 'DDLDocumentGenerationError';
  }
}

export class DDLShipmentGatingError extends Error {
  constructor(
    message: string,
    public restaurant_id: string,
    public importer_id: string,
    public status?: DDLStatus
  ) {
    super(message);
    this.name = 'DDLShipmentGatingError';
  }
}
