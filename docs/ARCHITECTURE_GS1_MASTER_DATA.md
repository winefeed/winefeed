# Winefeed Master Data Architecture with GS1 Integration

**Date:** 2026-01-14
**Status:** 🏗️ Architecture Proposal
**Focus:** GTIN/GLN Verification + Master Data Foundation

---

## 🎯 Core Principle

> **Winefeed uses GS1 as a verification and anchoring layer, never as a primary product model.**

GS1 data (GTIN/GLN) is used to *verify* and *enrich* Winefeed's internal master data.
Winefeed's own identifiers (`wf_product_id`, `wf_party_id`) remain the primary keys for all operations.

---

## ❌ Non-Goals

These are explicitly **out of scope** for this architecture:

| Non-Goal | Rationale |
|----------|-----------|
| **Winefeed will not act as a GS1 datapool** | We consume GS1 for verification, not syndication |
| **Winefeed will not enforce GTIN presence at draft level** | Suppliers can create products without GTIN; verification is optional |
| **Winefeed will not attempt real-time GS1 synchronization** | Verify + cache pattern; batch refresh, not streaming |
| **GTIN is not required for trade eligibility** | Confidence scoring allows trade at any level with appropriate controls |

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Logical Components](#logical-components)
3. [Data Model](#data-model)
4. [Phased Implementation Plan](#phased-implementation-plan)
5. [Use Case Mapping](#use-case-mapping)
6. [Integration Patterns](#integration-patterns)
7. [Data Governance](#data-governance)

---

## Architecture Overview

### Design Principles

```
┌─────────────────────────────────────────────────────────────────┐
│ ARCHITECTURAL CONSTRAINTS (FROM BUSINESS INTENT)                 │
├─────────────────────────────────────────────────────────────────┤
│ 1. STABLE IDENTIFIERS: Use GTIN/GLN as "golden keys"           │
│ 2. VERIFY + CACHE: Not real-time; cache verified attributes     │
│ 3. CONFIDENCE SCORING: Explicit match confidence levels         │
│ 4. AUDIT EVERYTHING: Full provenance for all master data        │
│ 5. GRACEFUL DEGRADATION: Operate if GS1 APIs are down          │
│ 6. HUMAN IN LOOP: Review queue for uncertain matches            │
└─────────────────────────────────────────────────────────────────┘
```

### Target Outcomes (Business Goals)

✅ **Reduce manual product de-duplication** (supplier SKUs → one master product)
✅ **Improve product identity confidence** (correct wine, vintage, volume, pack)
✅ **Stabilize party/location identity** (GLN-based delivery sites, billing)
✅ **Enable reliable reconciliation** (order ↔ shipment ↔ invoice via GTINs)
✅ **Audit-ready foundation** (provenance, retention, change logs)

---

### Confidence Score Contract

The `confidence_score` (0.00 – 1.00) is a **system-wide contract** used across Winefeed:

```
┌────────────────────────────────────────────────────────────────┐
│ CONFIDENCE SCORE CONTRACT                                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Score Range    │ Meaning               │ System Behavior       │
│  ───────────────┼───────────────────────┼─────────────────────  │
│  1.00           │ GTIN verified by GS1  │ Full automation       │
│  0.90 - 0.99    │ Known SKU mapping     │ Auto-match, no review │
│  0.85 - 0.89    │ High fuzzy match      │ Auto-match, flagged   │
│  0.50 - 0.84    │ Uncertain match       │ Human review required │
│  < 0.50         │ Low confidence        │ Manual matching only  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Used for:**
- **Trade eligibility** – Higher confidence = lower friction in checkout
- **Automation thresholds** – When to auto-match vs. queue for review
- **Partner trust weighting** – Verified products ranked higher in search
- **Audit compliance** – Risk assessment for B2B transactions

**Example usage in code:**
```typescript
if (match.confidence_score >= 0.85) {
  await autoLinkToMasterProduct(match);
} else {
  await queueForHumanReview(match);
}
```

---

## Logical Components

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         WINEFEED ARCHITECTURE                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ APPLICATION LAYER (Existing)                                     │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  • Quote Requests       • Supplier Catalog Import                │   │
│  │  • Offers               • Restaurant Orders                      │   │
│  │  • Commercial Intents   • Invoice Matching                       │   │
│  └────────────────┬────────────────────────────────────────────────┘   │
│                   │                                                       │
│                   ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ MATCHING ENGINE (New)                                            │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  • Confidence Scoring    • Rule Engine (GTIN → SKU → Fuzzy)     │   │
│  │  • Human Review Queue    • Match Decision Audit                  │   │
│  │  • Guardrails (volume/pack/vintage validation)                   │   │
│  └────────────────┬────────────────────────────────────────────────┘   │
│                   │                                                       │
│                   ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ MASTER DATA LAYER (New - Core)                                   │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  📦 MasterProduct (wf_product_id)                                │   │
│  │  🏷️  ProductFamily (wf_product_family_id)                        │   │
│  │  🏢 Party (wf_party_id)                                          │   │
│  │  📍 Location (wf_location_id)                                    │   │
│  │  🔗 Mappings (supplier_sku → wf_product_id)                      │   │
│  └────────────────┬────────────────────────────────────────────────┘   │
│                   │                                                       │
│                   ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ VERIFICATION SERVICE (New)                                       │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  • GS1 API Client (GTIN/GLN verification)                        │   │
│  │  • Verification Cache (local, TTL-based)                         │   │
│  │  • Rate Limiter + Circuit Breaker                                │   │
│  │  • Fallback: operate without real-time verification              │   │
│  └────────────────┬────────────────────────────────────────────────┘   │
│                   │                                                       │
│                   ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ DATA GOVERNANCE (New)                                            │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  📝 Change Log (who/when/source/before/after)                    │   │
│  │  🔍 Provenance Tracking (data_source, verification_timestamp)    │   │
│  │  📊 Retention Policies (B2B compliance)                          │   │
│  │  🛡️ Access Control (RLS on master data)                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ EXTERNAL INTEGRATIONS                                            │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  🇸🇪 GS1 Sweden (Validoo / Verified by GS1)                      │   │
│  │  📦 Future: GDSN, Logistics APIs, Accounting APIs                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. **Master Data Layer** (Golden Records)
- **Purpose:** Single source of truth for products, parties, locations
- **Owns:** Stable IDs (wf_product_id, wf_party_id, wf_location_id)
- **Stores:** GTIN/GLN as preferred secondary keys
- **Guarantees:** No duplicates, full audit trail

#### 2. **Matching Engine** (Intelligence)
- **Purpose:** Map supplier data → master data with confidence
- **Algorithms:** GTIN exact match → SKU mapping → fuzzy attributes
- **Guardrails:** Block mismatches on critical fields (volume, pack)
- **Human Loop:** Queue uncertain matches for review

#### 3. **Verification Service** (External Data)
- **Purpose:** Verify GTIN/GLN against GS1 Sweden APIs
- **Pattern:** Verify once, cache locally (TTL-based refresh)
- **Resilience:** Circuit breaker for API failures, graceful degradation
- **Rate Limits:** Respect GS1 API limits, batch where possible

#### 4. **Data Governance** (Trust & Compliance)
- **Purpose:** Auditability, provenance, retention
- **Logs:** Every master data change (before/after snapshots)
- **Provenance:** Track data source (supplier/manual/gs1/import)
- **Retention:** B2B-compliant data lifecycle policies

---

## Data Model

### Schema Design Principles

```
┌────────────────────────────────────────────────────────────────┐
│ MASTER DATA DESIGN RULES                                        │
├────────────────────────────────────────────────────────────────┤
│ 1. Stable IDs: wf_product_id (UUID, immutable)                │
│ 2. Secondary Keys: GTIN (preferred when available)             │
│ 3. Provenance: data_source, verified_at, match_confidence      │
│ 4. Audit: Every update logged (before/after + reason)          │
│ 5. Soft Deletes: is_active (never hard delete master data)     │
│ 6. Change Tracking: updated_at + updated_by (audit trail)      │
└────────────────────────────────────────────────────────────────┘
```

---

### Core Tables

#### 1. `product_families` (Vintage-Agnostic Wine Families)

```sql
CREATE TABLE product_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  wf_product_family_id TEXT UNIQUE NOT NULL, -- e.g., "WF-FAM-00001"

  -- Attributes
  producer TEXT NOT NULL,                    -- "Château Margaux"
  wine_name TEXT NOT NULL,                   -- "Grand Vin"
  country TEXT NOT NULL,                     -- "France"
  region TEXT,                               -- "Bordeaux / Margaux"
  appellation TEXT,                          -- "AOC Margaux"
  grape_varieties TEXT[],                    -- ["Cabernet Sauvignon", "Merlot"]

  -- Metadata
  data_source TEXT NOT NULL,                 -- 'supplier' | 'manual' | 'import'
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: same producer + wine = one family
  CONSTRAINT unique_wine_family UNIQUE (producer, wine_name, country)
);

COMMENT ON TABLE product_families IS
  'Vintage-agnostic wine families. One family = one producer + wine name combination.';
```

---

#### 2. `master_products` (Golden Product Records)

```sql
CREATE TABLE master_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  wf_product_id TEXT UNIQUE NOT NULL,        -- e.g., "WF-PROD-00001"
  product_family_id UUID REFERENCES product_families(id),

  -- Product Attributes (Snapshot)
  producer TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  vintage INT,                               -- NULL = NV (non-vintage)
  volume_ml INT NOT NULL,                    -- 750, 375, 1500, etc.
  pack_size INT DEFAULT 1,                   -- 1 (bottle), 6 (case), 12 (case)

  country TEXT NOT NULL,
  region TEXT,
  appellation TEXT,
  grape_varieties TEXT[],
  wine_type TEXT,                            -- 'red' | 'white' | 'rosé' | 'sparkling'

  -- Verification & Provenance
  data_source TEXT NOT NULL,                 -- 'supplier' | 'manual' | 'gs1' | 'import'
  match_confidence DECIMAL(3,2),             -- 0.00 to 1.00 (1.00 = verified GTIN)
  verified_at TIMESTAMPTZ,
  verified_by_source TEXT,                   -- 'gs1_sweden' | 'manual_review'

  -- Master Data Governance
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_volume CHECK (volume_ml > 0),
  CONSTRAINT valid_pack_size CHECK (pack_size > 0),
  CONSTRAINT valid_vintage CHECK (vintage IS NULL OR (vintage >= 1900 AND vintage <= 2100))
);

CREATE INDEX idx_master_products_family ON master_products(product_family_id);
CREATE INDEX idx_master_products_producer ON master_products(producer);
CREATE INDEX idx_master_products_vintage ON master_products(vintage);

COMMENT ON TABLE master_products IS
  'Golden product records. One record per unique product (producer + wine + vintage + volume + pack).';

COMMENT ON COLUMN master_products.wf_product_id IS
  'Stable Winefeed product identifier. Never reused, never deleted.';
```

---

#### 3. `product_gtin_registry` (GTIN → Master Product)

```sql
CREATE TABLE product_gtin_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  master_product_id UUID NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,

  -- GTIN
  gtin TEXT NOT NULL,                        -- 14-digit GTIN (GTIN-14)
  gtin_type TEXT NOT NULL,                   -- 'GTIN-14' | 'GTIN-13' | 'GTIN-12' | 'GTIN-8'
  packaging_level TEXT NOT NULL,             -- 'EACH' (bottle) | 'CASE' (box)

  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_source TEXT,                  -- 'gs1_sweden' | 'manual'
  verification_method TEXT,                  -- 'api_verified' | 'manual_entry' | 'supplier_provided'

  -- Cached GS1 Attributes (from verification)
  gs1_brand_name TEXT,
  gs1_product_description TEXT,
  gs1_net_content TEXT,                      -- e.g., "750 ml"
  gs1_target_market TEXT[],                  -- ["SE", "NO", "DK"]
  gs1_data_cached_at TIMESTAMPTZ,

  -- Provenance
  data_source TEXT NOT NULL,                 -- 'supplier' | 'gs1' | 'manual'
  added_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_gtin UNIQUE (gtin),
  CONSTRAINT valid_gtin_length CHECK (length(gtin) IN (8, 12, 13, 14))
);

CREATE INDEX idx_gtin_registry_product ON product_gtin_registry(master_product_id);
CREATE INDEX idx_gtin_registry_gtin ON product_gtin_registry(gtin);
CREATE INDEX idx_gtin_registry_verified ON product_gtin_registry(is_verified);

COMMENT ON TABLE product_gtin_registry IS
  'GTIN registry linking verified GTINs to master products. One GTIN = one master product.';

COMMENT ON COLUMN product_gtin_registry.packaging_level IS
  'EACH = single bottle, CASE = case/box (6-pack, 12-pack, etc.)';
```

---

#### 4. `supplier_product_mappings` (Supplier SKU → Master Product)

```sql
CREATE TABLE supplier_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_wine_id UUID NOT NULL REFERENCES supplier_wines(id) ON DELETE CASCADE,
  master_product_id UUID REFERENCES master_products(id) ON DELETE SET NULL,

  -- Supplier Identifiers
  supplier_sku TEXT NOT NULL,                -- Supplier's internal SKU/code
  supplier_gtin TEXT,                        -- GTIN provided by supplier (unverified)

  -- Mapping Metadata
  mapping_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'matched' | 'reviewed' | 'rejected'
  match_confidence DECIMAL(3,2),             -- 0.00 to 1.00
  match_method TEXT,                         -- 'gtin_exact' | 'sku_mapping' | 'fuzzy' | 'manual'
  match_reason_codes TEXT[],                 -- ['gtin_match', 'volume_match', 'vintage_match']

  -- Human Review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Provenance
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_supplier_wine_mapping UNIQUE (supplier_wine_id),
  CONSTRAINT valid_confidence CHECK (match_confidence >= 0 AND match_confidence <= 1)
);

CREATE INDEX idx_supplier_mappings_supplier ON supplier_product_mappings(supplier_id);
CREATE INDEX idx_supplier_mappings_master ON supplier_product_mappings(master_product_id);
CREATE INDEX idx_supplier_mappings_status ON supplier_product_mappings(mapping_status);
CREATE INDEX idx_supplier_mappings_sku ON supplier_product_mappings(supplier_sku);

COMMENT ON TABLE supplier_product_mappings IS
  'Maps supplier catalog items (supplier_wines) to master products. Enables multi-supplier de-duplication.';
```

---

#### 5. `master_parties` (Companies: Suppliers, Restaurants, Producers)

```sql
CREATE TABLE master_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  wf_party_id TEXT UNIQUE NOT NULL,          -- e.g., "WF-PARTY-00001"

  -- Attributes
  legal_name TEXT NOT NULL,
  trading_name TEXT,
  party_type TEXT NOT NULL,                  -- 'SUPPLIER' | 'RESTAURANT' | 'PRODUCER' | 'LOGISTICS'
  country_code TEXT NOT NULL,                -- ISO 3166-1 alpha-2 ("SE", "FR")

  -- Tax & Legal
  vat_number TEXT,                           -- EU VAT number
  org_number TEXT,                           -- Swedish org number

  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_source TEXT,                  -- 'gs1_sweden' | 'bolagsverket' | 'manual'

  -- Metadata
  data_source TEXT NOT NULL,                 -- 'supplier_onboarding' | 'import' | 'manual'
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_master_parties_type ON master_parties(party_type);
CREATE INDEX idx_master_parties_country ON master_parties(country_code);

COMMENT ON TABLE master_parties IS
  'Golden party records (companies). Includes suppliers, restaurants, producers, logistics partners.';
```

---

#### 6. `party_gln_registry` (GLN → Master Party)

```sql
CREATE TABLE party_gln_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  master_party_id UUID NOT NULL REFERENCES master_parties(id) ON DELETE CASCADE,

  -- GLN
  gln TEXT NOT NULL,                         -- 13-digit GLN
  gln_type TEXT NOT NULL,                    -- 'LEGAL_ENTITY' | 'FUNCTION' | 'PHYSICAL_LOCATION'

  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_source TEXT,                  -- 'gs1_sweden' | 'manual'

  -- Cached GS1 Attributes
  gs1_party_name TEXT,
  gs1_address TEXT,
  gs1_city TEXT,
  gs1_postal_code TEXT,
  gs1_country TEXT,
  gs1_data_cached_at TIMESTAMPTZ,

  -- Provenance
  data_source TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_gln UNIQUE (gln),
  CONSTRAINT valid_gln_length CHECK (length(gln) = 13)
);

CREATE INDEX idx_gln_registry_party ON party_gln_registry(master_party_id);
CREATE INDEX idx_gln_registry_gln ON party_gln_registry(gln);

COMMENT ON TABLE party_gln_registry IS
  'GLN registry linking verified GLNs to master parties.';
```

---

#### 7. `master_locations` (Physical Sites: Warehouses, Restaurants)

```sql
CREATE TABLE master_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  wf_location_id TEXT UNIQUE NOT NULL,       -- e.g., "WF-LOC-00001"

  -- Relations
  master_party_id UUID NOT NULL REFERENCES master_parties(id),

  -- Attributes
  location_name TEXT NOT NULL,
  location_type TEXT NOT NULL,               -- 'WAREHOUSE' | 'RESTAURANT' | 'OFFICE' | 'DELIVERY_SITE'

  -- Address
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country_code TEXT NOT NULL,

  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_source TEXT,

  -- Metadata
  data_source TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_master_locations_party ON master_locations(master_party_id);
CREATE INDEX idx_master_locations_type ON master_locations(location_type);
CREATE INDEX idx_master_locations_country ON master_locations(country_code);

COMMENT ON TABLE master_locations IS
  'Physical locations (warehouses, delivery sites). Owned by parties.';
```

---

#### 8. `location_gln_registry` (GLN → Location)

```sql
CREATE TABLE location_gln_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  master_location_id UUID NOT NULL REFERENCES master_locations(id) ON DELETE CASCADE,

  -- GLN
  gln TEXT NOT NULL,                         -- 13-digit GLN (physical location)

  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verification_source TEXT,

  -- Cached GS1 Attributes
  gs1_location_name TEXT,
  gs1_address TEXT,
  gs1_city TEXT,
  gs1_postal_code TEXT,
  gs1_country TEXT,
  gs1_data_cached_at TIMESTAMPTZ,

  -- Provenance
  data_source TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_location_gln UNIQUE (gln),
  CONSTRAINT valid_location_gln_length CHECK (length(gln) = 13)
);

