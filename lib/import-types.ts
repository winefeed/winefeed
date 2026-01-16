// TypeScript types for import case domain

export enum ImportStatus {
  NOT_REGISTERED = 'NOT_REGISTERED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface ImportCase {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  importer_id: string;
  delivery_location_id: string;
  supplier_id: string | null;
  status: ImportStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportStatusEvent {
  id: string;
  tenant_id: string;
  import_id: string;
  from_status: string;
  to_status: string;
  note: string | null;
  changed_by_user_id: string;
  created_at: string;
}

export interface Importer {
  id: string;
  tenant_id: string;
  legal_name: string;
  org_number: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  license_number: string | null;
  license_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
