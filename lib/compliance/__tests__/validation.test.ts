/**
 * UNIT TESTS: DDL Validation
 *
 * Test validation utilities for DDL compliance system
 */

import {
  validateSwedishOrgNumber,
  validateEmail,
  validateSwedishPostalCode,
  validateSwedishPhone,
  validateStatusTransition,
  addressesMatch,
  canGenerateDocument,
  canSubmit,
  canApproveOrReject
} from '../validation';
import { DDLStatus } from '../types';

// ============================================================================
// Swedish Org Number Validation
// ============================================================================

describe('validateSwedishOrgNumber', () => {
  test('valid org number with hyphen', () => {
    const result = validateSwedishOrgNumber('556789-1234');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('556789-1234');
  });

  test('valid org number without hyphen', () => {
    const result = validateSwedishOrgNumber('5567891234');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('556789-1234');
  });

  test('invalid format - too short', () => {
    const result = validateSwedishOrgNumber('12345');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Ogiltigt format');
  });

  test('invalid format - contains letters', () => {
    const result = validateSwedishOrgNumber('55678A-1234');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Ogiltigt format');
  });

  test('invalid checksum (Luhn algorithm)', () => {
    const result = validateSwedishOrgNumber('556789-1235'); // Last digit wrong
    expect(result.valid).toBe(false);
    expect(result.error).toContain('checksumma felaktig');
  });

  test('normalizes spaces', () => {
    const result = validateSwedishOrgNumber(' 556789-1234 ');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('556789-1234');
  });
});

// ============================================================================
// Email Validation
// ============================================================================

describe('validateEmail', () => {
  test('valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@company.se')).toBe(true);
  });

  test('invalid email - missing @', () => {
    expect(validateEmail('testexample.com')).toBe(false);
  });

  test('invalid email - missing domain', () => {
    expect(validateEmail('test@')).toBe(false);
  });

  test('invalid email - missing TLD', () => {
    expect(validateEmail('test@example')).toBe(false);
  });
});

// ============================================================================
// Postal Code Validation
// ============================================================================

describe('validateSwedishPostalCode', () => {
  test('valid postal code - 5 digits', () => {
    expect(validateSwedishPostalCode('12345')).toBe(true);
  });

  test('valid postal code - with space', () => {
    expect(validateSwedishPostalCode('123 45')).toBe(true);
  });

  test('invalid postal code - too short', () => {
    expect(validateSwedishPostalCode('1234')).toBe(false);
  });

  test('invalid postal code - contains letters', () => {
    expect(validateSwedishPostalCode('123A5')).toBe(false);
  });
});

// ============================================================================
// Phone Validation
// ============================================================================

describe('validateSwedishPhone', () => {
  test('valid mobile - with spaces', () => {
    expect(validateSwedishPhone('070 123 45 67')).toBe(true);
  });

  test('valid mobile - with hyphen', () => {
    expect(validateSwedishPhone('070-123 45 67')).toBe(true);
  });

  test('valid mobile - no separators', () => {
    expect(validateSwedishPhone('0701234567')).toBe(true);
  });

  test('valid international format', () => {
    expect(validateSwedishPhone('+46 70 123 45 67')).toBe(true);
  });

  test('invalid - too short', () => {
    expect(validateSwedishPhone('070123')).toBe(false);
  });
});

// ============================================================================
// Status Transition Validation
// ============================================================================

