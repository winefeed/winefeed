#!/bin/bash

# Winefeed Offer Flow Test Script
# Usage: ./test-offer-flow.sh

set -e  # Exit on error

echo "🍷 Winefeed Offer Flow Test"
echo "════════════════════════════════════════════════"
echo ""

# Configuration
API_URL="http://localhost:3000"
SUPABASE_URL="http://localhost:54321"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key-here}"

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s "$API_URL" > /dev/null 2>&1; then
    echo "❌ Server not running at $API_URL"
    echo "   Start with: npm run dev"
    exit 1
fi
echo "✓ Server is running"
echo ""

# Step 1: Create Supplier A
echo "📦 Step 1: Creating Supplier A..."
SUPPLIER_A_RESPONSE=$(curl -s -X POST "$API_URL/api/suppliers/onboard" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test-supplier-a-'"$(date +%s)"'@test.se",
    "password": "TestSupplier123!",
    "supplierName": "French Wine Importer (Test)",
    "contactEmail": "contact@frenchtest.se",
    "normalDeliveryDays": 7
  }')

SUPPLIER_A_ID=$(echo "$SUPPLIER_A_RESPONSE" | jq -r '.supplier.id')

if [ "$SUPPLIER_A_ID" == "null" ] || [ -z "$SUPPLIER_A_ID" ]; then
    echo "❌ Failed to create Supplier A"
    echo "Response: $SUPPLIER_A_RESPONSE"
    exit 1
fi

echo "✓ Supplier A created: $SUPPLIER_A_ID"
echo ""

# Step 2: Import Catalog A
echo "📚 Step 2: Importing catalog for Supplier A..."
CATALOG_A_RESPONSE=$(curl -s -X POST "$API_URL/api/suppliers/$SUPPLIER_A_ID/catalog/import" \
  -H 'Content-Type: application/json' \
  -d '{
    "csvData": "name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas\n\"Château Margaux 2015\",\"Château Margaux\",\"France\",\"Bordeaux\",2015,\"Cabernet Sauvignon\",390.00,25.00,50,6,7,\"Stockholm;Göteborg\"\n\"Bordeaux Superior 2016\",\"Domaine Testard\",\"France\",\"Bordeaux\",2016,\"Merlot\",290.00,25.00,100,6,5,\"Stockholm\"",
    "replaceExisting": false
  }')

IMPORTED_COUNT=$(echo "$CATALOG_A_RESPONSE" | jq -r '.imported')

if [ "$IMPORTED_COUNT" == "null" ] || [ "$IMPORTED_COUNT" -lt 1 ]; then
    echo "❌ Failed to import catalog"
    echo "Response: $CATALOG_A_RESPONSE"
    exit 1
fi

WINE_A_ID=$(echo "$CATALOG_A_RESPONSE" | jq -r '.wines[0].id')
echo "✓ Imported $IMPORTED_COUNT wines"
echo "  First wine ID: $WINE_A_ID"
echo ""

# Step 3: Create Supplier B
echo "📦 Step 3: Creating Supplier B..."
SUPPLIER_B_RESPONSE=$(curl -s -X POST "$API_URL/api/suppliers/onboard" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test-supplier-b-'"$(date +%s)"'@test.se",
    "password": "TestSupplier123!",
    "supplierName": "Italian Wine Importer (Test)",
    "contactEmail": "contact@italiantest.se",
    "normalDeliveryDays": 5
  }')

SUPPLIER_B_ID=$(echo "$SUPPLIER_B_RESPONSE" | jq -r '.supplier.id')

if [ "$SUPPLIER_B_ID" == "null" ] || [ -z "$SUPPLIER_B_ID" ]; then
    echo "❌ Failed to create Supplier B"
    exit 1
fi

echo "✓ Supplier B created: $SUPPLIER_B_ID"
echo ""

# Step 4: Import Catalog B
echo "📚 Step 4: Importing catalog for Supplier B..."
CATALOG_B_RESPONSE=$(curl -s -X POST "$API_URL/api/suppliers/$SUPPLIER_B_ID/catalog/import" \
  -H 'Content-Type: application/json' \
  -d '{
    "csvData": "name,producer,country,region,vintage,grape,priceExVatSek,vatRate,stockQty,minOrderQty,leadTimeDays,deliveryAreas\n\"Château Margaux 2015\",\"Château Margaux\",\"France\",\"Bordeaux\",2015,\"Cabernet Sauvignon\",420.00,25.00,30,12,5,\"Stockholm\"\n\"Chianti Classico 2017\",\"Antinori\",\"Italy\",\"Tuscany\",2017,\"Sangiovese\",250.00,25.00,60,6,5,\"Stockholm;Göteborg\"",
    "replaceExisting": false
  }')

