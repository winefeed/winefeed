# Winefeed Supplier Data Contract (CSV Import Schema)

**Version:** 1.0
**Effective Date:** 2026-01-14
**Purpose:** Standardized format for supplier price list imports

---

## CSV Schema

### Required Columns

| Column Name          | Type    | Description                                      | Example                    |
|---------------------|---------|--------------------------------------------------|----------------------------|
| `supplier_sku`      | TEXT    | Supplier's internal SKU (unique per supplier)    | `MARG-2015-750`           |
| `producer_name`     | TEXT    | Wine producer/château name                       | `Château Margaux`         |
| `product_name`      | TEXT    | Wine product name                                | `Château Margaux 2015`    |
| `vintage`           | INTEGER | Wine vintage year (null = NV)                    | `2015` or empty           |
| `volume_ml`         | INTEGER | Bottle volume in milliliters                     | `750`                     |
| `abv_percent`       | DECIMAL | Alcohol by volume percentage                     | `13.5`                    |
| `pack_type`         | ENUM    | Packaging type: `bottle`, `case`, `magnum`       | `bottle`                  |
| `units_per_case`    | INTEGER | Units per case (1 for bottles)                   | `6` or `12`               |
| `currency`          | TEXT    | Price currency (ISO 4217 code)                   | `SEK`                     |
| `price_net`         | DECIMAL | Net price (excluding VAT), per unit              | `390.00`                  |
| `min_order_qty`     | INTEGER | Minimum order quantity (units)                   | `6`                       |
| `lead_time_days`    | INTEGER | Lead time in days                                | `7`                       |

### Optional Columns (Recommended)

| Column Name          | Type    | Description                                      | Example                    |
|---------------------|---------|--------------------------------------------------|----------------------------|
| `gtin_each`         | TEXT    | GTIN-13/14 for individual bottle (8-14 digits)   | `3012345678901`           |
| `gtin_case`         | TEXT    | GTIN-13/14 for case packaging                    | `03012345678908`          |
| `country_of_origin` | TEXT    | Country of wine origin (ISO 3166 alpha-2)        | `FR` or `France`          |
| `region`            | TEXT    | Wine region                                      | `Bordeaux`                |
| `grape_variety`     | TEXT    | Primary grape variety                            | `Cabernet Sauvignon`      |
| `classification`    | TEXT    | Wine classification                              | `Grand Cru Classé`        |
| `stock_qty`         | INTEGER | Current stock quantity (null = unlimited)        | `50`                      |
| `delivery_areas`    | TEXT    | Delivery areas (comma-separated)                 | `Stockholm,Göteborg`      |

### Optional Columns (Nice to Have)

| Column Name          | Type    | Description                                      | Example                    |
|---------------------|---------|--------------------------------------------------|----------------------------|
| `ean_code`          | TEXT    | Legacy EAN code (alias for GTIN)                 | `3012345678901`           |
| `winery_url`        | TEXT    | Winery website                                   | `https://margaux.com`     |
| `tasting_notes`     | TEXT    | Product description                              | `Full-bodied, elegant...` |
| `awards`            | TEXT    | Wine awards/ratings                              | `95pts Wine Spectator`    |
| `sustainable`       | BOOLEAN | Organic/sustainable certification                | `true` or `false`         |

---

## Validation Rules

### Required Field Validation