describe('validateStatusTransition', () => {
  test('valid: NOT_REGISTERED → SUBMITTED', () => {
    const result = validateStatusTransition(
      DDLStatus.NOT_REGISTERED,
      DDLStatus.SUBMITTED
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('valid: SUBMITTED → APPROVED', () => {
    const result = validateStatusTransition(
      DDLStatus.SUBMITTED,
      DDLStatus.APPROVED
    );
    expect(result.valid).toBe(true);
  });

  test('valid: SUBMITTED → REJECTED', () => {
    const result = validateStatusTransition(
      DDLStatus.SUBMITTED,
      DDLStatus.REJECTED
    );
    expect(result.valid).toBe(true);
  });

  test('invalid: NOT_REGISTERED → APPROVED (skipping SUBMITTED)', () => {
    const result = validateStatusTransition(
      DDLStatus.NOT_REGISTERED,
      DDLStatus.APPROVED
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Ogiltig statusövergång');
  });

  test('invalid: APPROVED → REJECTED (cannot reverse)', () => {
    const result = validateStatusTransition(
      DDLStatus.APPROVED,
      DDLStatus.REJECTED
    );
    expect(result.valid).toBe(false);
  });

  test('valid: REJECTED → NOT_REGISTERED (allow resubmission)', () => {
    const result = validateStatusTransition(
      DDLStatus.REJECTED,
      DDLStatus.NOT_REGISTERED
    );
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Address Matching (for shipment gating)
// ============================================================================

describe('addressesMatch', () => {
  test('exact match', () => {
    const result = addressesMatch(
      {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      },
      {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      }
    );

    expect(result.matches).toBe(true);
  });

  test('case insensitive match', () => {
    const result = addressesMatch(
      {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'STOCKHOLM'
      },
      {
        line1: 'kungsgatan 1',
        postal_code: '11143',
        city: 'stockholm'
      }
    );

    expect(result.matches).toBe(true);
  });

  test('postal code with/without space', () => {
    const result = addressesMatch(
      {
        line1: 'Kungsgatan 1',
        postal_code: '111 43',
        city: 'Stockholm'
      },
      {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      }
    );

    expect(result.matches).toBe(true);
  });

  test('mismatch: different street', () => {
    const result = addressesMatch(
      {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      },
      {
        line1: 'Drottninggatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      }
    );

    expect(result.matches).toBe(false);
    expect(result.reason).toContain('Gatuadress matchar inte');
  });

  test('mismatch: different postal code', () => {
    const result = addressesMatch(
      {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      },
      {
        line1: 'Kungsgatan 1',
        postal_code: '12345',
        city: 'Stockholm'
      }
    );

    expect(result.matches).toBe(false);
    expect(result.reason).toContain('Postnummer matchar inte');
  });

  test('mismatch: different city', () => {
    const result = addressesMatch(
      {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      },
      {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Göteborg'
      }
    );

    expect(result.matches).toBe(false);
    expect(result.reason).toContain('Ort matchar inte');
  });

  test('extra whitespace handled', () => {
    const result = addressesMatch(
      {
        line1: '  Kungsgatan  1  ',
        postal_code: '11143',
        city: 'Stockholm'
      },
      {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      }
    );

    expect(result.matches).toBe(true);
  });
});

// ============================================================================
// Document Precondition Checks
// ============================================================================

describe('canGenerateDocument', () => {
  test('can generate in NOT_REGISTERED', () => {
    const result = canGenerateDocument(DDLStatus.NOT_REGISTERED);
    expect(result.valid).toBe(true);
  });

  test('can generate in SUBMITTED', () => {
    const result = canGenerateDocument(DDLStatus.SUBMITTED);
    expect(result.valid).toBe(true);
  });

  test('can generate in REJECTED', () => {
    const result = canGenerateDocument(DDLStatus.REJECTED);
    expect(result.valid).toBe(true);
  });

  test('cannot generate in APPROVED', () => {
    const result = canGenerateDocument(DDLStatus.APPROVED);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Kan inte generera dokument');
  });
});

describe('canSubmit', () => {
  test('can submit with document in NOT_REGISTERED', () => {
    const result = canSubmit(DDLStatus.NOT_REGISTERED, true);
    expect(result.valid).toBe(true);
  });

  test('cannot submit without document', () => {
    const result = canSubmit(DDLStatus.NOT_REGISTERED, false);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Dokument måste genereras');
  });

  test('cannot submit from SUBMITTED', () => {
    const result = canSubmit(DDLStatus.SUBMITTED, true);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Kan inte skicka in');
  });
});

describe('canApproveOrReject', () => {
  test('can approve/reject from SUBMITTED', () => {
    const result = canApproveOrReject(DDLStatus.SUBMITTED);
    expect(result.valid).toBe(true);
  });

  test('cannot approve/reject from NOT_REGISTERED', () => {
    const result = canApproveOrReject(DDLStatus.NOT_REGISTERED);
    expect(result.valid).toBe(false);
  });

  test('cannot approve/reject from APPROVED', () => {
    const result = canApproveOrReject(DDLStatus.APPROVED);
    expect(result.valid).toBe(false);
  });
});