CREATE INDEX idx_location_gln_registry_location ON location_gln_registry(master_location_id);
CREATE INDEX idx_location_gln_registry_gln ON location_gln_registry(gln);
```

---

#### 9. `matching_decisions` (Audit Trail for Matches)

```sql
CREATE TABLE matching_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  supplier_product_mapping_id UUID REFERENCES supplier_product_mappings(id) ON DELETE CASCADE,
  master_product_id UUID REFERENCES master_products(id),

  -- Decision
  decision_type TEXT NOT NULL,               -- 'auto_match' | 'manual_match' | 'reject'
  match_confidence DECIMAL(3,2) NOT NULL,
  match_method TEXT NOT NULL,                -- 'gtin_exact' | 'sku_lookup' | 'fuzzy_attributes'
  match_reason_codes TEXT[],

  -- Input Context (Snapshot)
  input_supplier_sku TEXT NOT NULL,
  input_supplier_gtin TEXT,
  input_wine_name TEXT,
  input_producer TEXT,
  input_vintage INT,
  input_volume_ml INT,

  -- Output Context
  output_master_product_id TEXT,
  output_wf_product_id TEXT,
  output_match_score DECIMAL(5,2),           -- Detailed scoring

  -- Human Review (if applicable)
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_action TEXT,                        -- 'approved' | 'rejected' | 'created_new_master'
  review_notes TEXT,

  -- Metadata
  decision_timestamp TIMESTAMPTZ DEFAULT NOW(),
  decision_source TEXT NOT NULL,             -- 'matching_engine' | 'manual_review' | 'api'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matching_decisions_mapping ON matching_decisions(supplier_product_mapping_id);
