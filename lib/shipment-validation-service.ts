import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface ValidationResult {
  valid: boolean;
  error_code?: string;
  error_message?: string;
}

export type ImporterType = 'SE' | 'EU_PARTNER';

interface ImportCaseData {
  id: string;
  tenant_id: string;
  restaurant_id: string;
  importer_id: string;
  delivery_location_id: string;
  supplier_id: string | null;
  status: string;
  importer: {
    id: string;
    type: ImporterType | null;
  } | null;
  delivery_location: {
    id: string;
    status: string;
  } | null;
}

/**
 * Shipment Validation Service
 *
 * Validates that an import case is ready for shipment.
 * Different rulesets for SE (Swedish) vs EU_PARTNER flows.
 */
class ShipmentValidationService {
  /**
   * Validate if import case is ready for shipment
   *
   * @param importId - Import case ID
   * @param tenantId - Tenant ID for isolation
   * @returns ValidationResult with valid flag and error details
   */
  async validateForShipment(
    importId: string,
    tenantId: string
  ): Promise<ValidationResult> {
    // Fetch import case with all required related data
    const { data: importCase, error: fetchError } = await supabase
      .from('imports')
      .select(`
        id,
        tenant_id,
        restaurant_id,
        importer_id,
        delivery_location_id,
        supplier_id,
        status,
        importer:importers!inner(id, type),
        delivery_location:direct_delivery_locations!inner(id, status)
      `)
      .eq('id', importId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !importCase) {
      throw new Error(`Import case not found: ${fetchError?.message || 'Not found'}`);
    }

    const typedImportCase = importCase as unknown as ImportCaseData;

    // ========================================================================
    // COMMON VALIDATIONS (Both SE and EU_PARTNER)
    // ========================================================================

    // 1. Import must be APPROVED
    if (typedImportCase.status !== 'APPROVED') {
      return {
        valid: false,
        error_code: 'IMPORT_NOT_APPROVED',
        error_message: 'Importen måste vara godkänd innan leverans kan ske. Aktuell status: ' + typedImportCase.status
      };
    }

    // 2. Delivery location must exist
    if (!typedImportCase.delivery_location) {
      return {
        valid: false,
        error_code: 'DDL_MISSING',
        error_message: 'Leveransplats saknas. En godkänd direkt leveransplats krävs för leverans.'
      };
    }

    // 3. Delivery location must be APPROVED
    if (typedImportCase.delivery_location.status !== 'APPROVED') {
      return {
        valid: false,
        error_code: 'DDL_NOT_APPROVED',
        error_message: `Leveransplatsen är inte godkänd. Aktuell status: ${typedImportCase.delivery_location.status}. Endast godkända leveransplatser får ta emot leveranser.`
      };
    }

    // 4. Importer must exist
    if (!typedImportCase.importer) {
      return {
        valid: false,
        error_code: 'IMPORTER_MISSING',
        error_message: 'Importör saknas. En giltig importör krävs för leverans.'
      };
    }

    // 5. Importer type must be set
    if (!typedImportCase.importer.type) {
      return {
        valid: false,
        error_code: 'IMPORTER_TYPE_MISSING',
        error_message: 'Importörens typ (SE/EU_PARTNER) saknas. Kontakta support.'
      };
    }

    // ========================================================================
    // FLOW-SPECIFIC VALIDATIONS
    // ========================================================================

    const importerType = typedImportCase.importer.type;

    if (importerType === 'SE') {
      return this.validateSEFlow(typedImportCase);
    } else if (importerType === 'EU_PARTNER') {
      return this.validateEUPartnerFlow(typedImportCase);
    } else {
      return {
        valid: false,
        error_code: 'UNKNOWN_IMPORTER_TYPE',
        error_message: `Okänd importörtyp: ${importerType}. Endast SE och EU_PARTNER stöds.`
      };
    }
  }

  /**
   * Validate SE (Swedish) import flow
   *
   * Swedish importers have simpler requirements (for MVP).
   * Future: Add excise refs, license validation, etc.
   */
  private validateSEFlow(importCase: ImportCaseData): ValidationResult {
    // MVP: All common validations are sufficient for SE flow
    // TODO: Add SE-specific validations:
    // - Verify importer has valid Swedish alcohol license
    // - Check excise reference number exists
    // - Validate customs clearance documentation

    return {
      valid: true
    };
  }

  /**
   * Validate EU_PARTNER import flow
   *
   * EU partner imports under suspension arrangement.
   * Future: Add logistics partner validation, suspension chain, etc.
   */
  private validateEUPartnerFlow(importCase: ImportCaseData): ValidationResult {
    // MVP: All common validations are sufficient for EU_PARTNER flow
    // TODO: Add EU_PARTNER-specific validations:
    // - Verify logistics partner exists and is approved
    // - Check under-suspension chain documentation
    // - Validate EMCS (Excise Movement Control System) reference
    // - Verify partner has valid EU alcohol license

    return {
      valid: true
    };
  }
}

export const shipmentValidationService = new ShipmentValidationService();
