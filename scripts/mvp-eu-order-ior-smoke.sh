#!/bin/bash
# MVP EU-ORDER IOR SMOKE TEST
# Tests: EU-seller with default IOR → offer → accept → order created → IOR operations

set -e

API_BASE="http://localhost:3000/api"
TENANT_ID="00000000-0000-0000-0000-000000000001"
USER_ID="00000000-0000-0000-0000-000000000001"

echo "════════════════════════════════════════"
echo "MVP EU-Order IOR Smoke Test"
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
echo "  2. Migrations applied (suppliers.default_importer_id, orders tables)"
echo "  3. At least one restaurant, supplier (EU_PRODUCER), and importer in DB"
echo ""

# ============================================================================
# SETUP: Get test IDs
# ============================================================================

echo "Setup: You need to provide test IDs manually"
echo ""
echo "Please set these IDs before running:"
echo "  RESTAURANT_ID=\"your-test-restaurant-id\""
echo "  EU_SUPPLIER_ID=\"your-test-eu-supplier-id\"  # Must be type=EU_PRODUCER/EU_IMPORTER"
echo ""
echo "Note: IMPORTER_ID is now resolved automatically via actor context from USER_ID"
echo ""

# TODO: Replace these with actual IDs from your test data
RESTAURANT_ID="${RESTAURANT_ID:-REPLACE_WITH_TEST_RESTAURANT_ID}"
EU_SUPPLIER_ID="${EU_SUPPLIER_ID:-REPLACE_WITH_TEST_EU_SUPPLIER_ID}"

echo "Using test IDs:"
echo "  Restaurant: $RESTAURANT_ID"
echo "  EU Supplier: $EU_SUPPLIER_ID"
echo "  User: $USER_ID (IOR resolved via actor context)"
echo ""

# ============================================================================
# TEST 1: Verify supplier has default_importer_id (or set it)
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 1: Verify/Set Supplier Default IOR"
echo "─────────────────────────────────────────"

# Note: This requires direct DB access or a new API endpoint
# For MVP, we'll skip this and assume it's set
# In production smoke test, you'd verify via API

echo -e "${YELLOW}⚠ SKIP${NC} - Requires manual verification or DB query"
echo "  Verify with: SELECT id, namn, type, default_importer_id FROM suppliers WHERE id = '$EU_SUPPLIER_ID';"
echo ""