CREATE INDEX idx_matching_decisions_master ON matching_decisions(master_product_id);
CREATE INDEX idx_matching_decisions_type ON matching_decisions(decision_type);
CREATE INDEX idx_matching_decisions_timestamp ON matching_decisions(decision_timestamp);

COMMENT ON TABLE matching_decisions IS
  'Audit trail of all product matching decisions (auto + manual). Immutable append-only log.';
```

---

#### 10. `gs1_verification_cache` (Cached GS1 API Responses)

```sql
CREATE TABLE gs1_verification_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifier
  identifier TEXT NOT NULL,                  -- GTIN or GLN
  identifier_type TEXT NOT NULL,             -- 'GTIN' | 'GLN'

  -- Verification Result
  is_valid BOOLEAN NOT NULL,
  verification_status TEXT NOT NULL,         -- 'VERIFIED' | 'NOT_FOUND' | 'INVALID' | 'ERROR'

  -- Cached Attributes (JSON blob from GS1 API)
  gs1_attributes JSONB,                      -- Full GS1 response

  -- Cache Metadata
  verified_at TIMESTAMPTZ NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  cache_expires_at TIMESTAMPTZ NOT NULL,     -- TTL: e.g., 30 days
  api_source TEXT NOT NULL,                  -- 'gs1_sweden_validoo' | 'gs1_grp'

  -- API Call Metadata
  api_request_id TEXT,
  api_response_code INT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_cached_identifier UNIQUE (identifier, identifier_type)
);

