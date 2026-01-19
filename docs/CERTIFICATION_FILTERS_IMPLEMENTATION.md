# Certification Filters Implementation

## Overview
This document describes the implementation of wine certification filters (ekologiskt, biodynamiskt, veganskt) in the request form.

## Changes Made

### 1. Database Migration ✅
**File:** `supabase/migrations/20260118_add_wine_certifications.sql`

Adds two new columns to the `wines` table:
- `biodynamiskt BOOLEAN DEFAULT FALSE`
- `veganskt BOOLEAN DEFAULT FALSE`

Note: `ekologisk` already existed in the schema.

**To Apply Migration:**
```bash
# Option 1: Via Supabase CLI
npx supabase db push

# Option 2: Via Supabase Dashboard
# Go to SQL Editor and run the migration file manually
```

**Verification Query:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'wines'
AND column_name IN ('ekologisk', 'biodynamiskt', 'veganskt');
```

### 2. UI Components ✅

**Badge Component Created:**
`components/ui/badge.tsx` - Reusable badge component for displaying filter chips

**Request Form Updated:**
`components/request-form.tsx`

Key changes:
- Added `FILTER_OPTIONS` configuration for extensibility
- Added `selectedFilters` state for tracking selected certifications
- Wired checkboxes to state with `toggleFilter()`
- Added chip display showing selected filters with remove buttons
- Included `specialkrav` array in form submission

**Filter Structure (Extensible):**
```typescript
const FILTER_OPTIONS: FilterOption[] = [
  { id: 'ekologiskt', label: 'Ekologiskt', type: 'certification' },
  { id: 'biodynamiskt', label: 'Biodynamiskt', type: 'certification' },
  { id: 'veganskt', label: 'Veganskt', type: 'certification' },
  // Future filters can be added here:
  // { id: 'italien', label: 'Italien', type: 'region' },
];
```

### 3. API Filtering ✅

**File:** `app/api/suggest/route.ts`

Updated wine query to pre-filter by certifications:
```typescript
if (specialkrav && Array.isArray(specialkrav) && specialkrav.length > 0) {
  if (specialkrav.includes('ekologiskt')) {
    query = query.eq('ekologisk', true);
  }
  if (specialkrav.includes('biodynamiskt')) {
    query = query.eq('biodynamiskt', true);
  }
  if (specialkrav.includes('veganskt')) {
    query = query.eq('veganskt', true);
  }
}
```

**Filter Logic:**
1. User selects certifications in form
2. Form sends `specialkrav: ["ekologiskt", "biodynamiskt"]` to API
3. API applies SQL filters: `WHERE ekologisk = TRUE AND biodynamiskt = TRUE`
4. AI ranks only the pre-filtered wines
5. Results returned with certification badges

### 4. Response Format ✅

Wine objects in API response now include:
```typescript
{
  wine: {
    id: string;
    namn: string;
    producent: string;
    land: string;
    region: string;
    pris_sek: number;
    ekologisk: boolean;
    biodynamiskt: boolean;  // NEW
    veganskt: boolean;      // NEW
  }
}
```

## Testing

### 1. Apply Migration
```bash
# Run the migration file in Supabase SQL Editor
# File: supabase/migrations/20260118_add_wine_certifications.sql
```

### 2. Update Test Data (Optional)
```sql
-- Mark some wines as certified for testing
UPDATE wines
SET
  ekologisk = TRUE,
  biodynamiskt = TRUE,
  veganskt = TRUE
WHERE id IN (
  SELECT id FROM wines LIMIT 5
);

-- Mark some wines as only organic
UPDATE wines
SET ekologisk = TRUE
WHERE id IN (
  SELECT id FROM wines WHERE NOT ekologisk LIMIT 5
);
```

### 3. Test Form
1. Navigate to `/dashboard/new-request`
2. Fill in basic fields (fritext, budget, antal)
3. Check one or more certification filters:
   - ☑️ Ekologiskt
   - ☑️ Biodynamiskt
   - ☑️ Veganskt
4. Verify chips appear showing selected filters
5. Click X on a chip to remove filter
6. Submit form

### 4. Verify API Behavior

**With No Filters:**
```bash
curl -X POST http://localhost:3000/api/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "fritext": "Italienska rödviner",
    "budget_per_flaska": 200,
    "antal_flaskor": 20
  }'
