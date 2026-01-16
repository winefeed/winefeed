/**
 * DIRECT DELIVERY LOCATION (DDL) - Validation Utilities
 *
 * Validation for Swedish org numbers, addresses, and DDL data
 */

import {
  ValidationResult,
  OrgNumberValidation,
  DDLStatus,
  CreateDDLRequest
} from './types';

// ============================================================================
// Swedish Organization Number Validation
// ============================================================================

/**
 * Validate Swedish organization number (organisationsnummer)
 *
 * Format: NNNNNN-NNNN (10 digits with hyphen)
 * Example: 556789-1234
 *
 * Rules:
 * - 10 digits total
 * - Hyphen after 6th digit
 * - Uses Luhn algorithm for checksum (last digit)
 */
export function validateSwedishOrgNumber(orgNumber: string): OrgNumberValidation {
  // Remove spaces and convert to uppercase
  const cleaned = orgNumber.trim().replace(/\s/g, '');

  // Check format: NNNNNN-NNNN
  const formatRegex = /^(\d{6})-?(\d{4})$/;
  const match = cleaned.match(formatRegex);

  if (!match) {
    return {
      valid: false,
      formatted: orgNumber,
      error: 'Ogiltigt format. Förväntat format: NNNNNN-NNNN (t.ex. 556789-1234)'
    };
  }

  const [, part1, part2] = match;
  const formatted = `${part1}-${part2}`;
  const digits = part1 + part2;

  // Validate using Luhn algorithm (mod 10 checksum)
  if (!luhnCheck(digits)) {
    return {
      valid: false,
      formatted,
      error: 'Ogiltigt organisationsnummer (checksumma felaktig)'
    };
  }

  return {
    valid: true,
    formatted
  };
}

/**
 * Luhn algorithm for checksum validation
 * https://en.wikipedia.org/wiki/Luhn_algorithm
 */
function luhnCheck(digits: string): boolean {
  const nums = digits.split('').map(Number);
  let sum = 0;

  for (let i = 0; i < nums.length; i++) {
    let num = nums[i];

    // Double every second digit from the right
    if ((nums.length - i) % 2 === 0) {
      num *= 2;
      // If result is > 9, sum the digits (e.g., 12 -> 1+2 = 3)
      if (num > 9) {
        num -= 9;
      }
    }

    sum += num;
  }

  return sum % 10 === 0;
}

// ============================================================================
// Email Validation
// ============================================================================

export function validateEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
}

// ============================================================================
// Swedish Postal Code Validation
// ============================================================================

export function validateSwedishPostalCode(postalCode: string): boolean {
  // Swedish postal codes: NNNNN or NNN NN
  const cleaned = postalCode.trim().replace(/\s/g, '');
  const postalRegex = /^\d{5}$/;
  return postalRegex.test(cleaned);
}

/**
 * Format postal code with space: 12345 -> 123 45
 */
export function formatSwedishPostalCode(postalCode: string): string {
  const cleaned = postalCode.trim().replace(/\s/g, '');
  if (cleaned.length === 5) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }
  return postalCode;
}

// ============================================================================
// Phone Number Validation (Swedish)
// ============================================================================

export function validateSwedishPhone(phone: string): boolean {
  // Accept various formats:
  // +46 70 123 45 67
  // 070-123 45 67
  // 070 123 45 67
  // 0701234567
  const cleaned = phone.replace(/[\s-]/g, '');

  // Swedish mobile: 07X-XXX XX XX (10 digits starting with 07)
  // Swedish landline: 0XX-XXX XX XX (varies)
  const phoneRegex = /^(\+46|0)\d{7,10}$/;

  return phoneRegex.test(cleaned);
}

// ============================================================================
// DDL Creation Request Validation
// ============================================================================