CREATE INDEX idx_gs1_cache_identifier ON gs1_verification_cache(identifier);
CREATE INDEX idx_gs1_cache_expires ON gs1_verification_cache(cache_expires_at);
CREATE INDEX idx_gs1_cache_status ON gs1_verification_cache(verification_status);

COMMENT ON TABLE gs1_verification_cache IS
  'Cache of GS1 API verification results. TTL-based expiration. Reduces API calls and cost.';
```

---

#### 11. `data_change_log` (Universal Audit Log)

```sql
CREATE TABLE data_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What Changed
  table_name TEXT NOT NULL,                  -- 'master_products' | 'product_gtin_registry'
  record_id UUID NOT NULL,                   -- ID of the changed record
  operation TEXT NOT NULL,                   -- 'INSERT' | 'UPDATE' | 'DELETE'

  -- Change Details
  before_snapshot JSONB,                     -- Full record before change
  after_snapshot JSONB,                      -- Full record after change
  changed_fields TEXT[],                     -- List of changed field names

  -- Context
  change_reason TEXT,                        -- 'supplier_import' | 'manual_correction' | 'gs1_verification'
  change_source TEXT NOT NULL,               -- 'api' | 'manual' | 'import_job' | 'matching_engine'

  -- Actor
  changed_by UUID REFERENCES auth.users(id),
  changed_by_ip TEXT,

  -- Timestamps
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_change_log_table ON data_change_log(table_name);
CREATE INDEX idx_change_log_record ON data_change_log(record_id);
CREATE INDEX idx_change_log_timestamp ON data_change_log(changed_at);
CREATE INDEX idx_change_log_user ON data_change_log(changed_by);

