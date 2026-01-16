#!/bin/bash
# MVP OFFER LOOP SMOKE TEST
# Tests: create → get → update → accept → verify immutability

set -e

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000001}"

# Test restaurant + supplier IDs (replace with actual test data)
# For MVP, we'll use placeholder UUIDs that should be created in seed data
RESTAURANT_ID="11111111-1111-1111-1111-111111111111"

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
echo "  MVP OFFER LOOP SMOKE TEST"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Base URL:  ${API_BASE}"
echo "Tenant ID: ${TENANT_ID}"
echo ""

# ════════════════════════════════════════════════════════════════
# TEST 1: Create offer with 2 lines
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 1: Create Offer with 2 Lines"
echo "─────────────────────────────────────────"

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "restaurant_id": "'"${RESTAURANT_ID}"'",
    "title": "Test Offer - Smoke Test",
    "currency": "SEK",
    "lines": [
      {
        "line_no": 1,
        "name": "Château Margaux 2015",
        "vintage": 2015,
        "quantity": 6,
        "bottle_ml": 750,
        "offered_unit_price_ore": 50000
      },
      {
        "line_no": 2,
        "name": "Barolo DOCG 2018",
        "vintage": 2018,
        "quantity": 12,
        "bottle_ml": 750,
        "offered_unit_price_ore": 35000
      }
    ]
  }' \
  "${API_BASE}/api/offers")

STATUS_CODE=$(echo "$CREATE_RESPONSE" | tail -n 1)
BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 201 ]; then
  OFFER_ID=$(echo "$BODY" | jq -r '.offer_id')
  echo -e "${GREEN}✓ PASS${NC} - Offer created: $OFFER_ID"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 2: Get offer
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 2: Get Offer"
echo "─────────────────────────────────────────"

GET_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/offers/${OFFER_ID}")

STATUS_CODE=$(echo "$GET_RESPONSE" | tail -n 1)
BODY=$(echo "$GET_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  LINE_COUNT=$(echo "$BODY" | jq -r '.lines | length')
  OFFER_STATUS=$(echo "$BODY" | jq -r '.offer.status')
  echo -e "${GREEN}✓ PASS${NC} - Offer retrieved: $LINE_COUNT lines, status: $OFFER_STATUS"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 3: Update line with enrichment (Wine Check simulation)
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 3: Update Line with Enrichment"
echo "─────────────────────────────────────────"

LINE_ID=$(echo "$BODY" | jq -r '.lines[0].id')

UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "lines": [
      {
        "id": "'"${LINE_ID}"'",
        "line_no": 1,
        "enrichment": {
          "canonical_name": "Château Margaux Premier Grand Cru Classé",
          "producer": "Château Margaux",
          "country": "France",
          "region": "Bordeaux",
          "appellation": "Margaux",
          "ws_id": "123456",
          "match_status": "verified",
          "match_score": 95
        }
      }
    ]
  }' \
  "${API_BASE}/api/offers/${OFFER_ID}")