export function validateCreateDDLRequest(request: CreateDDLRequest): ValidationResult {
  const errors: string[] = [];

  // Org number
  const orgValidation = validateSwedishOrgNumber(request.org_number);
  if (!orgValidation.valid) {
    errors.push(`Organisationsnummer: ${orgValidation.error}`);
  }

  // Legal name
  if (!request.legal_name || request.legal_name.trim().length < 2) {
    errors.push('Företagsnamn måste anges');
  }

  // Delivery address
  if (!request.delivery_address.line1 || request.delivery_address.line1.trim().length < 5) {
    errors.push('Leveransadress rad 1 måste anges');
  }

  if (!request.delivery_address.postal_code) {
    errors.push('Postnummer måste anges');
  } else if (!validateSwedishPostalCode(request.delivery_address.postal_code)) {
    errors.push('Ogiltigt postnummer (förväntat format: NNNNN)');
  }

  if (!request.delivery_address.city || request.delivery_address.city.trim().length < 2) {
    errors.push('Ort måste anges');
  }

  if (request.delivery_address.country_code !== 'SE') {
    errors.push('Endast svenska adresser tillåtna (country_code = SE)');
  }

  // Contact info
  if (!request.contact.name || request.contact.name.trim().length < 2) {
    errors.push('Kontaktperson namn måste anges');
  }

  if (!request.contact.email) {
    errors.push('Kontaktperson e-post måste anges');
  } else if (!validateEmail(request.contact.email)) {
    errors.push('Ogiltig e-postadress');
  }

  if (!request.contact.phone) {
    errors.push('Kontaktperson telefon måste anges');
  } else if (!validateSwedishPhone(request.contact.phone)) {
    errors.push('Ogiltigt telefonnummer');
  }

  // Consent
  if (!request.consent_given) {
    errors.push('Samtycke krävs för att registrera Direkt leveransplats');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Status Transition Validation
// ============================================================================

export function validateStatusTransition(
  fromStatus: DDLStatus,
  toStatus: DDLStatus
): ValidationResult {
  const errors: string[] = [];

  // Valid transitions
  const validTransitions: Record<DDLStatus, DDLStatus[]> = {
    [DDLStatus.NOT_REGISTERED]: [DDLStatus.SUBMITTED],
    [DDLStatus.SUBMITTED]: [DDLStatus.APPROVED, DDLStatus.REJECTED],
    [DDLStatus.APPROVED]: [DDLStatus.EXPIRED],
    [DDLStatus.REJECTED]: [DDLStatus.NOT_REGISTERED], // Allow resubmission
    [DDLStatus.EXPIRED]: [DDLStatus.NOT_REGISTERED]
  };

  const allowedNextStates = validTransitions[fromStatus] || [];

  if (!allowedNextStates.includes(toStatus)) {
    errors.push(
      `Ogiltig statusövergång: ${fromStatus} → ${toStatus}. Tillåtna övergångar: ${allowedNextStates.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Address Matching (for shipment gating)
// ============================================================================

export interface AddressMatch {
  matches: boolean;
  reason?: string;
}

/**
 * Check if two addresses match (for shipment gating)
 *
 * Must match: line1, postal_code, city (case-insensitive)
 * Optional: line2 (ignored if not provided)
 */
export function addressesMatch(
  address1: {
    line1: string;
    postal_code: string;
    city: string;
  },
  address2: {
    line1: string;
    postal_code: string;
    city: string;
  }
): AddressMatch {
  // Normalize strings (lowercase, trim, remove extra spaces)
  const normalize = (str: string) =>
    str.toLowerCase().trim().replace(/\s+/g, ' ');

  const normalizePostal = (postal: string) =>
    postal.replace(/\s/g, '');

  // Compare line1
  if (normalize(address1.line1) !== normalize(address2.line1)) {
    return {
      matches: false,
      reason: 'Gatuadress matchar inte'
    };
  }

  // Compare postal code (ignore spaces)
  if (normalizePostal(address1.postal_code) !== normalizePostal(address2.postal_code)) {
    return {
      matches: false,
      reason: 'Postnummer matchar inte'
    };
  }

  // Compare city
  if (normalize(address1.city) !== normalize(address2.city)) {
    return {
      matches: false,
      reason: 'Ort matchar inte'
    };
  }

  return { matches: true };
}

// ============================================================================
// Document Precondition Checks
// ============================================================================

/**
 * Check if DDL can generate a new document
 */
export function canGenerateDocument(status: DDLStatus): ValidationResult {
  const errors: string[] = [];

  // Can generate if NOT_REGISTERED, SUBMITTED, or REJECTED
  const allowedStatuses = [
    DDLStatus.NOT_REGISTERED,
    DDLStatus.SUBMITTED,
    DDLStatus.REJECTED
  ];

  if (!allowedStatuses.includes(status)) {
    errors.push(
      `Kan inte generera dokument i status ${status}. Tillåtna statusar: ${allowedStatuses.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if DDL can be submitted
 */
export function canSubmit(status: DDLStatus, hasDocument: boolean): ValidationResult {
  const errors: string[] = [];

  if (status !== DDLStatus.NOT_REGISTERED) {
    errors.push(`Kan inte skicka in från status ${status}. Endast från NOT_REGISTERED.`);
  }

  if (!hasDocument) {
    errors.push('Dokument måste genereras innan inskickning');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if DDL can be approved/rejected
 */
export function canApproveOrReject(status: DDLStatus): ValidationResult {
  const errors: string[] = [];

  if (status !== DDLStatus.SUBMITTED) {
    errors.push(`Kan endast godkänna/avvisa från status SUBMITTED. Nuvarande status: ${status}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sanitize string input (remove special characters, trim)
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 255); // Max length
}

/**
 * Generate internal reference for DDL document
 */
export function generateInternalReference(
  ddlId: string,
  version: number
): string {
  const shortId = ddlId.substring(0, 8);
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `DDL-${shortId}-${dateStr}-v${version}`;
}