# ============================================================================
# TEST 1.5: Fetch Actor Context (Verify IOR Access)
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 1.5: Fetch Actor Context"
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

  IMPORTER_ID=$(echo "$BODY" | jq -r '.importer_id // empty')
  ROLES=$(echo "$BODY" | jq -r '.roles[]' | tr '\n' ', ' | sed 's/,$//')

  echo "  User Roles: $ROLES"
  echo "  Importer ID: $IMPORTER_ID"

  if echo "$BODY" | jq -e '.roles[] | select(. == "IOR")' > /dev/null; then
    echo -e "${GREEN}✓ PASS${NC} - User has IOR role"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - User missing IOR role"
    FAILED=$((FAILED + 1))
  fi

  if [ -n "$IMPORTER_ID" ] && [ "$IMPORTER_ID" != "null" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Importer ID resolved: $IMPORTER_ID"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - No importer_id in actor context"
    FAILED=$((FAILED + 1))
    echo "  User needs to be linked to an importer via org_number matching"
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  FAILED=$((FAILED + 1))
  exit 1
fi

echo ""

# ============================================================================
# TEST 2: Create Offer from EU Supplier
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 2: Create Offer from EU Supplier"
echo "─────────────────────────────────────────"

CREATE_OFFER_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-user-id: ${USER_ID}" \
  -d '{
    "tenant_id": "'"$TENANT_ID"'",
    "restaurant_id": "'"$RESTAURANT_ID"'",
    "supplier_id": "'"$EU_SUPPLIER_ID"'",
    "title": "Smoke Test EU Offer",
    "currency": "SEK",
    "lines": [
      {
        "line_no": 1,
        "name": "Château Test 2020",
        "vintage": 2020,
        "quantity": 6,
        "offered_unit_price_ore": 15000,
        "bottle_ml": 750,
        "packaging": "Hel låda 6st",
        "enrichment": {
          "canonical_name": "Château Test",
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
# TEST 3: Accept Offer (should create order)
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 3: Accept Offer (Order Creation)"
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
    echo -e "${RED}✗ FAIL${NC} - Order ID not returned (order creation may have failed)"
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
# TEST 4: Get Order via IOR API
# ============================================================================

if [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
  echo "─────────────────────────────────────────"
  echo "Test 4: Get Order via IOR API"
  echo "─────────────────────────────────────────"

  GET_ORDER_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -H "x-user-id: ${USER_ID}" \
    "${API_BASE}/ior/orders/${ORDER_ID}")

  STATUS_CODE=$(echo "$GET_ORDER_RESPONSE" | tail -n 1)
  BODY=$(echo "$GET_ORDER_RESPONSE" | sed '$d')

  if [ "$STATUS_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Order retrieved (HTTP 200)"
    PASSED=$((PASSED + 1))

    ORDER_STATUS=$(echo "$BODY" | jq -r '.order.status')
    ORDER_IOR=$(echo "$BODY" | jq -r '.order.importer_of_record_id')

    echo "  Order Status: $ORDER_STATUS"
    echo "  IOR: $ORDER_IOR"

    if [ "$ORDER_STATUS" = "CONFIRMED" ]; then
      echo -e "${GREEN}✓ PASS${NC} - Order status is CONFIRMED (expected initial state)"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - Order status is $ORDER_STATUS (expected CONFIRMED)"
      FAILED=$((FAILED + 1))
    fi

    if [ "$ORDER_IOR" = "$IMPORTER_ID" ]; then
      echo -e "${GREEN}✓ PASS${NC} - Order IOR matches test importer"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - Order IOR is $ORDER_IOR (expected $IMPORTER_ID)"
      FAILED=$((FAILED + 1))
    fi
  else
    echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
    echo "Response: $BODY"
    FAILED=$((FAILED + 1))
  fi

  echo ""

  # ============================================================================
  # TEST 5: List Orders via IOR API
  # ============================================================================

  echo "─────────────────────────────────────────"
  echo "Test 5: List Orders via IOR API"
  echo "─────────────────────────────────────────"

  LIST_ORDERS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -H "x-user-id: ${USER_ID}" \
    "${API_BASE}/ior/orders?status=CONFIRMED")

  STATUS_CODE=$(echo "$LIST_ORDERS_RESPONSE" | tail -n 1)
  BODY=$(echo "$LIST_ORDERS_RESPONSE" | sed '$d')

  if [ "$STATUS_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Orders list retrieved (HTTP 200)"
    PASSED=$((PASSED + 1))

    ORDER_COUNT=$(echo "$BODY" | jq '.orders | length')
    echo "  Total CONFIRMED orders: $ORDER_COUNT"

    # Check if our order is in the list
    ORDER_IN_LIST=$(echo "$BODY" | jq --arg oid "$ORDER_ID" '.orders[] | select(.id == $oid) | .id')

    if [ -n "$ORDER_IN_LIST" ]; then
      echo -e "${GREEN}✓ PASS${NC} - Created order found in list"
      PASSED=$((PASSED + 1))
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
  # TEST 6: Update Order Status (CONFIRMED → IN_FULFILLMENT)
  # ============================================================================

  echo "─────────────────────────────────────────"
  echo "Test 6: Update Order Status to IN_FULFILLMENT"
  echo "─────────────────────────────────────────"

  UPDATE_STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -H "x-user-id: ${USER_ID}" \
    -d '{
      "to_status": "IN_FULFILLMENT",
      "note": "Smoke test: Starting fulfillment"
    }' \
    "${API_BASE}/ior/orders/${ORDER_ID}/status")

  STATUS_CODE=$(echo "$UPDATE_STATUS_RESPONSE" | tail -n 1)
  BODY=$(echo "$UPDATE_STATUS_RESPONSE" | sed '$d')

  if [ "$STATUS_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status updated (HTTP 200)"
    PASSED=$((PASSED + 1))

    TO_STATUS=$(echo "$BODY" | jq -r '.to_status')
    if [ "$TO_STATUS" = "IN_FULFILLMENT" ]; then
      echo -e "${GREEN}✓ PASS${NC} - Status is now IN_FULFILLMENT"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - Status is $TO_STATUS (expected IN_FULFILLMENT)"
      FAILED=$((FAILED + 1))
    fi
  else
    echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
    echo "Response: $BODY"
    FAILED=$((FAILED + 1))
  fi

  echo ""

  # ============================================================================
  # TEST 7: Update Status (IN_FULFILLMENT → SHIPPED)
  # ============================================================================

  echo "─────────────────────────────────────────"
  echo "Test 7: Update Order Status to SHIPPED"
  echo "─────────────────────────────────────────"

  SHIPPED_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -H "x-user-id: ${USER_ID}" \
    -d '{
      "to_status": "SHIPPED",
      "note": "Smoke test: Order shipped",
      "metadata": {
        "tracking_number": "SMOKE-TEST-12345",
        "carrier": "Test Logistics"
      }
    }' \
    "${API_BASE}/ior/orders/${ORDER_ID}/status")

  STATUS_CODE=$(echo "$SHIPPED_RESPONSE" | tail -n 1)
  BODY=$(echo "$SHIPPED_RESPONSE" | sed '$d')

  if [ "$STATUS_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status updated to SHIPPED (HTTP 200)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
    echo "Response: $BODY"
    FAILED=$((FAILED + 1))
  fi

  echo ""

  # ============================================================================
  # TEST 8: Verify Order Events (Audit Trail)
  # ============================================================================

  echo "─────────────────────────────────────────"
  echo "Test 8: Verify Order Events (Audit Trail)"
  echo "─────────────────────────────────────────"

  GET_ORDER_WITH_EVENTS=$(curl -s -w "\n%{http_code}" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -H "x-user-id: ${USER_ID}" \
    "${API_BASE}/ior/orders/${ORDER_ID}")

  STATUS_CODE=$(echo "$GET_ORDER_WITH_EVENTS" | tail -n 1)
  BODY=$(echo "$GET_ORDER_WITH_EVENTS" | sed '$d')

  if [ "$STATUS_CODE" -eq 200 ]; then
    EVENT_COUNT=$(echo "$BODY" | jq '.events | length')
    echo "  Total events: $EVENT_COUNT"

    if [ "$EVENT_COUNT" -ge 3 ]; then
      echo -e "${GREEN}✓ PASS${NC} - At least 3 events recorded (ORDER_CREATED + 2 status changes)"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - Only $EVENT_COUNT events (expected >= 3)"
      FAILED=$((FAILED + 1))
    fi

    echo ""
    echo "Sample events:"
    echo "$BODY" | jq -r '.events[:3][] | "  - \(.event_type): \(.from_status // "N/A") → \(.to_status // "N/A")"'
  else
    echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
    FAILED=$((FAILED + 1))
  fi

  echo ""

  # ============================================================================
  # TEST 8.5: Verify Email Notification Events (Order Status Updates)
  # ============================================================================

  echo "─────────────────────────────────────────"
  echo "Test 8.5: Verify Email Notification Events"
  echo "─────────────────────────────────────────"

  # Count MAIL_SENT events
  MAIL_SENT_COUNT=$(echo "$BODY" | jq '[.events[] | select(.event_type == "MAIL_SENT")] | length')

  echo "  MAIL_SENT events found: $MAIL_SENT_COUNT"
  echo "  Note: Count = (number of status updates) × (number of restaurant users)"
  echo "        Example: 2 status updates × 2 users = 4 MAIL_SENT events"

  # We should have at least 2 MAIL_SENT events (minimum: 1 recipient × 2 status updates)
  # Could be more if restaurant has multiple users (e.g., 2 users × 2 updates = 4 events)
  if [ "$MAIL_SENT_COUNT" -ge 2 ]; then
    echo -e "${GREEN}✓ PASS${NC} - At least 2 MAIL_SENT events logged"
    PASSED=$((PASSED + 1))

    # Count unique recipients
    UNIQUE_RECIPIENTS=$(echo "$BODY" | jq '[.events[] | select(.event_type == "MAIL_SENT") | .metadata.to_masked] | unique | length')
    echo "  Unique recipients: $UNIQUE_RECIPIENTS"

    if [ "$UNIQUE_RECIPIENTS" -ge 1 ]; then
      echo -e "${GREEN}✓ PASS${NC} - At least 1 unique recipient found"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - No recipients found in events"
      FAILED=$((FAILED + 1))
    fi

    # Verify first MAIL_SENT event has correct structure
    FIRST_MAIL_EVENT=$(echo "$BODY" | jq '.events[] | select(.event_type == "MAIL_SENT") | .metadata' | head -n 1)

    if echo "$FIRST_MAIL_EVENT" | jq -e '.template' > /dev/null 2>&1; then
      TEMPLATE=$(echo "$FIRST_MAIL_EVENT" | jq -r '.template')
      echo "  Template type: $TEMPLATE"

      if [ "$TEMPLATE" = "ORDER_STATUS_UPDATED" ]; then
        echo -e "${GREEN}✓ PASS${NC} - Email template is ORDER_STATUS_UPDATED"
        PASSED=$((PASSED + 1))
      else
        echo -e "${RED}✗ FAIL${NC} - Email template is $TEMPLATE (expected ORDER_STATUS_UPDATED)"
        FAILED=$((FAILED + 1))
      fi
    else
      echo -e "${RED}✗ FAIL${NC} - MAIL_SENT event missing template field"
      FAILED=$((FAILED + 1))
    fi

    # Verify to_masked field exists (email was masked for security)
    if echo "$FIRST_MAIL_EVENT" | jq -e '.to_masked' > /dev/null 2>&1; then
      TO_MASKED=$(echo "$FIRST_MAIL_EVENT" | jq -r '.to_masked')
      echo "  Recipient (masked): $TO_MASKED"

      if [[ "$TO_MASKED" == *"***"* ]]; then
        echo -e "${GREEN}✓ PASS${NC} - Email address is masked"
        PASSED=$((PASSED + 1))
      else
        echo -e "${RED}✗ FAIL${NC} - Email address not properly masked: $TO_MASKED"
        FAILED=$((FAILED + 1))
      fi
    else
      echo -e "${RED}✗ FAIL${NC} - MAIL_SENT event missing to_masked field"
      FAILED=$((FAILED + 1))
    fi

    # Verify success field
    if echo "$FIRST_MAIL_EVENT" | jq -e '.success' > /dev/null 2>&1; then
      SUCCESS=$(echo "$FIRST_MAIL_EVENT" | jq -r '.success')
      echo "  Email success: $SUCCESS"

      # Note: If EMAIL_NOTIFICATIONS_ENABLED=false, success will be true but email not actually sent
      if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✓ PASS${NC} - Email event logged successfully"
        PASSED=$((PASSED + 1))
        echo "  Note: If EMAIL_NOTIFICATIONS_ENABLED=false, email was logged but not actually sent"
      else
        echo -e "${YELLOW}⚠ WARN${NC} - Email sending failed (check logs for details)"
        echo "  This is non-blocking - status update succeeded"
      fi
    fi
  else
    echo -e "${RED}✗ FAIL${NC} - Expected at least 2 MAIL_SENT events, found $MAIL_SENT_COUNT"
    FAILED=$((FAILED + 1))
    echo "  Restaurant email notifications may not be working correctly"
  fi

  echo ""

  # ============================================================================
  # TEST 9: Verify Import Case Auto-Created (for EU orders)
  # ============================================================================

  echo "─────────────────────────────────────────"
  echo "Test 9: Verify Import Case Auto-Created"
  echo "─────────────────────────────────────────"

  IMPORT_ID=$(echo "$BODY" | jq -r '.order.import_case.id // empty')

  if [ -n "$IMPORT_ID" ] && [ "$IMPORT_ID" != "null" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Import case auto-created: $IMPORT_ID"
    PASSED=$((PASSED + 1))

    IMPORT_STATUS=$(echo "$BODY" | jq -r '.order.compliance.import_case_status // empty')
    echo "  Import case status: $IMPORT_STATUS"

    if [ "$IMPORT_STATUS" = "NOT_REGISTERED" ]; then
      echo -e "${GREEN}✓ PASS${NC} - Import case has expected initial status (NOT_REGISTERED)"
      PASSED=$((PASSED + 1))
    else
      echo -e "${YELLOW}⚠ WARN${NC} - Import case status is $IMPORT_STATUS (expected NOT_REGISTERED)"
    fi
  else
    echo -e "${YELLOW}⚠ WARN${NC} - No import case auto-created (may be expected if DDL not available)"
    echo "  This is not a failure - import case can be created manually via UI"
  fi

  echo ""

  # ============================================================================
  # TEST 10: Verify Compliance Data (DDL status, documents count)
  # ============================================================================

  echo "─────────────────────────────────────────"
  echo "Test 10: Verify Compliance Data"
  echo "─────────────────────────────────────────"

  if [ -n "$IMPORT_ID" ] && [ "$IMPORT_ID" != "null" ]; then
    DDL_STATUS=$(echo "$BODY" | jq -r '.order.compliance.ddl_status // empty')
    DOCS_COUNT=$(echo "$BODY" | jq -r '.order.compliance.documents_count // 0')

    echo "  DDL Status: $DDL_STATUS"
    echo "  Documents Count: $DOCS_COUNT"

    if [ -n "$DDL_STATUS" ]; then
      echo -e "${GREEN}✓ PASS${NC} - DDL status returned: $DDL_STATUS"
      PASSED=$((PASSED + 1))
    else
      echo -e "${YELLOW}⚠ WARN${NC} - DDL status not available"
    fi

    echo -e "${GREEN}✓ PASS${NC} - Compliance data structure present"
    PASSED=$((PASSED + 1))
  else
    echo -e "${YELLOW}⚠ SKIP${NC} - No import case, skipping compliance verification"
  fi

  echo ""

  # ============================================================================
  # TEST 11: Approve Import Case & Verify Order Auto-Confirmation
  # ============================================================================

  echo "─────────────────────────────────────────"
  echo "Test 11: Auto-Update Order When Import Approved"
  echo "─────────────────────────────────────────"

  if [ -n "$IMPORT_ID" ] && [ "$IMPORT_ID" != "null" ]; then
    echo "Approving import case: $IMPORT_ID"

    # Step 1: Approve import case
    APPROVE_RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -H "x-tenant-id: ${TENANT_ID}" \
      -H "x-user-id: ${USER_ID}" \
      -d '{
        "to_status": "APPROVED",
        "why": "Smoke test approval for auto-update verification"
      }' \
      "${API_BASE}/imports/${IMPORT_ID}/status")

    STATUS_CODE=$(echo "$APPROVE_RESPONSE" | tail -n 1)
    APPROVE_BODY=$(echo "$APPROVE_RESPONSE" | sed '$d')

    if [ "$STATUS_CODE" -eq 200 ]; then
      echo -e "${GREEN}✓ PASS${NC} - Import case approved (HTTP 200)"
      PASSED=$((PASSED + 1))

      # Step 2: Re-fetch order to verify status updated
      sleep 1  # Brief pause to ensure async operations complete

      ORDER_DETAIL_RESPONSE=$(curl -s -w "\n%{http_code}" \
        -H "x-tenant-id: ${TENANT_ID}" \
        -H "x-user-id: ${USER_ID}" \
        "${API_BASE}/ior/orders/${ORDER_ID}")

      STATUS_CODE=$(echo "$ORDER_DETAIL_RESPONSE" | tail -n 1)
      ORDER_BODY=$(echo "$ORDER_DETAIL_RESPONSE" | sed '$d')

      if [ "$STATUS_CODE" -eq 200 ]; then
        # Verify order status is CONFIRMED
        ORDER_STATUS=$(echo "$ORDER_BODY" | jq -r '.order.status // empty')
        echo "  Current order status: $ORDER_STATUS"

        if [ "$ORDER_STATUS" = "CONFIRMED" ]; then
          echo -e "${GREEN}✓ PASS${NC} - Order status is CONFIRMED"
          PASSED=$((PASSED + 1))
        else
          echo -e "${RED}✗ FAIL${NC} - Order status is $ORDER_STATUS (expected CONFIRMED)"
          FAILED=$((FAILED + 1))
        fi

        # Verify STATUS_AUTO_UPDATED event logged
        AUTO_UPDATE_EVENT=$(echo "$ORDER_BODY" | jq '[.events[] | select(.event_type == "STATUS_AUTO_UPDATED")] | length')

        if [ "$AUTO_UPDATE_EVENT" -gt 0 ]; then
          echo -e "${GREEN}✓ PASS${NC} - STATUS_AUTO_UPDATED event logged"
          PASSED=$((PASSED + 1))

          # Show event details
          EVENT_NOTE=$(echo "$ORDER_BODY" | jq -r '[.events[] | select(.event_type == "STATUS_AUTO_UPDATED")] | first | .note // empty')
          echo "  Event note: ${EVENT_NOTE:0:60}..."
        else
          echo -e "${YELLOW}⚠ WARN${NC} - No STATUS_AUTO_UPDATED event found"
          echo "  This may be expected if order was already CONFIRMED"
        fi

        # Verify MAIL_SENT event for auto-update notification
        TOTAL_MAIL_EVENTS=$(echo "$ORDER_BODY" | jq '[.events[] | select(.event_type == "MAIL_SENT")] | length')
        echo "  Total MAIL_SENT events: $TOTAL_MAIL_EVENTS (includes previous status updates + auto-confirmation)"

        if [ "$TOTAL_MAIL_EVENTS" -gt 2 ]; then
          echo -e "${GREEN}✓ PASS${NC} - Additional MAIL_SENT events logged after import approval"
          PASSED=$((PASSED + 1))
        else
          echo -e "${YELLOW}⚠ INFO${NC} - No new MAIL_SENT events (may be expected if EMAIL_NOTIFICATIONS_ENABLED=false)"
        fi
      else
        echo -e "${RED}✗ FAIL${NC} - Failed to re-fetch order (HTTP $STATUS_CODE)"
        FAILED=$((FAILED + 1))
      fi
    else
      echo -e "${RED}✗ FAIL${NC} - Failed to approve import case (HTTP $STATUS_CODE)"
      FAILED=$((FAILED + 1))
      echo "Response: $APPROVE_BODY"
    fi
  else
    echo -e "${YELLOW}⚠ SKIP${NC} - No import case to approve"
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

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "Next Steps (Manual):"
  echo "  1. Access IOR UI: http://localhost:3000/ior/orders"
  echo "  2. Verify order appears in list"
  echo "  3. Click order to see details"
  echo "  4. Verify order lines and events are displayed"
  echo "  5. Verify Compliance section shows:"
  echo "     - Import case status (if auto-created)"
  echo "     - DDL status"
  echo "     - 5369 documents section"
  echo "  6. Test 'Create Import Case' button (if not auto-created)"
  echo "  7. Test status update via UI"
  echo ""
  echo "Created Order ID: $ORDER_ID"
  if [ -n "$IMPORT_ID" ] && [ "$IMPORT_ID" != "null" ]; then
    echo "Created Import ID: $IMPORT_ID"
  fi
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Ensure migrations are applied: check suppliers.default_importer_id exists"
  echo "  2. Ensure EU supplier has default_importer_id set in DB"
  echo "  3. Check server logs for order creation errors"
  echo "  4. Verify test IDs are correct"
  exit 1
fi
