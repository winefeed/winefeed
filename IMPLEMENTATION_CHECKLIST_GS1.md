# GS1 Master Data Implementation Checklist

**Project:** Winefeed Master Data + GS1 Integration
**Status:** 📋 Planning Phase
**Last Updated:** 2026-01-14

---

## Phase 1: GTIN Verification + Product Matching (4-6 weeks)

### Week 1-2: Database Foundation

#### Database Tables
- [ ] Create `product_families` table
  - [ ] Write migration
  - [ ] Add indexes
  - [ ] Add RLS policies
  - [ ] Write tests

- [ ] Create `master_products` table
  - [ ] Write migration
  - [ ] Add indexes (family, producer, vintage)
  - [ ] Add constraints (positive values, valid vintages)
  - [ ] Add RLS policies
  - [ ] Write tests

- [ ] Create `product_gtin_registry` table
  - [ ] Write migration
  - [ ] Add unique constraint on GTIN
  - [ ] Add indexes (product, GTIN, verified)
  - [ ] Add RLS policies
  - [ ] Write tests

- [ ] Create `supplier_product_mappings` table
  - [ ] Write migration
  - [ ] Add indexes (supplier, master product, status, SKU)
  - [ ] Add RLS policies
  - [ ] Write tests

- [ ] Create `matching_decisions` table (audit trail)
  - [ ] Write migration
  - [ ] Add indexes (mapping, master product, timestamp)
  - [ ] Write tests

- [ ] Create `gs1_verification_cache` table
  - [ ] Write migration
  - [ ] Add unique constraint on identifier
  - [ ] Add indexes (identifier, expiry, status)
  - [ ] Add TTL cleanup function
  - [ ] Write tests

- [ ] Create `data_change_log` table
  - [ ] Write migration
  - [ ] Add indexes (table, record, timestamp, user)
  - [ ] Add retention policy function
  - [ ] Write tests

#### Existing Table Updates
- [ ] Add `master_product_id` to `supplier_wines`
  - [ ] Write migration
  - [ ] Add index
  - [ ] Backfill strategy document

- [ ] Add `master_product_id` to `offers`
  - [ ] Write migration
  - [ ] Add index

- [ ] Add `master_product_id` to `commercial_intents`
  - [ ] Write migration
  - [ ] Add index

---

### Week 2-3: GS1 Integration

#### API Client Setup
- [ ] Register for GS1 Sweden API access
  - [ ] Create account on GS1 Sweden portal
  - [ ] Obtain API credentials (Validoo / Verified by GS1)
  - [ ] Document API endpoints and rate limits
  - [ ] Test with sample GTINs

#### Verification Service
- [ ] Create `lib/gs1/client.ts`
  - [ ] Implement `verifyGTIN(gtin: string): Promise<VerificationResult>`
  - [ ] Add API authentication
  - [ ] Add request/response logging
  - [ ] Write unit tests

- [ ] Implement cache layer
  - [ ] Create `lib/gs1/cache.ts`
  - [ ] Implement cache lookup (check before API call)
  - [ ] Implement cache write (store API results)
  - [ ] Add TTL management (30 days for verified, 7 days for not found)
  - [ ] Write tests

- [ ] Add resilience patterns
  - [ ] Implement rate limiter (e.g., 100 calls/hour)
  - [ ] Implement circuit breaker (fail gracefully on errors)
  - [ ] Add retry logic with exponential backoff
  - [ ] Write tests

- [ ] Background jobs
  - [ ] Create cache cleanup job (remove expired entries)
  - [ ] Create cache refresh job (re-verify expiring GTINs)
  - [ ] Schedule jobs (daily cleanup, weekly refresh)

---

### Week 3-4: Matching Engine

#### Core Matching Service
- [ ] Create `lib/matching/engine.ts`
  - [ ] Define `MatchRule` interface
  - [ ] Implement GTIN exact match rule (confidence: 1.00)
  - [ ] Implement SKU mapping rule (confidence: 0.90)
  - [ ] Implement fuzzy attribute match rule (confidence: 0.50-0.80)
  - [ ] Write tests for each rule

- [ ] Implement guardrails
  - [ ] Volume validation (block if different)
  - [ ] Pack size validation (block if different)
  - [ ] Vintage handling (match to family if missing)
  - [ ] Write tests

- [ ] Confidence scoring
  - [ ] Define confidence thresholds
    - `>= 0.85`: Auto-match
    - `< 0.85`: Human review queue
  - [ ] Calculate composite scores
  - [ ] Generate match reason codes
  - [ ] Write tests

#### Matching Decision Logging
- [ ] Create `lib/matching/logger.ts`
  - [ ] Log all matching decisions to `matching_decisions` table
  - [ ] Include input context (supplier data snapshot)
  - [ ] Include output context (master product, confidence, method)
  - [ ] Write tests

---

### Week 4-5: API Endpoints

#### Master Product APIs
- [ ] `POST /api/admin/master-products`
  - [ ] Create master product
  - [ ] Validate required fields
  - [ ] Log to `data_change_log`
  - [ ] Write integration tests