COMMENT ON TABLE data_change_log IS
  'Universal audit log for all master data changes. Immutable append-only. Retention: 7+ years.';
```

---

### Linking Existing Tables to Master Data

#### Update `supplier_wines` (Existing)

```sql
-- Add master data link to existing supplier_wines table
ALTER TABLE supplier_wines
  ADD COLUMN master_product_id UUID REFERENCES master_products(id);

-- Index for reverse lookups
CREATE INDEX idx_supplier_wines_master_product ON supplier_wines(master_product_id);

COMMENT ON COLUMN supplier_wines.master_product_id IS
  'Link to master product (golden record). NULL if not yet mapped.';
```

#### Update `offers` (Existing)

```sql
-- Add master product reference to offers
ALTER TABLE offers
  ADD COLUMN master_product_id UUID REFERENCES master_products(id);

CREATE INDEX idx_offers_master_product ON offers(master_product_id);

COMMENT ON COLUMN offers.master_product_id IS
  'Denormalized master product for fast reconciliation and reporting.';
```

#### Update `commercial_intents` (Existing)

```sql
-- Add master product for reconciliation
ALTER TABLE commercial_intents
  ADD COLUMN master_product_id UUID REFERENCES master_products(id);

CREATE INDEX idx_commercial_intents_master_product ON commercial_intents(master_product_id);

COMMENT ON COLUMN commercial_intents.master_product_id IS
  'Master product snapshot at time of order acceptance. Enables cross-supplier analytics.';