```typescript
// supplier_sku: required, max 100 chars
if (!row.supplier_sku || row.supplier_sku.trim().length === 0) {
  throw new Error('supplier_sku is required');
}
if (row.supplier_sku.length > 100) {
  throw new Error('supplier_sku max length is 100 characters');
}

// producer_name: required, max 200 chars
if (!row.producer_name || row.producer_name.trim().length === 0) {
  throw new Error('producer_name is required');
}

// product_name: required, max 200 chars
if (!row.product_name || row.product_name.trim().length === 0) {
  throw new Error('product_name is required');
}

// vintage: optional integer 1900-2099
if (row.vintage) {
  const vintage = parseInt(row.vintage);
  if (isNaN(vintage) || vintage < 1900 || vintage > 2099) {
    throw new Error('vintage must be between 1900 and 2099');
  }
}

// volume_ml: required, positive integer
const volume = parseInt(row.volume_ml);
if (isNaN(volume) || volume <= 0) {
  throw new Error('volume_ml must be a positive integer');
}
if (![187, 375, 500, 750, 1000, 1500, 3000, 6000].includes(volume)) {
  console.warn(`⚠️  Unusual volume: ${volume}ml (expected: 750, 1500, etc.)`);
}

// abv_percent: required, 0-25%
const abv = parseFloat(row.abv_percent);
if (isNaN(abv) || abv < 0 || abv > 25) {
  throw new Error('abv_percent must be between 0 and 25');
}

// pack_type: required enum
const validPackTypes = ['bottle', 'case', 'magnum', 'other'];
if (!validPackTypes.includes(row.pack_type)) {
  throw new Error(`pack_type must be one of: ${validPackTypes.join(', ')}`);
}

// units_per_case: required, positive integer
const units = parseInt(row.units_per_case);
if (isNaN(units) || units <= 0) {
  throw new Error('units_per_case must be a positive integer');
}
if (row.pack_type === 'case' && units === 1) {
  console.warn('⚠️  pack_type=case but units_per_case=1 (should be 6, 12, etc.)');
}

// currency: required, 3-letter ISO code
if (!/^[A-Z]{3}$/.test(row.currency)) {
  throw new Error('currency must be 3-letter ISO code (e.g., SEK, EUR, USD)');
}
if (row.currency !== 'SEK') {
  console.warn(`⚠️  Currency ${row.currency} will be converted to SEK`);
}

// price_net: required, positive decimal
const price = parseFloat(row.price_net);
if (isNaN(price) || price <= 0) {
  throw new Error('price_net must be a positive number');
}

// min_order_qty: required, positive integer
const minOrder = parseInt(row.min_order_qty);
if (isNaN(minOrder) || minOrder <= 0) {
  throw new Error('min_order_qty must be a positive integer');
}

// lead_time_days: required, non-negative integer
const leadTime = parseInt(row.lead_time_days);
if (isNaN(leadTime) || leadTime < 0) {
  throw new Error('lead_time_days must be a non-negative integer');
}
```

### Optional Field Validation

```typescript
// gtin_each: optional, 8-14 digits
if (row.gtin_each) {
  const gtin = row.gtin_each.replace(/[^0-9]/g, '');
  if (![8, 12, 13, 14].includes(gtin.length)) {
    throw new Error('gtin_each must be 8, 12, 13, or 14 digits');
  }
  // TODO: validate GTIN check digit
}

// gtin_case: optional, 8-14 digits
if (row.gtin_case) {
  const gtin = row.gtin_case.replace(/[^0-9]/g, '');
  if (![8, 12, 13, 14].includes(gtin.length)) {
    throw new Error('gtin_case must be 8, 12, 13, or 14 digits');
  }
}

// country_of_origin: optional, 2-letter ISO code or full name
if (row.country_of_origin) {
  if (row.country_of_origin.length === 2 && !/^[A-Z]{2}$/.test(row.country_of_origin)) {
    throw new Error('country_of_origin must be 2-letter ISO code (e.g., FR, IT, ES)');
  }
  // Accept full country names as well (will be normalized)
}

// stock_qty: optional, non-negative integer
if (row.stock_qty) {
  const stock = parseInt(row.stock_qty);
  if (isNaN(stock) || stock < 0) {
    throw new Error('stock_qty must be a non-negative integer');
  }
}
```

---

## Example CSV File