STATUS_CODE=$(echo "$UPDATE_RESPONSE" | tail -n 1)
BODY=$(echo "$UPDATE_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  CANONICAL_NAME=$(echo "$BODY" | jq -r '.lines[0].canonical_name')
  echo -e "${GREEN}✓ PASS${NC} - Line updated with enrichment: $CANONICAL_NAME"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 4: Accept offer (lock + snapshot)
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 4: Accept Offer"
echo "─────────────────────────────────────────"

ACCEPT_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/offers/${OFFER_ID}/accept")

STATUS_CODE=$(echo "$ACCEPT_RESPONSE" | tail -n 1)
BODY=$(echo "$ACCEPT_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  ACCEPTED_AT=$(echo "$BODY" | jq -r '.accepted_at')
  LOCKED_AT=$(echo "$BODY" | jq -r '.locked_at')
  SNAPSHOT_EXISTS=$(echo "$BODY" | jq -r '.snapshot | length')
  echo -e "${GREEN}✓ PASS${NC} - Offer accepted"
  echo "  Accepted at: $ACCEPTED_AT"
  echo "  Locked at: $LOCKED_AT"
  echo "  Snapshot size: $SNAPSHOT_EXISTS bytes"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 5: Verify immutability (try to update after accept)
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 5: Verify Immutability (should fail)"
echo "─────────────────────────────────────────"

IMMUTABLE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X PATCH \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "offer": {
      "title": "Should not update"
    }
  }' \
  "${API_BASE}/api/offers/${OFFER_ID}")

STATUS_CODE=$(echo "$IMMUTABLE_RESPONSE" | tail -n 1)
BODY=$(echo "$IMMUTABLE_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 409 ]; then
  ERROR_MSG=$(echo "$BODY" | jq -r '.error')
  echo -e "${GREEN}✓ PASS${NC} - Update correctly blocked: $ERROR_MSG"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - Expected 409, got $STATUS_CODE (immutability not enforced!)"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 6: Match offer line (product matching)
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 6: Match Offer Line"
echo "─────────────────────────────────────────"

MATCH_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/offer-lines/${LINE_ID}/match")

STATUS_CODE=$(echo "$MATCH_RESPONSE" | tail -n 1)
BODY=$(echo "$MATCH_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  MATCH_STATUS=$(echo "$BODY" | jq -r '.latest_match.status')
  MATCH_METHOD=$(echo "$BODY" | jq -r '.latest_match.match_method')
  CONFIDENCE=$(echo "$BODY" | jq -r '.latest_match.confidence')
  echo -e "${GREEN}✓ PASS${NC} - Line matched: $MATCH_STATUS via $MATCH_METHOD (confidence: $CONFIDENCE)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 7: Verify latest_match attached to line in GET /api/offers/[id]
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 7: Verify latest_match in GET offer"
echo "─────────────────────────────────────────"

VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/offers/${OFFER_ID}")

STATUS_CODE=$(echo "$VERIFY_RESPONSE" | tail -n 1)
BODY=$(echo "$VERIFY_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  LINE_MATCH=$(echo "$BODY" | jq -r ".lines[0].latest_match")

  if [ "$LINE_MATCH" != "null" ]; then
    MATCH_STATUS=$(echo "$BODY" | jq -r ".lines[0].latest_match.status")
    echo -e "${GREEN}✓ PASS${NC} - latest_match present on line: $MATCH_STATUS"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - latest_match is null (expected match data)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST 8: Verify snapshot exists in database
# ════════════════════════════════════════════════════════════════

echo "─────────────────────────────────────────"
echo "Test 8: Verify Snapshot in Database"
echo "─────────────────────────────────────────"

SNAPSHOT_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/offers/${OFFER_ID}")

STATUS_CODE=$(echo "$SNAPSHOT_RESPONSE" | tail -n 1)
BODY=$(echo "$SNAPSHOT_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  SNAPSHOT_PRESENT=$(echo "$BODY" | jq -r '.offer.snapshot != null')
  OFFER_STATUS=$(echo "$BODY" | jq -r '.offer.status')

  if [ "$SNAPSHOT_PRESENT" = "true" ] && [ "$OFFER_STATUS" = "ACCEPTED" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Snapshot exists, status: $OFFER_STATUS"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Snapshot missing or status incorrect"
    echo "Snapshot present: $SNAPSHOT_PRESENT, Status: $OFFER_STATUS"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# ════════════════════════════════════════════════════════════════
# TEST SUMMARY
# ════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Tests Passed: ${GREEN}${TESTS_PASSED}${NC} / 8"

if [ "$TESTS_FAILED" -gt 0 ]; then
  echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
fi

echo ""
echo "Created Offer ID: $OFFER_ID"
echo ""

# ════════════════════════════════════════════════════════════════
# FINAL VERDICT
# ════════════════════════════════════════════════════════════════

if [ "$TESTS_FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "Pilot Loop 1.0: READY"
  echo "- Create offer ✓"
  echo "- Update lines ✓"
  echo "- Match offer line (product matching) ✓"
  echo "- latest_match attached to lines ✓"
  echo "- Accept offer ✓"
  echo "- Immutability enforced ✓"
  echo "- Snapshot saved ✓"
  echo ""
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  exit 1
fi
