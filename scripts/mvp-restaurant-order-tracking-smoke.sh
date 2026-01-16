#!/bin/bash
# MVP RESTAURANT ORDER TRACKING SMOKE TEST
# Tests: Create request → offer → accept → order created → view via restaurant API

set -e

API_BASE="http://localhost:3000/api"
TENANT_ID="00000000-0000-0000-0000-000000000001"
USER_ID="00000000-0000-0000-0000-000000000001"

echo "════════════════════════════════════════"
echo "MVP Restaurant Order Tracking Smoke Test"
echo "════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

echo "Prerequisites:"
echo "  1. Dev server running: npm run dev"
echo "  2. Migrations applied (actor-service, orders tables)"
echo "  3. At least one restaurant, supplier, and importer in DB"
echo "  4. User must have RESTAURANT role (restaurant_users mapping)"
echo ""

# ============================================================================
# SETUP: Get test IDs
# ============================================================================

echo "Setup: You need to provide test IDs manually"
echo ""
echo "Please set these IDs before running:"
echo "  RESTAURANT_ID=\"your-test-restaurant-id\""
echo "  SUPPLIER_ID=\"your-test-supplier-id\""
echo ""

# TODO: Replace these with actual IDs from your test data
RESTAURANT_ID="${RESTAURANT_ID:-REPLACE_WITH_TEST_RESTAURANT_ID}"
SUPPLIER_ID="${SUPPLIER_ID:-REPLACE_WITH_TEST_SUPPLIER_ID}"

echo "Using test IDs:"
echo "  Restaurant: $RESTAURANT_ID"
echo "  Supplier: $SUPPLIER_ID"
echo "  User: $USER_ID (RESTAURANT role resolved via actor context)"
echo ""

# ============================================================================
# TEST 1: Fetch Actor Context (Verify RESTAURANT Access)
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 1: Fetch Actor Context"
echo "─────────────────────────────────────────"

ACTOR_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-user-id: ${USER_ID}" \
  "${API_BASE}/me/actor")

