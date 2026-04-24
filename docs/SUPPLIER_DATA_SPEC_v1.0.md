# Winefeed Supplier Data Spec v1.0

Schema and format requirements for wine catalogue data exchanged with Winefeed.

**Audience:** suppliers, producers, and integration partners sending wine catalogues to Winefeed.
**Version:** 1.0 (2026-04-24) — first stable version.
**Formats supported:** CSV (preferred), XLSX, JSON.

---

## 1. Overview

Send us one row per wine. We do not merge or deduplicate across files — each row creates or updates exactly one wine in our catalogue, keyed by `sku` within your supplier account.

A small catalogue (<50 wines) can be sent as a single file. Larger catalogues should be split into one file per colour (red, white, rosé…) or shipped as JSON.

---

## 2. Conventions

| Rule | Value |
|---|---|
| Naming convention | `snake_case` only |
| Text encoding | UTF-8 |
| CSV delimiter | `,` (comma) |
| Decimal separator | `.` (dot). Swedish format `"89,50"` is also accepted, but prefer `89.50` |
| Thousand separator | Do not use |
| Date format | ISO 8601, `YYYY-MM-DD` |
| Boolean values | `true` / `false` (also accepted: `1/0`, `yes/no`, `ja/nej`) |
| Empty cells | Leave blank. Do **not** write `null`, `N/A`, `-`, or `0` |
| Currency | SEK ex VAT, unless column name says otherwise |

---

## 3. Field schema

Required fields must be present on every row. Optional fields may be omitted or left blank.

### Required

| Field | Type | Description | Example |
|---|---|---|---|
| `sku` | string | Your unique article number — used as the update key | `GW-001` |
| `wine_name` | string | Display name | `Chablis Premier Cru` |
| `producer` | string | Producer / domaine / château | `Domaine Laroche` |
| `country` | string | ISO English country name | `France` |
| `region` | string | Region | `Bourgogne` |
| `vintage` | integer | Vintage year. `0` for NV | `2022` |
| `grape` | string | Grape(s), comma-separated if blend | `Chardonnay` |
| `color` | enum | See §4 | `white` |
| `price_ex_vat_sek` | decimal | Price per bottle, SEK ex VAT | `189.50` |
| `moq` | integer | Minimum order quantity in bottles | `6` |

### Optional

| Field | Type | Description | Example |
|---|---|---|---|
| `appellation` | string | AOC/AOP/DOC/DOCG/DO. Important for matching | `Chablis 1er Cru` |
| `bottle_size_ml` | integer | Defaults to `750` if omitted | `750` |
| `case_size` | integer | Bottles per case. Defaults to `6` | `6` |
| `alcohol_pct` | decimal | 0–100 | `12.5` |
| `stock_qty` | integer | Current stock in bottles. Leave blank if unlimited / unknown | `240` |
| `organic` | boolean | Certified organic | `true` |
| `biodynamic` | boolean | Certified biodynamic (Demeter etc.) | `false` |
| `description` | string | Tasting notes / producer notes (max ~500 chars) | `Crisp mineral-driven Chablis…` |
| `packaging_type` | enum | See §4. Defaults to `bottle` | `bottle` |
| `location` | enum | See §4. Defaults to `domestic` | `eu` |
| `lead_time_days` | integer | Typical shipping lead time. Defaults to `3` | `5` |

### Derived by Winefeed (do not send)

We compute these ourselves — leave them out:
`body`, `tannin`, `acidity`, `appellation` (if you don't know it, we infer it via AI), internal IDs, `created_at`, `updated_at`.

---

## 4. Enums

### `color`
```
red | white | rose | sparkling | fortified | orange | alcohol_free | spirit
```
Use lowercase ASCII: `rose`, not `rosé`.

### `packaging_type`
```
bottle | keg | bag_in_box | can | tetra | other
```

### `location`
Where the wine physically ships from:
```
domestic    — Swedish warehouse (1–2 day delivery)
eu          — EU warehouse (direct import, 7–14 days)
non_eu      — Outside EU (direct import, longer)
```

---

## 5. Example CSV

```csv
sku,wine_name,producer,country,region,appellation,vintage,grape,color,price_ex_vat_sek,moq,case_size,bottle_size_ml,alcohol_pct,organic,biodynamic,stock_qty,description
GW-001,Chablis Premier Cru Vaillons,Domaine Laroche,France,Bourgogne,Chablis 1er Cru,2022,Chardonnay,white,189.50,6,6,750,12.5,true,false,240,Crisp mineral-driven Chablis with citrus and wet-stone notes.
GW-002,Châteauneuf-du-Pape Rouge,Domaine de la Janasse,France,Rhône,Châteauneuf-du-Pape,2021,"Grenache, Syrah, Mourvèdre",red,395.00,6,6,750,14.5,false,false,120,
GW-003,Prosecco Extra Dry,Bisol,Italy,Veneto,Valdobbiadene DOCG,,Glera,sparkling,98.00,6,6,750,11.0,false,false,,
```

Notes on the example:
- Row 2 has a multi-word grape field — quoted because it contains a comma.
- Row 3 has `vintage` blank (NV wine) and `stock_qty` blank (unknown).
- Row 2 has `description` blank — valid, we skip it.

---

## 6. Example JSON

Same data shape, one object per wine:

```json
[
  {
    "sku": "GW-001",
    "wine_name": "Chablis Premier Cru Vaillons",
    "producer": "Domaine Laroche",
    "country": "France",
    "region": "Bourgogne",
    "appellation": "Chablis 1er Cru",
    "vintage": 2022,
    "grape": "Chardonnay",
    "color": "white",
    "price_ex_vat_sek": 189.50,
    "moq": 6,
    "case_size": 6,
    "bottle_size_ml": 750,
    "alcohol_pct": 12.5,
    "organic": true,
    "biodynamic": false,
    "stock_qty": 240,
    "description": "Crisp mineral-driven Chablis with citrus and wet-stone notes."
  }
]
```

---

## 7. Validation rules

Rows that violate these rules are rejected and reported back; the rest of the file still imports.

| Rule | Constraint |
|---|---|
| `price_ex_vat_sek` | must be `> 0` |
| `moq` | must be `> 0` |
| `case_size` | must be `> 0` |
| `bottle_size_ml` | must be `> 0` |
| `alcohol_pct` | must be `0–100` if present |
| `vintage` | `0` (NV) or `1900–current year + 1` |
| `color` | must match one of the enum values exactly |
| `sku` | must be unique within your catalogue |
| Required fields | must be non-empty on every row |

Unknown columns are ignored, not rejected — safe to include extra columns for your own tracking.

---

## 8. Updates & versioning

- **Updates:** send the same `sku` with new values. Fields you send overwrite existing values; fields you omit are left unchanged.
- **Removal:** we do not delete wines on absence. To remove a wine, contact us or mark it inactive through the supplier portal.
- **Schema version:** pin to `v1.0` for now. Breaking changes will bump to `v2.0` with at least 30 days' notice.

---

## 9. Delivery

| Method | When to use |
|---|---|
| Upload via Winefeed supplier portal | Default. Works for CSV/XLSX up to 10 MB. |
| Email to onboarding contact | First-time setup or special cases. |
| API (planned) | High-frequency updates — available on request. |

---

## 10. Contact

Questions, custom columns, or integration requests:
**hej@winefeed.se**