```csv
supplier_sku,gtin_each,gtin_case,producer_name,product_name,vintage,grape_variety,country_of_origin,region,volume_ml,abv_percent,pack_type,units_per_case,currency,price_net,min_order_qty,lead_time_days,stock_qty,delivery_areas
MARG-2015-750,3012345678901,03012345678908,Château Margaux,Château Margaux 2015,2015,Cabernet Sauvignon,FR,Bordeaux,750,13.5,bottle,1,SEK,390.00,6,7,50,"Stockholm,Göteborg"
PETR-2016-750,3012345678918,,Château Pétrus,Pomerol Grand Cru 2016,2016,Merlot,FR,Bordeaux,750,14.0,bottle,1,SEK,520.00,6,7,30,Stockholm
CHIA-2017-750,,,"Antinori",Chianti Classico 2017,2017,Sangiovese,IT,Tuscany,750,13.0,bottle,1,SEK,250.00,6,5,100,"Stockholm,Göteborg,Malmö"
CHAM-NV-750,3012345678925,,"Moët & Chandon",Moët Impérial Brut NV,,Chardonnay,FR,Champagne,750,12.0,bottle,1,SEK,450.00,6,3,80,Stockholm
MARG-2015-CASE,3012345678901,03012345678908,Château Margaux,Château Margaux 2015 (Case),2015,Cabernet Sauvignon,FR,Bordeaux,750,13.5,case,6,SEK,2280.00,1,7,10,"Stockholm,Göteborg"
```

---

## Import Processing Flow

```
1. Upload CSV file
   ↓
2. Parse CSV (validate format)
   ↓
3. Validate each row (data types, required fields)
   ↓
4. For each valid row:
   a. Run product matcher
   b. If auto-match (confidence ≥ 0.85):
      - Create supplier_product_mapping
      - Update supplier_wines
   c. If needs review (0.50 ≤ confidence < 0.85):
      - Add to product_match_review_queue
   d. If no match (confidence < 0.50):
      - Create new master_product + mapping
   ↓
5. Return import summary:
   - Total rows: 100
   - Auto-matched: 82 (82%)
   - Needs review: 15 (15%)
   - New products created: 3 (3%)
   - Errors: 0 (0%)
```

---

## API Endpoint

```typescript
POST /api/suppliers/:supplierId/catalog/import

Content-Type: multipart/form-data
Body:
  - file: CSV file (max 10MB, max 10,000 rows)
  - replaceExisting: boolean (default: false)

Response:
{
  "success": true,
  "summary": {
    "totalRows": 100,
    "autoMatched": 82,
    "needsReview": 15,
    "newProductsCreated": 3,
    "errors": 0
  },
  "details": {
    "autoMatched": [
      { "supplierSku": "MARG-2015-750", "wfProductId": "WF-PROD-00042", "confidence": 1.00 }
    ],
    "needsReview": [
      { "supplierSku": "CHIA-2017-750", "queueItemId": "uuid", "topConfidence": 0.68 }
    ],
    "newProducts": [
      { "supplierSku": "PETR-2016-750", "wfProductId": "WF-PROD-00123" }
    ],
    "errors": []
  }
}
```

---

## Common Errors & Solutions

### Error 1: Missing GTIN
**Error:** `gtin_each is recommended but not provided`
**Solution:** GTINs are optional but highly recommended for auto-matching. Without GTIN, matching relies on fuzzy text matching (slower, less accurate).

### Error 2: Invalid Volume
**Error:** `volume_ml=755 is unusual (expected: 750, 1500, etc.)`
**Solution:** Wine volumes should be standard (750ml, 1500ml, etc.). Verify data.

### Error 3: Pack Type Mismatch
**Error:** `pack_type=case but units_per_case=1`
**Solution:** If pack_type is "case", units_per_case should be 6, 12, etc. (not 1).

### Error 4: Currency Conversion
**Warning:** `Currency EUR will be converted to SEK`
**Solution:** Winefeed stores all prices in SEK. Non-SEK prices will be converted using daily exchange rates.

---

## Migration from Legacy Formats

### If supplier uses Excel (.xlsx)
1. Open in Excel/Google Sheets
2. Export as CSV (UTF-8 encoding)
3. Verify column headers match schema

### If supplier uses PDF price lists
1. Manual data entry required (Phase 1)
2. Future: OCR + AI extraction (Phase 2)

### If supplier uses custom format
1. Create mapping template
2. Use ETL tool (e.g., `pandas` in Python)
3. Export as Winefeed CSV format

---

**Status:** Ready for Implementation
**Version:** 1.0
**Last Updated:** 2026-01-14