STATUS_CODE=$(echo "$ACTOR_RESPONSE" | tail -n 1)
BODY=$(echo "$ACTOR_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ PASS${NC} - Actor context retrieved (HTTP 200)"
  PASSED=$((PASSED + 1))

  RESOLVED_RESTAURANT_ID=$(echo "$BODY" | jq -r '.restaurant_id // empty')
  ROLES=$(echo "$BODY" | jq -r '.roles[]' | tr '\n' ', ' | sed 's/,$//')

  echo "  User Roles: $ROLES"
  echo "  Restaurant ID: $RESOLVED_RESTAURANT_ID"

  if echo "$BODY" | jq -e '.roles[] | select(. == "RESTAURANT")' > /dev/null; then
    echo -e "${GREEN}✓ PASS${NC} - User has RESTAURANT role"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - User missing RESTAURANT role"
    FAILED=$((FAILED + 1))
    echo "  User needs to be added to restaurant_users table"
  fi

  if [ -n "$RESOLVED_RESTAURANT_ID" ] && [ "$RESOLVED_RESTAURANT_ID" != "null" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Restaurant ID resolved: $RESOLVED_RESTAURANT_ID"
    PASSED=$((PASSED + 1))
    # Update RESTAURANT_ID with resolved value
    RESTAURANT_ID="$RESOLVED_RESTAURANT_ID"
  else
    echo -e "${RED}✗ FAIL${NC} - No restaurant_id in actor context"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  FAILED=$((FAILED + 1))
  exit 1
fi

echo ""

# ============================================================================
# TEST 2: Create Request (Restaurant needs wines)
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 2: Create Request (Restaurant)"
echo "─────────────────────────────────────────"

CREATE_REQUEST_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-user-id: ${USER_ID}" \
  -d '{
    "tenant_id": "'"$TENANT_ID"'",
    "restaurant_id": "'"$RESTAURANT_ID"'",
    "title": "Smoke Test Restaurant Order Tracking",
    "description": "Testing order tracking feature",
    "wines": [
      {
        "name": "Château Smoke Test 2020",
        "producer": "Test Winery",
        "country": "France",
        "region": "Bordeaux",
        "vintage": 2020,
        "quantity": 12,
        "unit": "bottle",
        "notes": "Smoke test order tracking"
      }
    ]
  }' \
  "${API_BASE}/requests")

STATUS_CODE=$(echo "$CREATE_REQUEST_RESPONSE" | tail -n 1)
BODY=$(echo "$CREATE_REQUEST_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 201 ]; then
  echo -e "${GREEN}✓ PASS${NC} - Request created (HTTP 201)"
  PASSED=$((PASSED + 1))

  REQUEST_ID=$(echo "$BODY" | jq -r '.request_id')
  echo "  Request ID: $REQUEST_ID"
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  FAILED=$((FAILED + 1))
  exit 1
fi

echo ""

# ============================================================================
# TEST 3: Create Offer (Supplier responds)
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 3: Create Offer (Supplier)"
echo "─────────────────────────────────────────"

CREATE_OFFER_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-user-id: ${USER_ID}" \
  -d '{
    "tenant_id": "'"$TENANT_ID"'",
    "restaurant_id": "'"$RESTAURANT_ID"'",
    "supplier_id": "'"$SUPPLIER_ID"'",
    "title": "Smoke Test Offer for Order Tracking",
    "currency": "SEK",
    "lines": [
      {
        "line_no": 1,
        "name": "Château Smoke Test 2020",
        "vintage": 2020,
        "quantity": 12,
        "offered_unit_price_ore": 15000,
        "bottle_ml": 750,
        "packaging": "Hel låda 12st",
        "enrichment": {
          "canonical_name": "Château Smoke Test",
          "producer": "Test Winery",
          "country": "France",
          "region": "Bordeaux"
        }
      }
    ]
  }' \
  "${API_BASE}/offers")

STATUS_CODE=$(echo "$CREATE_OFFER_RESPONSE" | tail -n 1)
BODY=$(echo "$CREATE_OFFER_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 201 ]; then
  echo -e "${GREEN}✓ PASS${NC} - Offer created (HTTP 201)"
  PASSED=$((PASSED + 1))

  OFFER_ID=$(echo "$BODY" | jq -r '.offer_id')
  echo "  Offer ID: $OFFER_ID"
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  FAILED=$((FAILED + 1))
  exit 1
fi

echo ""

# ============================================================================
# TEST 4: Accept Offer (Order Creation)
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 4: Accept Offer (Order Creation)"
echo "─────────────────────────────────────────"

ACCEPT_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-user-id: ${USER_ID}" \
  "${API_BASE}/offers/${OFFER_ID}/accept")

STATUS_CODE=$(echo "$ACCEPT_RESPONSE" | tail -n 1)
BODY=$(echo "$ACCEPT_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ PASS${NC} - Offer accepted (HTTP 200)"
  PASSED=$((PASSED + 1))

  ORDER_ID=$(echo "$BODY" | jq -r '.order_id // empty')

  if [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Order created: $ORDER_ID"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Order ID not returned"
    FAILED=$((FAILED + 1))
    echo "Response: $BODY"
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  FAILED=$((FAILED + 1))
  exit 1
fi

echo ""

# ============================================================================
# TEST 5: List Orders via Restaurant API
# ============================================================================

if [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
  echo "─────────────────────────────────────────"
  echo "Test 5: List Orders via Restaurant API"
  echo "─────────────────────────────────────────"

  LIST_ORDERS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -H "x-user-id: ${USER_ID}" \
    "${API_BASE}/restaurant/orders")

  STATUS_CODE=$(echo "$LIST_ORDERS_RESPONSE" | tail -n 1)
  BODY=$(echo "$LIST_ORDERS_RESPONSE" | sed '$d')

  if [ "$STATUS_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Orders list retrieved (HTTP 200)"
    PASSED=$((PASSED + 1))

    ORDER_COUNT=$(echo "$BODY" | jq '.orders | length')
    echo "  Total orders: $ORDER_COUNT"

    # Check if our order is in the list
    ORDER_IN_LIST=$(echo "$BODY" | jq --arg oid "$ORDER_ID" '.orders[] | select(.id == $oid) | .id')

    if [ -n "$ORDER_IN_LIST" ]; then
      echo -e "${GREEN}✓ PASS${NC} - Created order found in list"
      PASSED=$((PASSED + 1))

      # Check if compliance fields exist
      IMPORT_ID=$(echo "$BODY" | jq --arg oid "$ORDER_ID" '.orders[] | select(.id == $oid) | .import_id')
      echo "  Import ID: $IMPORT_ID"
    else
      echo -e "${RED}✗ FAIL${NC} - Created order not found in list"
      FAILED=$((FAILED + 1))
    fi
  else
    echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
    echo "Response: $BODY"
    FAILED=$((FAILED + 1))
  fi

  echo ""

  # ============================================================================
  # TEST 6: Get Order Detail via Restaurant API
  # ============================================================================

  echo "─────────────────────────────────────────"
  echo "Test 6: Get Order Detail via Restaurant API"
  echo "─────────────────────────────────────────"

  GET_ORDER_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -H "x-user-id: ${USER_ID}" \
    "${API_BASE}/restaurant/orders/${ORDER_ID}")

  STATUS_CODE=$(echo "$GET_ORDER_RESPONSE" | tail -n 1)
  BODY=$(echo "$GET_ORDER_RESPONSE" | sed '$d')

  if [ "$STATUS_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Order detail retrieved (HTTP 200)"
    PASSED=$((PASSED + 1))

    ORDER_STATUS=$(echo "$BODY" | jq -r '.order.status')
    LINES_COUNT=$(echo "$BODY" | jq '.lines | length')
    EVENTS_COUNT=$(echo "$BODY" | jq '.events | length')

    echo "  Order Status: $ORDER_STATUS"
    echo "  Order Lines: $LINES_COUNT"
    echo "  Events: $EVENTS_COUNT"

    if [ "$ORDER_STATUS" = "CONFIRMED" ]; then
      echo -e "${GREEN}✓ PASS${NC} - Order status is CONFIRMED (expected)"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - Order status is $ORDER_STATUS (expected CONFIRMED)"
      FAILED=$((FAILED + 1))
    fi

    if [ "$LINES_COUNT" -gt 0 ]; then
      echo -e "${GREEN}✓ PASS${NC} - Order has lines ($LINES_COUNT)"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - Order has no lines"
      FAILED=$((FAILED + 1))
    fi

    if [ "$EVENTS_COUNT" -gt 0 ]; then
      echo -e "${GREEN}✓ PASS${NC} - Order has events ($EVENTS_COUNT)"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - Order has no events"
      FAILED=$((FAILED + 1))
    fi

    # Check compliance summary
    COMPLIANCE=$(echo "$BODY" | jq '.compliance')
    if [ "$COMPLIANCE" != "null" ]; then
      echo -e "${GREEN}✓ PASS${NC} - Compliance summary present"
      PASSED=$((PASSED + 1))
      echo "  Compliance: $(echo "$COMPLIANCE" | jq -c '.')"
    else
      echo -e "${YELLOW}⚠ WARN${NC} - No compliance summary (OK for non-EU orders)"
    fi
  else
    echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
    echo "Response: $BODY"
    FAILED=$((FAILED + 1))
  fi

  echo ""
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo "════════════════════════════════════════"
echo "Test Summary"
echo "════════════════════════════════════════"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ -n "$ORDER_ID" ]; then
  echo "Created Order ID: $ORDER_ID"
  echo "View in UI: http://localhost:3000/orders/${ORDER_ID}"
  echo ""
fi

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
fi