```

---

## Phased Implementation Plan

### Phase 1: GTIN Verification + Product Matching (MVP)
**Duration:** 4-6 weeks
**Goal:** Enable reliable product matching with GTIN verification

#### Deliverables

**1.1 Database Layer**
- ✅ Create `product_families` table
- ✅ Create `master_products` table
- ✅ Create `product_gtin_registry` table
- ✅ Create `supplier_product_mappings` table
- ✅ Create `matching_decisions` table (audit trail)
- ✅ Create `gs1_verification_cache` table
- ✅ Create `data_change_log` table
- ✅ Add `master_product_id` to `supplier_wines`, `offers`, `commercial_intents`

**1.2 Verification Service**
- ✅ GS1 Sweden API client (GTIN verification)
  - Endpoint: GS1 Validoo / Verified by GS1
  - Rate limiting (e.g., 100 calls/hour)
  - Circuit breaker (fail gracefully if API down)
- ✅ Verification cache service
  - Cache TTL: 30 days for verified GTINs
  - Cache TTL: 7 days for "not found" results
  - Background refresh job (weekly)
- ✅ Service interface: `verifyGTIN(gtin: string): Promise<VerificationResult>`

**1.3 Matching Engine**
- ✅ Rule engine with confidence scoring
  - **Rule 1:** GTIN exact match → confidence 1.00 (verified)
  - **Rule 2:** Existing SKU mapping → confidence 0.90 (known)
  - **Rule 3:** Fuzzy attribute match → confidence 0.50-0.80 (uncertain)
- ✅ Guardrails:
  - Block match if `volume_ml` differs
  - Block match if `pack_size` differs
  - Handle vintage: match family if vintage missing
- ✅ Human review queue
  - API: `GET /api/admin/product-mappings?status=pending`
  - Confidence threshold: < 0.85 → human review

**1.4 APIs**
- ✅ `POST /api/admin/master-products` - Create master product
- ✅ `GET /api/admin/master-products` - List with filters
- ✅ `GET /api/admin/master-products/:id` - Get details
- ✅ `PATCH /api/admin/master-products/:id` - Update (logged)
- ✅ `POST /api/admin/master-products/:id/verify-gtin` - Verify GTIN via GS1
- ✅ `POST /api/suppliers/:id/catalog/import` - **Update existing endpoint**
  - Auto-match supplier wines to master products
  - Create `supplier_product_mappings`
  - Log matching decisions

**1.5 Admin UI (Minimal)**
- ✅ Product mapping review page
  - List pending mappings
  - Show confidence score + reason codes
  - Actions: Approve / Reject / Create New Master
- ✅ Master product search
  - Search by producer, wine name, vintage, GTIN

**1.6 Migration & Backfill**
- ✅ Migrate existing `supplier_wines` → master products
  - Create initial master products from existing data
  - De-duplicate based on producer + wine + vintage + volume
  - Create mappings with confidence = 0.70 (fuzzy, needs review)

---

### Phase 2: GLN Verification + Party/Location (3-4 weeks)
**Goal:** Stable party and location identifiers for delivery and billing

#### Deliverables

**2.1 Database Layer**
- ✅ Create `master_parties` table
- ✅ Create `party_gln_registry` table
- ✅ Create `master_locations` table
- ✅ Create `location_gln_registry` table
- ✅ Link existing `suppliers` and `restaurants` to `master_parties`
  - Add `master_party_id` to `suppliers` and `restaurants`

**2.2 Verification Service**
- ✅ GLN verification via GS1 Sweden
  - Verify party GLNs (legal entity)
  - Verify location GLNs (physical sites)
  - Cache results (30-day TTL)

**2.3 APIs**
- ✅ `POST /api/admin/master-parties` - Create party
- ✅ `POST /api/admin/master-parties/:id/verify-gln` - Verify GLN
- ✅ `POST /api/admin/master-locations` - Create location
- ✅ `POST /api/admin/master-locations/:id/verify-gln` - Verify location GLN
- ✅ `GET /api/restaurants/:id/delivery-sites` - List delivery sites (GLN-based)

**2.4 Integration Points**
- ✅ Supplier onboarding: prompt for GLN (optional)
- ✅ Restaurant onboarding: prompt for delivery site GLNs
- ✅ Order flow: use GLN for delivery address (if available)

**2.5 Migration**
- ✅ Backfill `master_parties` from existing suppliers/restaurants
- ✅ Link existing records to master parties

---

### Phase 3: Advanced Compliance & Audit (2-3 weeks)
**Goal:** Production-grade data governance and compliance features

#### Deliverables

**3.1 Enhanced Audit Trails**
- ✅ Database triggers for automatic change logging
  - Trigger on `master_products` → log to `data_change_log`
  - Trigger on `product_gtin_registry` → log changes
- ✅ Retention policies
  - Change log: 7 years (B2B compliance)
  - Verification cache: 90 days
  - Matching decisions: Permanent (audit trail)

**3.2 Advanced Matching**
- ✅ ML-based fuzzy matching (optional enhancement)
  - Train on approved matches
  - Improve confidence scoring
- ✅ Batch matching service
  - Process large imports without blocking
  - Background job: match → review queue → approve

**3.3 Compliance Reporting**
- ✅ `GET /api/admin/audit/product-changes` - Product change history
- ✅ `GET /api/admin/audit/gtin-verifications` - GTIN verification log
- ✅ `GET /api/admin/audit/matching-decisions` - Matching decision log
- ✅ Export to CSV for audits

**3.4 Data Quality Dashboard**
- ✅ Metrics:
  - % products with verified GTIN
  - % products mapped to master
  - % parties with verified GLN
  - Pending review queue size
- ✅ Alerts:
  - High queue backlog (> 100 pending)
  - Low verification rate (< 50%)
  - GS1 API errors

---

## Use Case Mapping

### Use Case 1: Supplier Catalog Import with GTIN Verification

**Flow:**
```
1. Supplier uploads CSV with GTINs
   ↓
2. System extracts GTINs from catalog
   ↓
3. Verification Service checks GTINs (GS1 cache first, then API)
   ↓
4. Matching Engine attempts auto-match:
   a) GTIN exact match → confidence 1.00 → auto-link
   b) No GTIN → fuzzy match → confidence 0.60 → review queue
   ↓
5. Create supplier_product_mappings
   ↓
6. Log matching decisions (audit trail)
   ↓
7. Admin reviews pending mappings (< 0.85 confidence)
```

**Components Used:**
- Master Data Layer: `master_products`, `product_gtin_registry`, `supplier_product_mappings`
- Verification Service: `verifyGTIN()`, cache
- Matching Engine: GTIN exact match rule
- Data Governance: `matching_decisions`, `data_change_log`

**Outcome:**
- Verified products auto-linked with confidence 1.00
- Unverified products queued for human review
- Full audit trail of decisions

---

### Use Case 2: Quote Request Matching Using Verified Products

**Flow:**
```
1. Restaurant creates quote request (fritext: "Bordeaux 2015, 12 bottles")
   ↓
2. Routing engine matches to suppliers (existing logic)
   ↓
3. For each supplier match, system checks:
   - supplier_product_mappings → master_product_id
   - master_product has verified GTIN?
   ↓
4. Prioritize suppliers with verified products (higher confidence)
   ↓
5. Supplier creates offer → system links to master_product_id
   ↓
6. Restaurant sees offers with product confidence indicators
```

**Components Used:**
- Matching Engine: Query `supplier_product_mappings` for verified products
- Master Data Layer: `master_products` with `match_confidence`
- Application Layer: Existing quote request + routing

**Outcome:**
- Offers with verified GTINs have higher trust scores
- Reduces product mismatch errors
- Enables cross-supplier comparison on "same" product

---

### Use Case 3: Order Reconciliation Using GTINs

**Flow:**
```
1. Restaurant accepts offer → CommercialIntent created
   ↓
2. System stores master_product_id in commercial_intent
   ↓
3. Supplier ships order → includes GTIN on packing slip
   ↓
4. Restaurant receives shipment → scans GTIN barcode
   ↓
5. System looks up GTIN → master_product_id
   ↓
6. Match against commercial_intent.master_product_id
   ↓
7. If match: auto-confirm receipt
   If mismatch: alert + manual review