- [ ] `GET /api/admin/master-products`
  - [ ] List with pagination
  - [ ] Filter by producer, wine name, vintage
  - [ ] Include GTIN data (if available)
  - [ ] Write integration tests

- [ ] `GET /api/admin/master-products/:id`
  - [ ] Get product details
  - [ ] Include GTINs, mappings, change history
  - [ ] Write integration tests

- [ ] `PATCH /api/admin/master-products/:id`
  - [ ] Update product attributes
  - [ ] Log changes to `data_change_log`
  - [ ] Write integration tests

- [ ] `POST /api/admin/master-products/:id/verify-gtin`
  - [ ] Trigger GS1 verification
  - [ ] Update `product_gtin_registry`
  - [ ] Return verification result
  - [ ] Write integration tests

#### Supplier Catalog Import (Update Existing)
- [ ] Update `POST /api/suppliers/:id/catalog/import`
  - [ ] Extract GTINs from CSV
  - [ ] Call matching engine for each product
  - [ ] Create `supplier_product_mappings`
  - [ ] Log matching decisions
  - [ ] Return summary (matched, pending review, failed)
  - [ ] Write integration tests

#### Product Mapping Review APIs
- [ ] `GET /api/admin/product-mappings`
  - [ ] List mappings with filters (status, confidence)
  - [ ] Include supplier product details
  - [ ] Include master product details (if matched)
  - [ ] Pagination
  - [ ] Write integration tests

- [ ] `PATCH /api/admin/product-mappings/:id`
  - [ ] Approve/reject mapping
  - [ ] Create new master product if needed
  - [ ] Update `mapping_status`
  - [ ] Log decision
  - [ ] Write integration tests

---

### Week 5-6: Admin UI & Testing

#### Admin UI (Basic)
- [ ] Product mapping review page
  - [ ] List pending mappings
  - [ ] Show confidence scores
  - [ ] Show match reason codes
  - [ ] Actions: Approve / Reject / Create New Master
  - [ ] Bulk actions (approve multiple)

- [ ] Master product search page
  - [ ] Search by producer, wine name, vintage, GTIN
  - [ ] Display results with confidence indicators
  - [ ] Link to product details

- [ ] Product details page
  - [ ] Show all attributes
  - [ ] Show linked GTINs
  - [ ] Show supplier mappings
  - [ ] Show change history
  - [ ] Edit button (PATCH API)

#### Integration Testing
- [ ] Test: Supplier imports catalog with GTINs
  - [ ] Verify GTINs are verified via GS1
  - [ ] Verify auto-matches created (confidence 1.00)
  - [ ] Verify pending mappings queued (confidence < 0.85)
  - [ ] Verify matching decisions logged

- [ ] Test: Admin reviews pending mappings
  - [ ] Approve mapping
  - [ ] Reject mapping
  - [ ] Create new master product

- [ ] Test: Change logging
  - [ ] Verify all master product changes logged
  - [ ] Verify before/after snapshots captured

- [ ] Attack tests
  - [ ] Cannot create duplicate GTINs
  - [ ] Cannot update master products without audit log
  - [ ] RLS policies prevent unauthorized access

---

### Week 6: Migration & Backfill

#### Data Migration
- [ ] Audit existing `supplier_wines` data
  - [ ] Count total products
  - [ ] Identify products with GTINs (if any)
  - [ ] Identify duplicate products (same producer + wine + vintage)

- [ ] Create initial master products
  - [ ] Script to de-duplicate existing products
  - [ ] Group by producer + wine + vintage + volume
  - [ ] Create `master_products` for each unique product
  - [ ] Generate `wf_product_id` for each

- [ ] Create initial mappings
  - [ ] Link `supplier_wines` to `master_products`
  - [ ] Set `match_confidence = 0.70` (fuzzy, needs review)
  - [ ] Set `mapping_status = 'pending'`
  - [ ] Queue for admin review

- [ ] Verify migration
  - [ ] All `supplier_wines` have mappings
  - [ ] No orphaned master products
  - [ ] Matching decisions logged

---

## Phase 2: GLN Verification + Party/Location (3-4 weeks)

### Week 7-8: Party & Location Master Data

#### Database Tables
- [ ] Create `master_parties` table
  - [ ] Write migration
  - [ ] Add indexes
  - [ ] Add RLS policies
  - [ ] Write tests

- [ ] Create `party_gln_registry` table
  - [ ] Write migration
  - [ ] Add unique constraint on GLN
  - [ ] Add indexes
  - [ ] Write tests

- [ ] Create `master_locations` table
  - [ ] Write migration
  - [ ] Add indexes
  - [ ] Add RLS policies
  - [ ] Write tests

- [ ] Create `location_gln_registry` table
  - [ ] Write migration
  - [ ] Add unique constraint on GLN
  - [ ] Add indexes
  - [ ] Write tests

#### Existing Table Updates
- [ ] Add `master_party_id` to `suppliers`
  - [ ] Write migration
  - [ ] Add index

- [ ] Add `master_party_id` to `restaurants`
  - [ ] Write migration
  - [ ] Add index

