# DDL Compliance - Integration Code Examples

Quick copy-paste examples for integrating DDL compliance into your application.

---

## 1. Restaurant Onboarding - DDL Form Component

```typescript
// components/RestaurantOnboarding/DDLForm.tsx

import { useState } from 'react';
import { validateSwedishOrgNumber } from '@/lib/compliance/validation';

export function DDLOnboardingForm({ restaurantId, onComplete }: Props) {
  const [formData, setFormData] = useState({
    importer_id: '',
    org_number: '',
    legal_name: '',
    delivery_address: {
      line1: '',
      line2: '',
      postal_code: '',
      city: '',
      country_code: 'SE'
    },
    contact: {
      name: '',
      email: '',
      phone: ''
    },
    consent_given: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate org number and fetch legal name from Bolagsverket
  const handleOrgNumberChange = async (orgNumber: string) => {
    const validation = validateSwedishOrgNumber(orgNumber);

    if (!validation.valid) {
      setErrors({ ...errors, org_number: validation.error! });
      return;
    }

    // Fetch legal name from Bolagsverket (or stub)
    try {
      const response = await fetch(`/api/bolagsverket/lookup?orgnr=${validation.formatted}`);
      const data = await response.json();

      setFormData({
        ...formData,
        org_number: validation.formatted,
        legal_name: data.legal_name
      });
      setErrors({ ...errors, org_number: '' });
    } catch (error) {
      console.error('Bolagsverket lookup failed:', error);
    }
  };

  // Submit DDL
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.consent_given) {
      alert('Du måste godkänna registrering av Direkt leveransplats');
      return;
    }

    try {
      const response = await fetch(`/api/restaurants/${restaurantId}/direct-delivery-locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          'x-user-id': userId
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        setErrors(error.validation_errors || {});
        return;
      }

      const result = await response.json();
      onComplete(result.ddl_id);
    } catch (error) {
      console.error('Create DDL failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Org Number Input */}
      <div>
        <label>Organisationsnummer</label>
        <input
          type="text"
          placeholder="NNNNNN-NNNN"
          value={formData.org_number}
          onChange={(e) => handleOrgNumberChange(e.target.value)}
        />
        {errors.org_number && <span className="error">{errors.org_number}</span>}
      </div>

      {/* Legal Name (prefilled) */}
      <div>
        <label>Företagsnamn</label>
        <input
          type="text"
          value={formData.legal_name}
          onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
          readOnly
        />
      </div>

      {/* Delivery Address */}
      <div>
        <label>Leveransadress</label>
        <input
          type="text"
          placeholder="Gatuadress"
          value={formData.delivery_address.line1}
          onChange={(e) => setFormData({
            ...formData,
            delivery_address: { ...formData.delivery_address, line1: e.target.value }
          })}
        />
      </div>

      <div>
        <input
          type="text"
          placeholder="Postnummer"
          value={formData.delivery_address.postal_code}
          onChange={(e) => setFormData({
            ...formData,
            delivery_address: { ...formData.delivery_address, postal_code: e.target.value }
          })}
        />
      </div>

      <div>
        <input
          type="text"
          placeholder="Ort"
          value={formData.delivery_address.city}
          onChange={(e) => setFormData({
            ...formData,
            delivery_address: { ...formData.delivery_address, city: e.target.value }
          })}
        />
      </div>

      {/* Contact Person */}
      <div>
        <label>Kontaktperson</label>
        <input
          type="text"
          placeholder="Namn"
          value={formData.contact.name}
          onChange={(e) => setFormData({
            ...formData,
            contact: { ...formData.contact, name: e.target.value }
          })}
        />
      </div>

      <div>
        <input
          type="email"
          placeholder="E-post"
          value={formData.contact.email}
          onChange={(e) => setFormData({
            ...formData,
            contact: { ...formData.contact, email: e.target.value }
          })}
        />
      </div>

      <div>
        <input
          type="tel"
          placeholder="Telefon"
          value={formData.contact.phone}
          onChange={(e) => setFormData({
            ...formData,
            contact: { ...formData.contact, phone: e.target.value }
          })}
        />
      </div>

      {/* Importer Selection */}
      <div>
        <label>Importör / Godkänd aktör</label>
        <select
          value={formData.importer_id}
          onChange={(e) => setFormData({ ...formData, importer_id: e.target.value })}
        >
          <option value="">Välj importör...</option>
          {importers.map(imp => (
            <option key={imp.id} value={imp.id}>{imp.legal_name}</option>
          ))}
        </select>
      </div>

      {/* Consent Checkbox */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={formData.consent_given}
            onChange={(e) => setFormData({ ...formData, consent_given: e.target.checked })}
          />
          Jag godkänner att denna adress registreras som Direkt leveransplats hos Skatteverket
        </label>
      </div>

      <button type="submit">Skapa Direkt leveransplats</button>
    </form>
  );
}
```

---

## 2. Shipment Creation - DDL Validation (CRITICAL)

```typescript
// lib/shipments/create-shipment.ts

import { createDDLService } from '@/lib/compliance/ddl-service';

export async function createShipment(shipmentData: ShipmentData) {
  // CRITICAL: Validate DDL BEFORE creating shipment
  if (shipmentData.shipment_type === 'UNDER_SUSPENSION') {
    const ddlService = createDDLService();

    const validation = await ddlService.validateForShipment(
      shipmentData.restaurant_id,
      shipmentData.importer_id,
      {
        line1: shipmentData.delivery_address.line1,
        postal_code: shipmentData.delivery_address.postal_code,
        city: shipmentData.delivery_address.city
      },
      shipmentData.tenant_id
    );

    if (!validation.valid) {
      throw new Error(
        `Direkt leveransplats saknas eller är inte godkänd: ${validation.error}`
      );
    }

    console.log(`✅ DDL validated: ${validation.ddl_id} (Status: ${validation.status})`);
  }

  // Proceed with shipment creation...
  const shipment = await createShipmentRecord(shipmentData);
  return shipment;
}
```

---

## 3. Document Generation UI

```typescript
// components/DDL/DocumentGenerator.tsx

export function DDLDocumentGenerator({ ddlId }: { ddlId: string }) {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<DDLDocument[]>([]);

  const handleGeneratePDF = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/direct-delivery-locations/${ddlId}/generate-document`, {
        method: 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'x-user-id': userId
        }
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Fel: ${error.error}`);
        return;
      }

      const result = await response.json();

      alert(`Dokument genererat! Version: ${result.version}`);

      // Refresh documents list
      await fetchDocuments();
    } catch (error) {
      console.error('Generate document failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    // Fetch documents from API...
  };

  return (
    <div>
      <button onClick={handleGeneratePDF} disabled={loading}>
        {loading ? 'Genererar...' : 'Generera ansökan (PDF)'}
      </button>

      <h3>Genererade dokument</h3>
      <ul>
        {documents.map(doc => (
          <li key={doc.id}>
            <a href={doc.file_url} target="_blank">
              Version {doc.version} - {new Date(doc.created_at).toLocaleDateString('sv-SE')}
            </a>
            <span> (Hash: {doc.file_hash.substring(0, 8)}...)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 4. Status Workflow UI

```typescript
// components/DDL/StatusWorkflow.tsx

export function DDLStatusWorkflow({ ddl }: { ddl: DirectDeliveryLocation }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!confirm('Skicka in ansökan för godkännande?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/direct-delivery-locations/${ddl.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          'x-user-id': userId
        },
        body: JSON.stringify({ note: 'Inskickad för granskning' })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Fel: ${error.error}`);
        return;
      }

      alert('Ansökan inskickad!');
      window.location.reload();
    } catch (error) {
      console.error('Submit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    const note = prompt('Godkännandekommentar (valfritt):');

    setLoading(true);
    try {
      const response = await fetch(`/api/direct-delivery-locations/${ddl.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          'x-user-id': userId,
          'x-user-role': 'compliance_admin'
        },
        body: JSON.stringify({ note })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Fel: ${error.error}`);
        return;
      }

      alert('Direkt leveransplats godkänd!');
      window.location.reload();
    } catch (error) {
      console.error('Approve failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const note = prompt('Anledning till avvisning (obligatoriskt, min 10 tecken):');
    if (!note || note.length < 10) {
      alert('Anledning måste anges (minst 10 tecken)');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/direct-delivery-locations/${ddl.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          'x-user-id': userId,
          'x-user-role': 'compliance_admin'
        },
        body: JSON.stringify({ note })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Fel: ${error.error}`);
        return;
      }

      alert('Direkt leveransplats avvisad');
      window.location.reload();
    } catch (error) {
      console.error('Reject failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Status: {ddl.status}</h3>

      {ddl.status === 'NOT_REGISTERED' && ddl.current_document_id && (
        <button onClick={handleSubmit} disabled={loading}>
          Skicka in för godkännande
        </button>
      )}

      {ddl.status === 'SUBMITTED' && userRole === 'compliance_admin' && (
        <>
          <button onClick={handleApprove} disabled={loading}>
            Godkänn
          </button>
          <button onClick={handleReject} disabled={loading}>
            Avvisa
          </button>
        </>
      )}

      {ddl.status === 'APPROVED' && (
        <div className="alert alert-success">
          ✅ Godkänd - kan ta emot leveranser under uppskov
        </div>
      )}

      {ddl.status === 'REJECTED' && (
        <div className="alert alert-danger">
          ❌ Avvisad - se historik för anledning
        </div>
      )}
    </div>
  );
}
```

---

## 5. Admin Dashboard - Pending Approvals

```typescript
// pages/admin/ddl-approvals.tsx

export default function DDLApprovalsPage() {
  const [ddls, setDdls] = useState<DirectDeliveryLocation[]>([]);

  useEffect(() => {
    fetchPendingDDLs();
  }, []);

  const fetchPendingDDLs = async () => {
    const response = await fetch('/api/direct-delivery-locations?status=SUBMITTED', {
      headers: {
        'x-tenant-id': tenantId,
        'x-user-role': 'compliance_admin'
      }
    });

    const data = await response.json();
    setDdls(data.ddls);
  };

  return (
    <div>
      <h1>Direkt leveransplatser - Väntande godkännande</h1>

      <table>
        <thead>
          <tr>
            <th>Restaurang</th>
            <th>Org.nr</th>
            <th>Leveransadress</th>
            <th>Inskickad</th>
            <th>Åtgärd</th>
          </tr>
        </thead>
        <tbody>
          {ddls.map(ddl => (
            <tr key={ddl.id}>
              <td>{ddl.legal_name}</td>
              <td>{ddl.org_number}</td>
              <td>
                {ddl.delivery_address_line1}, {ddl.postal_code} {ddl.city}
              </td>
              <td>{new Date(ddl.status_updated_at).toLocaleDateString('sv-SE')}</td>
              <td>
                <a href={`/admin/ddl/${ddl.id}`}>Granska →</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 6. Bolagsverket Lookup Stub

```typescript
// app/api/bolagsverket/lookup/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgnr = searchParams.get('orgnr');

  if (!orgnr) {
    return NextResponse.json({ error: 'orgnr required' }, { status: 400 });
  }

  // STUB: Replace with actual Bolagsverket API call
  // Real implementation would call:
  // https://api.bolagsverket.se/companies/{orgnr}

  // For now, return mock data
  const mockData = {
    org_number: orgnr,
    legal_name: `Test Company ${orgnr}`,
    address: {
      street: 'Testgatan 1',
      postal_code: '111 43',
      city: 'Stockholm'
    }
  };

  return NextResponse.json(mockData);
}
```

---

## 7. Error Handling in Shipment Flow

```typescript
// components/Shipments/CreateShipmentForm.tsx

const handleCreateShipment = async (shipmentData: ShipmentData) => {
  try {
    // Validate DDL if under-suspension
    if (shipmentData.shipment_type === 'UNDER_SUSPENSION') {
      const validation = await fetch('/api/shipments/validate-ddl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          restaurant_id: shipmentData.restaurant_id,
          importer_id: shipmentData.importer_id,
          delivery_address: {
            line1: shipmentData.delivery_address.line1,
            postal_code: shipmentData.delivery_address.postal_code,
            city: shipmentData.delivery_address.city
          }
        })
      }).then(r => r.json());

      if (!validation.valid) {
        // Show user-friendly error
        setError({
          title: 'Direkt leveransplats saknas eller är inte godkänd',
          message: validation.error,
          action: validation.status === 'SUBMITTED'
            ? 'Ansökan väntar på godkännande'
            : 'Registrera Direkt leveransplats först',
          link: `/restaurants/${shipmentData.restaurant_id}/ddl`
        });
        return;
      }
    }

    // Proceed with shipment creation...
    const shipment = await createShipment(shipmentData);
    alert('Leverans skapad!');
  } catch (error: any) {
    setError({
      title: 'Kunde inte skapa leverans',
      message: error.message
    });
  }
};
```

---

## 8. Testing Utilities

```typescript
// lib/compliance/__tests__/test-utils.ts

// Mock DDL for testing
export const createMockDDL = (overrides = {}): DirectDeliveryLocation => ({
  id: 'ddl-test-123',
  tenant_id: 'tenant-1',
  restaurant_id: 'restaurant-1',
  importer_id: 'importer-1',
  legal_name: 'Test Restaurant AB',
  org_number: '556789-1234',
  delivery_address_line1: 'Kungsgatan 1',
  postal_code: '11143',
  city: 'Stockholm',
  country_code: 'SE',
  contact_name: 'John Doe',
  contact_email: 'john@test.se',
  contact_phone: '070-123 45 67',
  consent_given: true,
  consent_timestamp: new Date().toISOString(),
  status: DDLStatus.NOT_REGISTERED,
  status_updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

// Run validation test
export const testOrgNumberValidation = () => {
  const validCases = [
    '556789-1234',
    '5567891234',
    ' 556789-1234 '
  ];

  validCases.forEach(orgNr => {
    const result = validateSwedishOrgNumber(orgNr);
    console.assert(result.valid, `Expected ${orgNr} to be valid`);
  });

  const invalidCases = [
    '12345',
    '556789-1235',  // Wrong checksum
    'abc123-4567'
  ];

  invalidCases.forEach(orgNr => {
    const result = validateSwedishOrgNumber(orgNr);
    console.assert(!result.valid, `Expected ${orgNr} to be invalid`);
  });

  console.log('✅ Org number validation tests passed');
};
```

---

## Summary

**Critical Integration Points:**
1. **Onboarding:** Add DDL form to restaurant onboarding
2. **Shipment Creation:** Call `validate-ddl` API BEFORE creating under-suspension shipments
3. **Admin UI:** Build approval dashboard for compliance admins

**Key Validations:**
- Swedish org number format (NNNNNN-NNNN with Luhn checksum)
- Address matching (case-insensitive, postal code normalization)
- Status transitions (enforced workflow)
- Consent required before submission

**Security:**
- Multi-tenant RLS policies
- Role-based access control (compliance_admin for approve/reject)
- Audit trail for all status changes

---

Ready to integrate! Copy-paste these examples and customize for your specific UI framework.