```

**Components Used:**
- Master Data Layer: `product_gtin_registry`, `master_products`
- Application Layer: `commercial_intents` with `master_product_id`
- Future: Shipment tracking module

**Outcome:**
- Automated order-shipment reconciliation
- Catch wrong products at receipt time
- Reduce invoice disputes

---

### Use Case 4: Invoice Matching Using GLNs

**Flow:**
```
1. Supplier sends invoice with:
   - Buyer GLN (restaurant)
   - Ship-to GLN (delivery site)
   - Product GTINs
   ↓
2. System looks up GLNs:
   - Buyer GLN → master_party_id (restaurant)
   - Ship-to GLN → master_location_id
   ↓
3. System looks up GTINs → master_product_ids
   ↓
4. Match against commercial_intent:
   - Restaurant match? ✓
   - Product match? ✓
   - Delivery location match? ✓
   ↓
5. If all match: auto-approve invoice
   If mismatch: flag for review
```

**Components Used:**
- Master Data Layer: `party_gln_registry`, `location_gln_registry`, `product_gtin_registry`
- Application Layer: `commercial_intents`
- Future: Invoice matching module

**Outcome:**
- Automated 3-way matching (PO → shipment → invoice)
- Reduce manual reconciliation work
- Catch billing errors early

---

### Use Case 5: Multi-Supplier Product De-Duplication

**Flow:**
```
1. Supplier A imports: "Château Margaux 2015, 750ml" (GTIN: 123456789)
   ↓
2. Matching Engine finds master_product via GTIN → links to master_product_id=WF-001
   ↓
3. Supplier B imports: "Château Margaux 2015, 750ml" (GTIN: 123456789)
   ↓
4. Matching Engine finds same GTIN → links to same master_product_id=WF-001
   ↓
5. Restaurant searches "Château Margaux 2015"
   ↓
6. System shows:
   - Master Product: Château Margaux 2015, 750ml (verified GTIN)
   - Supplier A offer: 390 SEK
   - Supplier B offer: 370 SEK
```

**Components Used:**
- Master Data Layer: `master_products`, `supplier_product_mappings`
- Matching Engine: GTIN exact match
- Application Layer: Quote request offers

**Outcome:**
- Restaurant sees true price comparison (same product)
- No duplicate master products
- Higher confidence in product identity

---

## Integration Patterns

### GS1 API Integration Pattern

```
┌────────────────────────────────────────────────────────────────┐
│ VERIFY + CACHE PATTERN (NOT REAL-TIME)                         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    1. Check Cache                             │
│  │             │◄───────────────────┐                          │
│  │   Winefeed  │                    │                          │
│  │   API       │    2. Cache Hit?   │                          │
│  │             │─────────────────►  │   ┌──────────────────┐  │
│  └─────────────┘    Return cached  └───┤ gs1_verification │  │
│         │           data                │ _cache (30d TTL) │  │
│         │                               └──────────────────┘  │
│         │ 3. Cache Miss                                        │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │ GS1 API     │    4. Verify GTIN/GLN                         │
│  │ Client      │───────────────────►  ┌──────────────────┐   │
│  │             │                       │ GS1 Sweden API   │   │
│  │             │◄───────────────────   │ (Validoo / GRP)  │   │
│  └─────────────┘    5. Return result  └──────────────────┘   │
│         │                                                       │
│         │ 6. Store in cache (TTL: 30 days)                     │
│         ▼                                                       │
│  ┌──────────────────┐                                          │
│  │ Verification     │                                          │
│  │ Cache            │                                          │
│  └──────────────────┘                                          │
│                                                                 │
│  BENEFITS:                                                      │
│  ✓ Reduce API calls (cost optimization)                        │
│  ✓ Fast response (no waiting for GS1)                          │
│  ✓ Operate during GS1 outages (cached data)                    │
│  ✓ Rate limit compliance (batch refresh)                       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Rate Limiting & Circuit Breaker

```typescript
// Pseudo-code for GS1 client with resilience

class GS1Client {
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  async verifyGTIN(gtin: string): Promise<VerificationResult> {
    // 1. Check cache first
    const cached = await this.cache.get(gtin);
    if (cached && !cached.isExpired()) {
      return cached;
    }

    // 2. Check circuit breaker state
    if (this.circuitBreaker.isOpen()) {
      // GS1 API is down, use cached data or return "unverified"
      return { status: 'UNVERIFIED', reason: 'API_UNAVAILABLE' };
    }

    // 3. Check rate limit
    await this.rateLimiter.acquire();

    // 4. Call GS1 API
    try {
      const result = await this.callGS1API(gtin);

      // 5. Cache result
      await this.cache.set(gtin, result, TTL_30_DAYS);

      // 6. Record success
      this.circuitBreaker.recordSuccess();

      return result;
    } catch (error) {
      // 7. Record failure
      this.circuitBreaker.recordFailure();

      // 8. Return degraded result
      return { status: 'ERROR', reason: error.message };
    }
  }
}
```

### Matching Engine Confidence Scoring