```
Expected: Returns all wines within budget

**With Ekologiskt Filter:**
```bash
curl -X POST http://localhost:3000/api/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "fritext": "Italienska rödviner",
    "budget_per_flaska": 200,
    "antal_flaskor": 20,
    "specialkrav": ["ekologiskt"]
  }'
```
Expected: Only returns wines where `ekologisk = TRUE`

**With Multiple Filters (AND logic):**
```bash
curl -X POST http://localhost:3000/api/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "fritext": "Italienska rödviner",
    "budget_per_flaska": 200,
    "antal_flaskor": 20,
    "specialkrav": ["ekologiskt", "veganskt"]
  }'
```
Expected: Only returns wines where `ekologisk = TRUE AND veganskt = TRUE`

### 5. Check Console Logs
When filtering is active, you should see:
```
Filtering wines by certifications: [ 'ekologiskt', 'biodynamiskt' ]
```

## Future Enhancements

### Easy to Add More Filters
The structure is designed to be extensible. To add new filter types:

**Example: Add Region Filters**
```typescript
// 1. Add to FILTER_OPTIONS
{
  id: 'italien',
  label: 'Italien',
  type: 'region',
  description: 'Viner från Italien'
}

// 2. Update API filter logic
if (specialkrav.includes('italien')) {
  query = query.eq('land', 'Italien');
}
```

**Example: Add Grape Filters**
```typescript
// 1. Add to FILTER_OPTIONS
{
  id: 'pinot-noir',
  label: 'Pinot Noir',
  type: 'grape'
}

// 2. Update API filter logic
if (specialkrav.includes('pinot-noir')) {
  query = query.ilike('druva', '%Pinot Noir%');
}
```

**Example: Add Price Range Filters**
```typescript
{
  id: 'budget-friendly',
  label: 'Budgetvänligt (< 150 kr)',
  type: 'price'
}
```

### OR Logic Instead of AND
Current implementation uses AND logic (all selected filters must match).

To implement OR logic:
```typescript
// Build array of conditions
const conditions = [];
if (specialkrav.includes('ekologiskt')) conditions.push('ekologisk.eq.true');
if (specialkrav.includes('biodynamiskt')) conditions.push('biodynamiskt.eq.true');

// Apply with OR
query = query.or(conditions.join(','));
```

### Save Filters to Database
The `requests` table already has `specialkrav TEXT[]` column. To save:

```typescript
// In /api/suggest after authentication is enabled
const { data: savedRequest } = await supabase
  .from('requests')
  .insert({
    restaurant_id: user.restaurant_id,
    fritext,
    budget_per_flaska,
    antal_flaskor,
    leverans_senast,
    specialkrav: specialkrav || [] // Save selected filters
  })
  .select()
  .single();
```

## Architecture Benefits

1. **Separation of Concerns:**
   - Form manages UI state
   - API handles filtering logic
   - Database enforces data integrity

2. **Performance:**
   - Pre-filtering reduces wine dataset before AI ranking
   - SQL filters are fast and indexed
   - AI only processes relevant wines

3. **Extensibility:**
   - `FILTER_OPTIONS` config makes adding filters easy
   - Filter types (certification, region, grape) allow grouping
   - Generic structure works for any filter type

4. **User Experience:**
   - Visual chips show active filters
   - Easy to remove filters
   - Real-time state updates
   - Touch-friendly checkboxes

## Troubleshooting

### Migration Fails
```sql
-- Check if columns already exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'wines'
AND column_name IN ('biodynamiskt', 'veganskt');

-- If they exist, migration is already applied
```

### No Wines Returned After Filtering
```sql
-- Check if any wines have certifications
SELECT
  COUNT(*) FILTER (WHERE ekologisk = TRUE) as ekologisk_count,
  COUNT(*) FILTER (WHERE biodynamiskt = TRUE) as biodynamiskt_count,
  COUNT(*) FILTER (WHERE veganskt = TRUE) as veganskt_count
FROM wines;

-- If all are 0, you need to add test data
```

### TypeScript Errors
```bash
# Check for type errors
npm run build
```

Common issues:
- Missing Badge import
- Missing X icon from lucide-react
- Type mismatch in filter handling

## Summary

Full certification filtering is now implemented with:
- ✅ Database schema (3 boolean columns)
- ✅ UI with checkboxes and chips
- ✅ API filtering by certifications
- ✅ Extensible architecture for future filters
- ✅ Type-safe implementation
- ⏳ Database persistence (TODOs already in place)

The implementation follows MVP principles:
- Minimal viable feature set
- Clean, maintainable code
- Easy to extend
- Well-documented
