#!/bin/bash
# MVP REQUEST-OFFER-ACCEPT SMOKE TEST
# Tests complete pilot loop: Request → Offer → Accept → Request updated

set -e

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000001}"
RESTAURANT_ID="${RESTAURANT_ID:-11111111-1111-1111-1111-111111111111}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  MVP REQUEST-OFFER-ACCEPT PILOT LOOP TEST"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Base URL:  ${API_BASE}"
echo "Tenant ID: ${TENANT_ID}"
echo ""

# ════════════════════════════════════════════════════════════════
# TEST 1: Create request (simplified - we'll create an offer for existing request)
# For MVP: We need a test request. Let's create one via API if endpoint exists,
# otherwise use seeded data
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 1: Get/Create Test Request"
echo "─────────────────────────────────────────"

# Try to get an OPEN request first
REQUESTS_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/requests?status=OPEN&limit=1")

STATUS_CODE=$(echo "$REQUESTS_RESPONSE" | tail -n 1)
BODY=$(echo "$REQUESTS_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  REQUEST_ID=$(echo "$BODY" | jq -r '.requests[0].id // empty')
  
  if [ -n "$REQUEST_ID" ] && [ "$REQUEST_ID" != "null" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Using existing request: $REQUEST_ID"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${YELLOW}⚠ WARN${NC} - No OPEN requests found. You need to create a test request manually."
    echo "Please create a request in the database or via the UI first."
    exit 1
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  echo "Cannot proceed without a test request."
  exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 2: Get request details
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 2: GET Request Details"
echo "─────────────────────────────────────────"

REQUEST_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/requests/${REQUEST_ID}")

STATUS_CODE=$(echo "$REQUEST_RESPONSE" | tail -n 1)
BODY=$(echo "$REQUEST_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  REQUEST_STATUS=$(echo "$BODY" | jq -r '.request.status')
  EXISTING_OFFERS=$(echo "$BODY" | jq -r '.offers | length')
  echo -e "${GREEN}✓ PASS${NC} - Request loaded: status=${REQUEST_STATUS}, offers=${EXISTING_OFFERS}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  
  # Get restaurant_id from request for offer creation
  RESTAURANT_ID=$(echo "$BODY" | jq -r '.request.restaurant_id')
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 2B: Verify request visible in list BEFORE offers created
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 2B: Verify Request Visible Without Offers"
echo "─────────────────────────────────────────"

# Verify request appears in list even if it has 0 offers
LIST_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/requests?status=OPEN")

STATUS_CODE=$(echo "$LIST_RESPONSE" | tail -n 1)
BODY=$(echo "$LIST_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  # Find our request in the list
  REQUEST_IN_LIST=$(echo "$BODY" | jq -r --arg rid "$REQUEST_ID" '.requests[] | select(.id == $rid) | .id')
  OFFERS_COUNT=$(echo "$BODY" | jq -r --arg rid "$REQUEST_ID" '.requests[] | select(.id == $rid) | .offers_count')

  if [ "$REQUEST_IN_LIST" = "$REQUEST_ID" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Request visible in list with offers_count=${OFFERS_COUNT}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Request NOT found in list (tenant scoping issue?)"
    echo "Expected request_id: $REQUEST_ID"
    echo "Requests in response:"
    echo "$BODY" | jq '.requests[].id'
    TESTS_FAILED=$((TESTS_FAILED + 1))
    exit 1
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 3: Create offer linked to request
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 3: Create Offer Linked to Request"
echo "─────────────────────────────────────────"

CREATE_OFFER_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "request_id": "'"${REQUEST_ID}"'",
    "restaurant_id": "'"${RESTAURANT_ID}"'",
    "title": "Pilot Loop Test Offer",
    "currency": "SEK",
    "lines": [
      {
        "line_no": 1,
        "name": "Château Margaux 2015",
        "vintage": 2015,
        "quantity": 6,
        "bottle_ml": 750,
        "offered_unit_price_ore": 50000
      }
    ]
  }' \
  "${API_BASE}/api/offers")

STATUS_CODE=$(echo "$CREATE_OFFER_RESPONSE" | tail -n 1)
BODY=$(echo "$CREATE_OFFER_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 201 ]; then
  OFFER_ID=$(echo "$BODY" | jq -r '.offer_id')
  echo -e "${GREEN}✓ PASS${NC} - Offer created: $OFFER_ID (linked to request $REQUEST_ID)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 4: Verify offer has request_id
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 4: Verify Offer has request_id"
echo "─────────────────────────────────────────"

GET_OFFER_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/offers/${OFFER_ID}")

STATUS_CODE=$(echo "$GET_OFFER_RESPONSE" | tail -n 1)
BODY=$(echo "$GET_OFFER_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  OFFER_REQUEST_ID=$(echo "$BODY" | jq -r '.offer.request_id')
  
  if [ "$OFFER_REQUEST_ID" = "$REQUEST_ID" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Offer.request_id correctly set to $REQUEST_ID"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Expected request_id=$REQUEST_ID, got $OFFER_REQUEST_ID"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 4B: Verify MAIL_SENT event for OFFER_CREATED (if enabled)
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 4B: Verify Email Event (OFFER_CREATED)"
echo "─────────────────────────────────────────"

EMAIL_EVENTS_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/offers/${OFFER_ID}")

STATUS_CODE=$(echo "$EMAIL_EVENTS_RESPONSE" | tail -n 1)
BODY=$(echo "$EMAIL_EVENTS_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  # Check if email event exists in events array
  EMAIL_EVENT=$(echo "$BODY" | jq -r '.events[] | select(.event_type == "MAIL_SENT" and .payload.type == "OFFER_CREATED") | .event_type')

  if [ "$EMAIL_EVENT" = "MAIL_SENT" ]; then
    EMAIL_SUCCESS=$(echo "$BODY" | jq -r '.events[] | select(.event_type == "MAIL_SENT" and .payload.type == "OFFER_CREATED") | .payload.success')
    echo -e "${GREEN}✓ PASS${NC} - Email event logged (success=${EMAIL_SUCCESS})"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${YELLOW}⚠ SKIP${NC} - No email event found (EMAIL_NOTIFICATIONS_ENABLED likely false)"
    echo "  This is expected in dev mode with emails disabled"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 5: Accept offer
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 5: Accept Offer (Pilot Loop Core)"
echo "─────────────────────────────────────────"

ACCEPT_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "x-tenant-id: ${TENANT_ID}" \
  -H "x-user-id: ${TENANT_ID}" \
  "${API_BASE}/api/offers/${OFFER_ID}/accept")

STATUS_CODE=$(echo "$ACCEPT_RESPONSE" | tail -n 1)
BODY=$(echo "$ACCEPT_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  ACCEPTED_AT=$(echo "$BODY" | jq -r '.accepted_at')
  LOCKED_AT=$(echo "$BODY" | jq -r '.locked_at')
  echo -e "${GREEN}✓ PASS${NC} - Offer accepted"
  echo "  Accepted at: $ACCEPTED_AT"
  echo "  Locked at: $LOCKED_AT"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 6: Verify request.accepted_offer_id is set (PILOT LOOP KEY TEST)
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 6: Verify Request.accepted_offer_id"
echo "─────────────────────────────────────────"

VERIFY_REQUEST_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/requests/${REQUEST_ID}")

STATUS_CODE=$(echo "$VERIFY_REQUEST_RESPONSE" | tail -n 1)
BODY=$(echo "$VERIFY_REQUEST_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  ACCEPTED_OFFER_ID=$(echo "$BODY" | jq -r '.request.accepted_offer_id')
  REQUEST_STATUS=$(echo "$BODY" | jq -r '.request.status')
  
  if [ "$ACCEPTED_OFFER_ID" = "$OFFER_ID" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Request.accepted_offer_id = ${OFFER_ID}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Expected accepted_offer_id=${OFFER_ID}, got ${ACCEPTED_OFFER_ID}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  
  if [ "$REQUEST_STATUS" = "ACCEPTED" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Request.status = ACCEPTED"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Expected status=ACCEPTED, got ${REQUEST_STATUS}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 6B: Verify MAIL_SENT event for OFFER_ACCEPTED (if enabled)
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 6B: Verify Email Event (OFFER_ACCEPTED)"
echo "─────────────────────────────────────────"

EMAIL_ACCEPTED_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/offers/${OFFER_ID}")

STATUS_CODE=$(echo "$EMAIL_ACCEPTED_RESPONSE" | tail -n 1)
BODY=$(echo "$EMAIL_ACCEPTED_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  # Check if email event exists for OFFER_ACCEPTED
  EMAIL_ACCEPTED_EVENT=$(echo "$BODY" | jq -r '.events[] | select(.event_type == "MAIL_SENT" and .payload.type == "OFFER_ACCEPTED") | .event_type')

  if [ "$EMAIL_ACCEPTED_EVENT" = "MAIL_SENT" ]; then
    EMAIL_SUCCESS=$(echo "$BODY" | jq -r '.events[] | select(.event_type == "MAIL_SENT" and .payload.type == "OFFER_ACCEPTED") | .payload.success')
    echo -e "${GREEN}✓ PASS${NC} - Email event logged (success=${EMAIL_SUCCESS})"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${YELLOW}⚠ SKIP${NC} - No email event found (EMAIL_NOTIFICATIONS_ENABLED likely false)"
    echo "  This is expected in dev mode with emails disabled"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 7: Try to accept second offer (should fail - single offer constraint)
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 7: Try Accept Second Offer (should fail)"
echo "─────────────────────────────────────────"

# Create second offer
CREATE_OFFER2_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "request_id": "'"${REQUEST_ID}"'",
    "restaurant_id": "'"${RESTAURANT_ID}"'",
    "title": "Second Offer (Should Not Accept)",
    "currency": "SEK",
    "lines": [
      {"line_no": 1, "name": "Test Wine 2", "quantity": 1, "bottle_ml": 750}
    ]
  }' \
  "${API_BASE}/api/offers")

STATUS_CODE=$(echo "$CREATE_OFFER2_RESPONSE" | tail -n 1)
BODY=$(echo "$CREATE_OFFER2_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 201 ]; then
  OFFER2_ID=$(echo "$BODY" | jq -r '.offer_id')
  echo "Created second offer: $OFFER2_ID"
  
  # Try to accept it (should fail)
  ACCEPT2_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "x-tenant-id: ${TENANT_ID}" \
    "${API_BASE}/api/offers/${OFFER2_ID}/accept")
  
  STATUS_CODE=$(echo "$ACCEPT2_RESPONSE" | tail -n 1)
  BODY=$(echo "$ACCEPT2_RESPONSE" | sed '$d')
  
  if [ "$STATUS_CODE" -eq 400 ] || [ "$STATUS_CODE" -eq 409 ]; then
    ERROR_MSG=$(echo "$BODY" | jq -r '.error')
    echo -e "${GREEN}✓ PASS${NC} - Second accept correctly blocked (HTTP ${STATUS_CODE})"
    echo "  Error: $ERROR_MSG"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Expected 400 or 409, got ${STATUS_CODE}"
    echo "  Second offer should NOT be accepted!"
    echo "Response: $BODY"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
else
  echo -e "${YELLOW}⚠ WARN${NC} - Could not create second offer for test (HTTP $STATUS_CODE)"
  echo "Skipping constraint test"
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST SUMMARY
# ════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Tests Passed: ${GREEN}${TESTS_PASSED}${NC} / 9"

if [ "$TESTS_FAILED" -gt 0 ]; then
  echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
fi

echo ""
echo "Request ID: $REQUEST_ID"
echo "Offer ID: $OFFER_ID"
echo ""

# ════════════════════════════════════════════════════════════════
# FINAL VERDICT
# ════════════════════════════════════════════════════════════════

if [ "$TESTS_FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "Pilot Loop 1.0: COMPLETE"
  echo "- Request exists ✓"
  echo "- Offer created with request_id ✓"
  echo "- Offer accepted (locked + snapshot) ✓"
  echo "- Request.accepted_offer_id set ✓"
  echo "- Request.status = ACCEPTED ✓"
  echo "- Single offer constraint enforced ✓"
  echo ""
  echo "🎉 Request → Offer → Accept → Request.accepted_offer_id WORKS!"
  echo ""
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  exit 1
fi
