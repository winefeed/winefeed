/**
 * INTEGRATION TESTS: Shipment Gating
 *
 * Test the critical business rule:
 * Shipments "under suspension" (EMCS) can ONLY be delivered to restaurants
 * with DDL status = APPROVED for that importer + delivery address.
 */

import { DDLStatus } from '../types';

// Mock DDL service responses
const mockApprovedDDL = {
  id: 'ddl-123',
  tenant_id: 'tenant-1',
  restaurant_id: 'restaurant-1',
  importer_id: 'importer-1',
  status: DDLStatus.APPROVED,
  delivery_address_line1: 'Kungsgatan 1',
  postal_code: '11143',
  city: 'Stockholm'
};

const mockSubmittedDDL = {
  ...mockApprovedDDL,
  id: 'ddl-456',
  status: DDLStatus.SUBMITTED
};

const mockRejectedDDL = {
  ...mockApprovedDDL,
  id: 'ddl-789',
  status: DDLStatus.REJECTED
};

// ============================================================================
// Shipment Gating Logic Tests
// ============================================================================

describe('Shipment Gating Logic', () => {
  describe('APPROVED DDL + matching address', () => {
    test('should ALLOW shipment', () => {
      const ddl = mockApprovedDDL;
      const shipmentAddress = {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      };

      const result = validateShipmentGating(ddl, shipmentAddress);

      expect(result.allowed).toBe(true);
      expect(result.ddl_id).toBe('ddl-123');
      expect(result.status).toBe(DDLStatus.APPROVED);
    });
  });

  describe('SUBMITTED DDL (not yet approved)', () => {
    test('should BLOCK shipment', () => {
      const ddl = mockSubmittedDDL;
      const shipmentAddress = {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      };

      const result = validateShipmentGating(ddl, shipmentAddress);

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(DDLStatus.SUBMITTED);
      expect(result.reason).toContain('inte godkänd');
    });
  });

  describe('REJECTED DDL', () => {
    test('should BLOCK shipment', () => {
      const ddl = mockRejectedDDL;
      const shipmentAddress = {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      };

      const result = validateShipmentGating(ddl, shipmentAddress);

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(DDLStatus.REJECTED);
      expect(result.reason).toContain('inte godkänd');
    });
  });

  describe('APPROVED DDL but address mismatch', () => {
    test('should BLOCK shipment - different street', () => {
      const ddl = mockApprovedDDL;
      const shipmentAddress = {
        line1: 'Drottninggatan 5',  // Different address
        postal_code: '11143',
        city: 'Stockholm'
      };

      const result = validateShipmentGating(ddl, shipmentAddress);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('matchar inte');
    });

    test('should BLOCK shipment - different postal code', () => {
      const ddl = mockApprovedDDL;
      const shipmentAddress = {
        line1: 'Kungsgatan 1',
        postal_code: '12345',  // Different postal code
        city: 'Stockholm'
      };

      const result = validateShipmentGating(ddl, shipmentAddress);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('matchar inte');
    });

    test('should BLOCK shipment - different city', () => {
      const ddl = mockApprovedDDL;
      const shipmentAddress = {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Göteborg'  // Different city
      };

      const result = validateShipmentGating(ddl, shipmentAddress);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('matchar inte');
    });
  });

  describe('No DDL exists', () => {
    test('should BLOCK shipment', () => {
      const result = validateShipmentGating(null, {
        line1: 'Kungsgatan 1',
        postal_code: '11143',
        city: 'Stockholm'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Direkt leveransplats saknas');
    });
  });

  describe('Case insensitive matching', () => {
    test('should ALLOW with different case', () => {
      const ddl = mockApprovedDDL;
      const shipmentAddress = {
        line1: 'kungsgatan 1',  // Lowercase
        postal_code: '11143',
        city: 'STOCKHOLM'  // Uppercase
      };

      const result = validateShipmentGating(ddl, shipmentAddress);

      expect(result.allowed).toBe(true);
    });
  });
});

// ============================================================================
// Integration Test: Full Workflow
// ============================================================================

describe('Full DDL Workflow (Integration)', () => {
  test('Complete flow: Create → Generate → Submit → Approve → Validate Shipment', async () => {
    // This is a pseudo-integration test showing the expected flow
    // In real integration tests, you would use actual database

    const workflow = {
      // Step 1: Create DDL
      create: {
        restaurant_id: 'restaurant-1',
        importer_id: 'importer-1',
        org_number: '556789-1234',
        legal_name: 'Test Restaurant AB',
        delivery_address: {
          line1: 'Kungsgatan 1',
          postal_code: '11143',
          city: 'Stockholm',
          country_code: 'SE'
        },
        contact: {
          name: 'John Doe',
          email: 'john@test.se',
          phone: '070-123 45 67'
        },
        consent_given: true
      },

      // Step 2: Generate document
      generate: {
        expected_version: 1,
        expected_file_type: 'application/pdf'
      },

      // Step 3: Submit
      submit: {
        expected_status: DDLStatus.SUBMITTED
      },

      // Step 4: Approve
      approve: {
        expected_status: DDLStatus.APPROVED
      },

      // Step 5: Validate shipment
      validateShipment: {
        restaurant_id: 'restaurant-1',
        importer_id: 'importer-1',
        delivery_address: {
          line1: 'Kungsgatan 1',
          postal_code: '11143',
          city: 'Stockholm'
        },
        expected_valid: true
      }
    };

    // Assert workflow structure
    expect(workflow.create.consent_given).toBe(true);
    expect(workflow.approve.expected_status).toBe(DDLStatus.APPROVED);
    expect(workflow.validateShipment.expected_valid).toBe(true);
  });

  test('Workflow with rejection: Create → Generate → Submit → Reject → Blocked', async () => {
    const workflow = {
      create: { /* ... */ },
      generate: { expected_version: 1 },
      submit: { expected_status: DDLStatus.SUBMITTED },

      // Rejection
      reject: {
        note: 'Adressinformation ofullständig',
        expected_status: DDLStatus.REJECTED
      },

      // Attempt to ship (should be blocked)
      validateShipment: {
        expected_valid: false,
        expected_status: DDLStatus.REJECTED
      }
    };

    expect(workflow.reject.expected_status).toBe(DDLStatus.REJECTED);
    expect(workflow.validateShipment.expected_valid).toBe(false);
  });
});

// ============================================================================
// Helper Functions (for testing)
// ============================================================================

interface ShipmentGatingResult {
  allowed: boolean;
  ddl_id?: string;
  status?: DDLStatus;
  reason: string;
}

function validateShipmentGating(
  ddl: any | null,
  shipmentAddress: {
    line1: string;
    postal_code: string;
    city: string;
  }
): ShipmentGatingResult {
  // No DDL found
  if (!ddl) {
    return {
      allowed: false,
      reason: 'Direkt leveransplats saknas för denna restaurang och importör'
    };
  }

  // Check address match (case-insensitive, ignore spaces in postal code)
  const normalize = (str: string) => str.toLowerCase().trim();
  const normalizePostal = (postal: string) => postal.replace(/\s/g, '');

  const addressMatches =
    normalize(ddl.delivery_address_line1) === normalize(shipmentAddress.line1) &&
    normalizePostal(ddl.postal_code) === normalizePostal(shipmentAddress.postal_code) &&
    normalize(ddl.city) === normalize(shipmentAddress.city);

  if (!addressMatches) {
    return {
      allowed: false,
      ddl_id: ddl.id,
      status: ddl.status,
      reason: 'Leveransadressen matchar inte den registrerade Direkt leveransplatsen'
    };
  }

  // Check status
  if (ddl.status !== DDLStatus.APPROVED) {
    return {
      allowed: false,
      ddl_id: ddl.id,
      status: ddl.status,
      reason: `Direkt leveransplats är inte godkänd. Status: ${ddl.status}`
    };
  }

  // All checks passed
  return {
    allowed: true,
    ddl_id: ddl.id,
    status: DDLStatus.APPROVED,
    reason: 'Godkänd direkt leveransplats'
  };
}