IMPORTED_B=$(echo "$CATALOG_B_RESPONSE" | jq -r '.imported')
WINE_B_ID=$(echo "$CATALOG_B_RESPONSE" | jq -r '.wines[0].id')

echo "✓ Imported $IMPORTED_B wines"
echo "  First wine ID: $WINE_B_ID"
echo ""

# Step 5: Create Restaurant (Manual - requires Supabase access)
echo "🍽️  Step 5: Restaurant Setup (Manual)"
echo "════════════════════════════════════════════════"
echo ""
echo "⚠️  You need to manually create a restaurant:"
echo ""
echo "Option 1: Via Supabase Studio"
echo "  1. Go to: http://localhost:54323"
echo "  2. Authentication → Users → Add User"
echo "  3. Email: restaurant-test@test.se"
echo "  4. Password: Test123!"
echo "  5. Copy user ID"
echo "  6. Table Editor → restaurants → Insert"
echo "  7. id: [paste user ID]"
echo "     name: Test Restaurant"
echo "     contact_email: restaurant-test@test.se"
echo ""
echo "Option 2: Via SQL (Supabase Studio SQL Editor)"
echo ""
echo "  -- Run this SQL:"
echo "  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)"
echo "  VALUES ("
echo "    'restaurant-test@test.se',"
echo "    crypt('Test123!', gen_salt('bf')),"
echo "    NOW()"
echo "  ) RETURNING id;"
echo ""
echo "  -- Copy the returned ID, then:"
echo "  INSERT INTO restaurants (id, name, contact_email)"
echo "  VALUES ("
echo "    'PASTE_USER_ID_HERE',"
echo "    'Test Restaurant',"
echo "    'restaurant-test@test.se'"
echo "  );"
echo ""
read -p "Press Enter when restaurant is created, then enter Restaurant ID: " RESTAURANT_ID

if [ -z "$RESTAURANT_ID" ]; then
    echo "❌ Restaurant ID required"
    exit 1
fi

echo "✓ Using Restaurant ID: $RESTAURANT_ID"
echo ""

# Step 6: Create Quote Request
echo "📝 Step 6: Creating Quote Request..."
QUOTE_REQUEST_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/requests" \
  -H 'Content-Type: application/json' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H 'Prefer: return=representation' \
  -d '{
    "restaurant_id": "'"$RESTAURANT_ID"'",
    "fritext": "Söker Château Margaux 2015, cirka 12 flaskor, budget 450 SEK/flaska. Test order.",
    "budget_per_flaska": 450,
    "antal_flaskor": 12,
    "leverans_senast": "2026-02-14"
  }')

QUOTE_REQUEST_ID=$(echo "$QUOTE_REQUEST_RESPONSE" | jq -r '.[0].id // .id')

if [ "$QUOTE_REQUEST_ID" == "null" ] || [ -z "$QUOTE_REQUEST_ID" ]; then
    echo "❌ Failed to create quote request"
    echo "Response: $QUOTE_REQUEST_RESPONSE"
    exit 1
fi

echo "✓ Quote Request created: $QUOTE_REQUEST_ID"
echo ""

# Step 7: Dispatch Quote Request
echo "🚀 Step 7: Dispatching Quote Request to suppliers..."
DISPATCH_RESPONSE=$(curl -s -X POST "$API_URL/api/quote-requests/$QUOTE_REQUEST_ID/dispatch" \
  -H 'Content-Type: application/json' \
  -d '{
    "maxMatches": 10,
    "minScore": 0,
    "expiresInHours": 48
  }')

ASSIGNMENTS_CREATED=$(echo "$DISPATCH_RESPONSE" | jq -r '.assignmentsCreated')

if [ "$ASSIGNMENTS_CREATED" == "null" ] || [ "$ASSIGNMENTS_CREATED" -lt 1 ]; then
    echo "❌ Failed to dispatch"
    echo "Response: $DISPATCH_RESPONSE"
    exit 1
fi

echo "✓ Dispatched to $ASSIGNMENTS_CREATED suppliers"
echo ""
echo "Match Results:"
echo "$DISPATCH_RESPONSE" | jq -r '.matches[] | "  - \(.supplierId | .[0:8])... Score: \(.matchScore)% Reasons: \(.matchReasons | join(", "))"'
echo ""