```typescript
// Pseudo-code for matching engine

interface MatchRule {
  name: string;
  confidence: number;
  check: (input: SupplierProduct, master: MasterProduct) => boolean;
}

const MATCHING_RULES: MatchRule[] = [
  {
    name: 'GTIN_EXACT_MATCH',
    confidence: 1.00,
    check: (input, master) => {
      const masterGTIN = master.gtins[0]?.gtin;
      return input.gtin && input.gtin === masterGTIN;
    }
  },
  {
    name: 'SKU_MAPPING',
    confidence: 0.90,
    check: (input, master) => {
      const mapping = findExistingMapping(input.supplier_sku);
      return mapping?.master_product_id === master.id;
    }
  },
  {
    name: 'FUZZY_ATTRIBUTES',
    confidence: 0.50, // Variable based on similarity
    check: (input, master) => {
      const similarity = calculateSimilarity(input, master);
      return similarity > 0.80; // 80% threshold
    }
  }
];

async function matchSupplierProduct(input: SupplierProduct): Promise<MatchResult> {
  const candidates = await findCandidateMasterProducts(input);

  for (const master of candidates) {
    for (const rule of MATCHING_RULES) {
      if (rule.check(input, master)) {
        // Guardrails: block if critical attributes differ
        if (!validateGuardrails(input, master)) {
          continue; // Skip this match
        }

        return {
          master_product_id: master.id,
          confidence: rule.confidence,
          match_method: rule.name,
          match_reason_codes: [rule.name, ...getReasonCodes(input, master)]
        };
      }
    }
  }

  // No match found
  return {
    master_product_id: null,
    confidence: 0.00,
    match_method: 'NO_MATCH',
    match_reason_codes: ['no_candidate_found']
  };
}

function validateGuardrails(input: SupplierProduct, master: MasterProduct): boolean {
  // CRITICAL: Block match if these differ
  if (input.volume_ml !== master.volume_ml) return false;
  if (input.pack_size !== master.pack_size) return false;

  // VINTAGE: Allow match to family if vintage missing
  if (input.vintage && master.vintage && input.vintage !== master.vintage) {
    return false;
  }

  return true;
}
```

---

## Data Governance

### Change Logging (Automatic Triggers)

```sql
-- Example trigger for automatic change logging

CREATE OR REPLACE FUNCTION log_master_product_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_change_log (
    table_name,
    record_id,
    operation,
    before_snapshot,
    after_snapshot,
    changed_fields,
    change_source,
    changed_by,
    changed_at
  ) VALUES (
    'master_products',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
    CASE
      WHEN TG_OP = 'UPDATE' THEN
        ARRAY(SELECT key FROM jsonb_each(to_jsonb(NEW))
              WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key)
      ELSE NULL
    END,
    'database_trigger',
    NEW.updated_by,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER master_products_change_log
  AFTER INSERT OR UPDATE OR DELETE ON master_products
  FOR EACH ROW
  EXECUTE FUNCTION log_master_product_changes();
```

### Retention Policies

```sql
-- Retention policy for verification cache (90 days)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM gs1_verification_cache
  WHERE cache_expires_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule: Run daily via pg_cron or external scheduler
-- SELECT cron.schedule('cleanup-verification-cache', '0 2 * * *',
--   'SELECT cleanup_expired_verification_cache()');
```

### Provenance Tracking (Example Queries)

```sql
-- Query: Find all products verified by GS1
SELECT
  mp.wf_product_id,
  mp.producer,
  mp.wine_name,
  mp.vintage,
  pgr.gtin,
  pgr.verified_at,
  pgr.verification_source
FROM master_products mp
JOIN product_gtin_registry pgr ON pgr.master_product_id = mp.id
WHERE pgr.is_verified = TRUE
  AND pgr.verification_source = 'gs1_sweden';

-- Query: Audit trail for a specific product
SELECT
  dcl.operation,
  dcl.changed_fields,
  dcl.before_snapshot->>'wine_name' AS old_name,
  dcl.after_snapshot->>'wine_name' AS new_name,
  dcl.change_reason,
  u.email AS changed_by_user,
  dcl.changed_at
FROM data_change_log dcl
LEFT JOIN auth.users u ON u.id = dcl.changed_by
WHERE dcl.table_name = 'master_products'
  AND dcl.record_id = 'abc-123-def'
ORDER BY dcl.changed_at DESC;
```

---

## Summary: Architecture Alignment

### ✅ Business Intentions → Technical Implementation

| Business Intent | Technical Implementation |
|-----------------|--------------------------|
| **Stable "golden keys"** | `wf_product_id`, `wf_party_id`, `wf_location_id` (immutable UUIDs) |
| **GTIN/GLN as secondary keys** | `product_gtin_registry`, `party_gln_registry`, `location_gln_registry` |
| **Reduce manual de-duplication** | Matching engine with auto-match (confidence scoring) |
| **Improve product identity confidence** | GTIN verification via GS1 APIs, cached locally |
| **Stable location/party identity** | GLN-based party/location records |
| **Reliable reconciliation** | All transactions link to `master_product_id` (order ↔ shipment ↔ invoice) |
| **Audit-ready foundation** | `data_change_log` (immutable), provenance fields on all master data |
| **Verify + cache (not real-time)** | `gs1_verification_cache` with 30-day TTL |
| **Graceful degradation** | Circuit breaker, cached data fallback |
| **Human review queue** | `supplier_product_mappings` with `mapping_status='pending'` |

---

## Next Steps

### Immediate Actions

1. **Review & Approve Architecture**
   - Validate data model against current schema
   - Confirm phased approach aligns with roadmap

2. **Phase 1 Kickoff**
   - Implement core tables (master_products, product_gtin_registry)
   - Build GS1 API client with cache
   - Update supplier catalog import to use matching engine

3. **GS1 Sweden Account Setup**
   - Register for GS1 Sweden API access
   - Obtain API credentials (Validoo / Verified by GS1)
   - Test API endpoints with sample GTINs

4. **Data Migration Plan**
   - Audit existing `supplier_wines` data quality
   - Plan backfill of master products from existing data
   - Define confidence thresholds for auto-match vs. review

---

**Document Version:** 1.0
**Last Updated:** 2026-01-14
**Status:** 🏗️ Awaiting Approval
**Next Review:** After Phase 1 completion
