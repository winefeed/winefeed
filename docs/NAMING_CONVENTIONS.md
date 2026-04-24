# Naming Conventions

Winefeed uses **two** conventions depending on layer. Pick by layer, not by taste.

| Layer | Convention | Example |
|---|---|---|
| Database (Supabase/Postgres) | `snake_case` | `supplier_name`, `price_ex_vat_sek`, `min_order_quantity` |
| CSV / JSON feeds with external partners | `snake_case` | same as DB → 1:1 import, no mapping |
| Frontend + API responses (TypeScript) | `camelCase` | `supplierName`, `priceExVatSek`, `minOrderQuantity` |

## Why the split

- **Postgres is case-insensitive by default.** A column named `supplierName` must be quoted (`"supplierName"`) in every query forever — otherwise Postgres folds it to `suppliername`. Not worth the pain.
- **JavaScript/TypeScript convention is camelCase.** Linters and every library we use expect it.
- API routes convert `snake_case` → `camelCase` on read, and back on write.

## For supplier / producer data feeds

Always `snake_case`. Maps 1:1 to the database column — zero translation on our end, fewer import bugs.

### Standard wine catalogue CSV header

```
sku,name,producer,vintage,country,region,appellation,grape,color,
price_ex_vat_sek,moq,case_size,organic,biodynamic,description
```

### Rules

- Columns we don't recognise are ignored, not rejected.
- Booleans accept `true/false`, `1/0`, `ja/nej`, `yes/no`.
- Prices are in SEK ex VAT unless the column name says otherwise.
- `moq` = minimum order quantity in bottles. `case_size` = bottles per case.

## Inside the codebase

- Never mix conventions inside a single file or object.
- Object coming from Supabase → snake_case. The moment you return it from an API route, rename to camelCase.
- Don't introduce Supabase views just to rename columns — do the mapping in the route handler.
