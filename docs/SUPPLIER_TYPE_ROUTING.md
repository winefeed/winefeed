# Winefeed Supplier Type Routing

## Overview

Winefeed is a B2B wine procurement platform connecting Swedish restaurants with wine suppliers. The system handles two distinct flows based on supplier type:

---

## Flow 1: Swedish Importer (Domestic)

**Supplier type:** `SWEDISH_IMPORTER`

```
Supplier ────────────▶ Restaurant
    │                      ▲
    └──────────────────────┘
         Direct invoice
```

**Characteristics:**
- Wine already in Sweden (Swedish warehouse)
- Excise tax already paid
- Direct invoicing: Supplier → Restaurant
- No import case needed
- No IOR involvement

**Winefeed's role:** Matchmaking platform (connects restaurants with suppliers)

---

## Flow 2: EU Import (Cross-border)

**Supplier types:** `EU_PRODUCER`, `EU_IMPORTER`

```
EU Supplier
     │
     ▼
Brasri AB (IOR)
     │
     │  • Handles excise tax
     │  • EMCS documentation
     │  • DDL registration
     │  • Compliance
     │
     ▼
Restaurant
     ▲
     │
Swedish invoice (all-inclusive)
     │
     • Wine
     • Shipping
     • Excise tax
     • VAT 25%
     • Winefeed fee
```

**Characteristics:**
- Wine shipped from EU (cross-border)
- Brasri AB acts as Importer of Record (IOR)
- Import case created automatically
- DDL (Direct Delivery Location) registration required
- Single Swedish invoice from Brasri to restaurant

**Winefeed's role:** Platform coordinator (orchestrates the flow, no invoicing)

---

## Billing Model (EU Flow)

**Brasri invoices restaurant for everything (Option 2):**

| Pros | Cons |
|------|------|
| Lowest friction for restaurants | Brasri becomes merchant of record |
| Single Swedish invoice (SEK) | Payment terms/risk on Brasri |
| Clear responsibility chain | |
| Winefeed takes no credit risk | |

**Revenue model:**
- Winefeed receives commission from Brasri (e.g., 5% of order value)
- Brasri margin on top (e.g., 4%)

---

## Technical Implementation

```typescript
// Automatic routing based on supplier type
if (supplier.type === 'SWEDISH_IMPORTER') {
  // Direct flow - no import case
  createOrder({ ior_required: false });
} else {
  // EU flow - create import case with Brasri as IOR
  createOrder({ ior_required: true });
  createImportCase({
    importer_id: brasriImporterId,
    requires_ddl: true
  });
}
```

**Database:** `suppliers.type` determines routing

**IOR matching:** Via `org_number` between `suppliers` and `importers` tables

---

## Summary Table

| Aspect | Swedish Importer | EU Import |
|--------|------------------|-----------|
| Supplier type | `SWEDISH_IMPORTER` | `EU_PRODUCER`, `EU_IMPORTER` |
| Wine location | Already in Sweden | Ships from EU |
| Excise tax | Already paid | Brasri handles |
| Import case | No | Yes |
| IOR | Not needed | Brasri AB |
| Invoice to restaurant | From supplier | From Brasri |
| Winefeed role | Matchmaking | Coordination |

---

## Related Documentation

- [IOR_COMPLIANCE_FLOW.md](./IOR_COMPLIANCE_FLOW.md) - Detailed IOR compliance flow
- [compliance/multi-supplier-type-model.md](./compliance/multi-supplier-type-model.md) - Multi-supplier type model
- [compliance/compliance-model-via-partner.md](./compliance/compliance-model-via-partner.md) - Partner compliance model

---

*Last updated: 2026-01-26*