---

### Week 8-9: GLN Integration

#### GLN Verification Service
- [ ] Update `lib/gs1/client.ts`
  - [ ] Implement `verifyGLN(gln: string): Promise<VerificationResult>`
  - [ ] Add to cache layer
  - [ ] Write tests

#### APIs
- [ ] `POST /api/admin/master-parties`
  - [ ] Create party
  - [ ] Write tests

- [ ] `POST /api/admin/master-parties/:id/verify-gln`
  - [ ] Verify party GLN via GS1
  - [ ] Write tests

- [ ] `POST /api/admin/master-locations`
  - [ ] Create location
  - [ ] Write tests

- [ ] `POST /api/admin/master-locations/:id/verify-gln`
  - [ ] Verify location GLN via GS1
  - [ ] Write tests

- [ ] `GET /api/restaurants/:id/delivery-sites`
  - [ ] List delivery sites with GLNs
  - [ ] Write tests

---

### Week 9-10: Migration & Integration

#### Party/Location Migration
- [ ] Backfill `master_parties` from existing suppliers
- [ ] Backfill `master_parties` from existing restaurants
- [ ] Link existing records to master parties

#### Integration Updates
- [ ] Update supplier onboarding to prompt for GLN
- [ ] Update restaurant onboarding to prompt for delivery site GLNs
- [ ] Update order flow to use GLN for delivery address (optional)

---

## Phase 3: Advanced Compliance & Audit (2-3 weeks)

### Week 11-12: Enhanced Governance

#### Automatic Change Logging
- [ ] Create database triggers for all master data tables
  - [ ] Trigger on `master_products`
  - [ ] Trigger on `product_gtin_registry`
  - [ ] Trigger on `master_parties`
  - [ ] Trigger on `master_locations`
  - [ ] Write tests

#### Retention Policies
- [ ] Implement retention policy functions
  - [ ] Change log: 7 years
  - [ ] Verification cache: 90 days
  - [ ] Matching decisions: Permanent
  - [ ] Schedule cleanup jobs

---

### Week 12-13: Compliance Reporting

#### Audit APIs
- [ ] `GET /api/admin/audit/product-changes`
  - [ ] Product change history
  - [ ] Filter by date range, user, product
  - [ ] Export to CSV

- [ ] `GET /api/admin/audit/gtin-verifications`
  - [ ] GTIN verification log
  - [ ] Filter by verification status
  - [ ] Export to CSV

- [ ] `GET /api/admin/audit/matching-decisions`
  - [ ] Matching decision log
  - [ ] Filter by decision type, confidence
  - [ ] Export to CSV

---

### Week 13: Data Quality Dashboard

#### Metrics Dashboard
- [ ] Implement metrics calculation
  - [ ] % products with verified GTIN
  - [ ] % products mapped to master
  - [ ] % parties with verified GLN
  - [ ] Pending review queue size

- [ ] Create dashboard UI
  - [ ] Display key metrics
  - [ ] Charts/graphs
  - [ ] Alerts (high queue backlog, low verification rate)

---

## Success Criteria

### Phase 1 Success Metrics
- [ ] **90%+ auto-match rate** for supplier imports with GTINs
- [ ] **< 100 pending mappings** in review queue at any time
- [ ] **< 500ms response time** for product matching (with cache)
- [ ] **Zero duplicate master products** created
- [ ] **100% audit trail coverage** (all changes logged)

### Phase 2 Success Metrics
- [ ] **80%+ suppliers** have verified GLNs
- [ ] **70%+ restaurant delivery sites** have verified GLNs
- [ ] **Zero address mismatches** for GLN-verified orders

### Phase 3 Success Metrics
- [ ] **Audit-ready** data governance (7-year retention)
- [ ] **< 5% data quality issues** (missing GTINs, unverified parties)
- [ ] **Automated reporting** for compliance

---

## Risk Mitigation

### Technical Risks
- [ ] **GS1 API downtime** → Cache + circuit breaker (Phase 1)
- [ ] **Rate limit exceeded** → Rate limiter + batch processing (Phase 1)
- [ ] **Poor data quality** → Human review queue + guardrails (Phase 1)
- [ ] **Migration failures** → Rollback plan + data backups (Phase 1)

### Business Risks
- [ ] **Low GTIN adoption** → Educate suppliers, provide incentives
- [ ] **High manual review workload** → Improve matching algorithms, ML later
- [ ] **Resistance to change** → Clear communication, training, support

---

## Next Steps

1. **Architecture Review Meeting**
   - [ ] Present architecture document
   - [ ] Validate phased approach
   - [ ] Confirm resource allocation

2. **GS1 Sweden Account Setup**
   - [ ] Register for API access
   - [ ] Test sample GTINs
   - [ ] Document API limits

3. **Kickoff Phase 1**
   - [ ] Assign tasks to team
   - [ ] Set up project tracking (Jira/Linear)
   - [ ] Begin Week 1 database migrations

---

**Document Version:** 1.0
**Status:** 📋 Planning
**Owner:** Technical Architecture Team
**Next Review:** After Phase 1 completion