# Step 8: Supplier A Creates Offer
echo "💰 Step 8: Supplier A creating offer..."
OFFER_A_RESPONSE=$(curl -s -X POST "$API_URL/api/quote-requests/$QUOTE_REQUEST_ID/offers" \
  -H 'Content-Type: application/json' \
  -d '{
    "supplierId": "'"$SUPPLIER_A_ID"'",
    "supplierWineId": "'"$WINE_A_ID"'",
    "offeredPriceExVatSek": 390.00,
    "quantity": 12,
    "deliveryDate": "2026-02-01",
    "leadTimeDays": 7,
    "notes": "Premium Bordeaux from our French estate. Temperature controlled transport included."
  }')

OFFER_A_ID=$(echo "$OFFER_A_RESPONSE" | jq -r '.offer.id')

if [ "$OFFER_A_ID" == "null" ] || [ -z "$OFFER_A_ID" ]; then
    echo "❌ Failed to create offer A"
    echo "Response: $OFFER_A_RESPONSE"
    exit 1
fi

echo "✓ Offer A created: $OFFER_A_ID"
echo "  Price: 390 SEK/bottle × 12 = 4,680 SEK (excl. VAT)"
echo ""

# Step 9: Supplier B Creates Offer
echo "💰 Step 9: Supplier B creating offer..."
OFFER_B_RESPONSE=$(curl -s -X POST "$API_URL/api/quote-requests/$QUOTE_REQUEST_ID/offers" \
  -H 'Content-Type: application/json' \
  -d '{
    "supplierId": "'"$SUPPLIER_B_ID"'",
    "supplierWineId": "'"$WINE_B_ID"'",
    "offeredPriceExVatSek": 420.00,
    "quantity": 12,
    "deliveryDate": "2026-02-05",
    "leadTimeDays": 5,
    "notes": "Same wine, faster delivery. Free shipping to Stockholm."
  }')

OFFER_B_ID=$(echo "$OFFER_B_RESPONSE" | jq -r '.offer.id')

if [ "$OFFER_B_ID" == "null" ] || [ -z "$OFFER_B_ID" ]; then
    echo "❌ Failed to create offer B"
    echo "Response: $OFFER_B_RESPONSE"
    exit 1
fi

echo "✓ Offer B created: $OFFER_B_ID"
echo "  Price: 420 SEK/bottle × 12 = 5,040 SEK (excl. VAT)"
echo ""

# Step 10: List Offers
echo "📋 Step 10: Fetching offers for restaurant..."
OFFERS_RESPONSE=$(curl -s "$API_URL/api/quote-requests/$QUOTE_REQUEST_ID/offers")

OFFERS_COUNT=$(echo "$OFFERS_RESPONSE" | jq -r '.offers | length')
SUMMARY=$(echo "$OFFERS_RESPONSE" | jq -r '.summary')

echo "✓ Found $OFFERS_COUNT offers"
echo ""
echo "Summary:"
echo "$SUMMARY" | jq '.'
echo ""
echo "Offers:"
echo "$OFFERS_RESPONSE" | jq -r '.offers[] | "  [\(.matchScore)%] \(.supplierName): \(.totalIncVatSek) SEK (incl. VAT)"'
echo ""

# Step 11: UI Testing
echo "🎨 Step 11: UI Testing"
echo "════════════════════════════════════════════════"
echo ""
echo "✅ Backend test complete!"
echo ""
echo "Now test the UI:"
echo ""
echo "  1. Open browser:"
echo "     http://localhost:3000/dashboard/offers/$QUOTE_REQUEST_ID"
echo ""
echo "  2. You should see:"
echo "     - 2 offers with match scores"
echo "     - Pricing breakdown (excl/incl VAT)"
echo "     - Service fee: 0 kr (PILOT)"
echo "     - Match reasons for each offer"
echo ""
echo "  3. Click '✓ Acceptera offert' on best offer"
echo ""
echo "  4. Success modal should show:"
echo "     - Order confirmation"
echo "     - Order ID"
echo "     - Pricing summary"
echo ""
echo "════════════════════════════════════════════════"
echo ""
echo "📊 Test Data Summary"
echo "════════════════════════════════════════════════"
echo ""
echo "Restaurant ID:      $RESTAURANT_ID"
echo "Quote Request ID:   $QUOTE_REQUEST_ID"
echo "Supplier A ID:      $SUPPLIER_A_ID"
echo "Supplier B ID:      $SUPPLIER_B_ID"
echo "Offer A ID:         $OFFER_A_ID (390 SEK/bottle)"
echo "Offer B ID:         $OFFER_B_ID (420 SEK/bottle)"
echo ""
echo "UI URL:"
echo "  http://localhost:3000/dashboard/offers/$QUOTE_REQUEST_ID"
echo ""
echo "✅ Test script complete!"
