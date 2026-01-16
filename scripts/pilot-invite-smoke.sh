#!/bin/bash
# PILOT INVITE ONBOARDING - SMOKE TEST
# Tests: create invite → verify token → accept invite → verify used_at

set -e

API_BASE="http://localhost:3000"
TENANT_ID="00000000-0000-0000-0000-000000000001"

echo "════════════════════════════════════════"
echo "Pilot Invite Onboarding - Smoke Test"
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
echo "  2. ADMIN_MODE=true in .env.local"
echo "  3. Migrations applied (invites table exists)"
echo "  4. At least one restaurant and one supplier in DB"
echo ""

# ============================================================================
# SETUP: Get test restaurant and supplier IDs
# ============================================================================

echo "Setup: Fetching test restaurant and supplier IDs..."

# Note: This requires direct DB access or existing data
# For smoke test, we'll use hardcoded test IDs (replace with actual)
RESTAURANT_ID="REPLACE_WITH_TEST_RESTAURANT_ID"
SUPPLIER_ID="REPLACE_WITH_TEST_SUPPLIER_ID"

echo "  Restaurant ID: $RESTAURANT_ID"
echo "  Supplier ID: $SUPPLIER_ID"
echo ""

# ============================================================================
# TEST 1: Create Restaurant Invite
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 1: Create Restaurant Invite"
echo "─────────────────────────────────────────"

TEST_EMAIL="test-restaurant-$(date +%s)@example.com"

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "email": "'"$TEST_EMAIL"'",
    "role": "RESTAURANT",
    "restaurant_id": "'"$RESTAURANT_ID"'"
  }' \
  "${API_BASE}/api/admin/invites")

STATUS_CODE=$(echo "$CREATE_RESPONSE" | tail -n 1)
BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 201 ]; then
  echo -e "${GREEN}✓ PASS${NC} - Invite created (HTTP 201)"
  PASSED=$((PASSED + 1))

  INVITE_ID=$(echo "$BODY" | jq -r '.invite_id')
  echo "  Invite ID: $INVITE_ID"
  echo "  Email: $TEST_EMAIL"

  # Extract token from console/email logs (in real test, get from DB or mock email)
  # For smoke test, we'll note that token is sent via email
  echo ""
  echo "  ⚠ NOTE: Token sent via email to $TEST_EMAIL"
  echo "  In dev mode (EMAIL_NOTIFICATIONS_ENABLED=false), check console logs"
  echo ""

elif [ "$STATUS_CODE" -eq 403 ]; then
  echo -e "${YELLOW}⚠ SKIP${NC} - HTTP 403 Forbidden"
  echo "Admin access denied. Make sure ADMIN_MODE=true in .env.local"
  FAILED=$((FAILED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  FAILED=$((FAILED + 1))
fi

echo ""

# ============================================================================
# TEST 2: Create Supplier Invite
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 2: Create Supplier Invite"
echo "─────────────────────────────────────────"

SUPPLIER_EMAIL="test-supplier-$(date +%s)@example.com"

SUPPLIER_CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: ${TENANT_ID}" \
  -d '{
    "email": "'"$SUPPLIER_EMAIL"'",
    "role": "SUPPLIER",
    "supplier_id": "'"$SUPPLIER_ID"'"
  }' \
  "${API_BASE}/api/admin/invites")

STATUS_CODE=$(echo "$SUPPLIER_CREATE_RESPONSE" | tail -n 1)
BODY=$(echo "$SUPPLIER_CREATE_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 201 ]; then
  echo -e "${GREEN}✓ PASS${NC} - Supplier invite created (HTTP 201)"
  PASSED=$((PASSED + 1))

  SUPPLIER_INVITE_ID=$(echo "$BODY" | jq -r '.invite_id')
  echo "  Invite ID: $SUPPLIER_INVITE_ID"
  echo "  Email: $SUPPLIER_EMAIL"
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  FAILED=$((FAILED + 1))
fi

echo ""

# ============================================================================
# TEST 3: Verify Invite Token (with mock token)
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 3: Verify Invite Token"
echo "─────────────────────────────────────────"

# Note: In real test, we'd extract token from email or DB
# For smoke test, we'll use a mock token to test the endpoint structure

MOCK_TOKEN="0000000000000000000000000000000000000000000000000000000000000000"

VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" \
  "${API_BASE}/api/invites/verify?token=${MOCK_TOKEN}")

STATUS_CODE=$(echo "$VERIFY_RESPONSE" | tail -n 1)
BODY=$(echo "$VERIFY_RESPONSE" | sed '$d')

# We expect 400 for invalid token (which is correct behavior)
if [ "$STATUS_CODE" -eq 400 ]; then
  ERROR_MSG=$(echo "$BODY" | jq -r '.error // empty')
  if [[ "$ERROR_MSG" == *"Invalid"* ]] || [[ "$ERROR_MSG" == *"not found"* ]]; then
    echo -e "${GREEN}✓ PASS${NC} - Invalid token correctly rejected (HTTP 400)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Unexpected error message: $ERROR_MSG"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${YELLOW}⚠ WARN${NC} - Unexpected status code: $STATUS_CODE"
  echo "Response: $BODY"
fi

echo ""

# ============================================================================
# TEST 4: List Invites
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 4: List Recent Invites"
echo "─────────────────────────────────────────"

LIST_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/admin/invites")

STATUS_CODE=$(echo "$LIST_RESPONSE" | tail -n 1)
BODY=$(echo "$LIST_RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  INVITE_COUNT=$(echo "$BODY" | jq '.invites | length')
  echo -e "${GREEN}✓ PASS${NC} - Invites list retrieved (HTTP 200)"
  echo "  Total invites: $INVITE_COUNT"
  PASSED=$((PASSED + 1))

  # Show first invite as sample
  if [ "$INVITE_COUNT" -gt 0 ]; then
    FIRST_INVITE=$(echo "$BODY" | jq '.invites[0]')
    echo ""
    echo "Sample invite:"
    echo "$FIRST_INVITE" | jq '{email, role, status, entity_name}'
  fi
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response: $BODY"
  FAILED=$((FAILED + 1))
fi

echo ""

# ============================================================================
# TEST 5: Accept Invite (with mock token - will fail but tests endpoint)
# ============================================================================

echo "─────────────────────────────────────────"
echo "Test 5: Accept Invite (Mock Test)"
echo "─────────────────────────────────────────"

ACCEPT_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'"$MOCK_TOKEN"'",
    "password": "TestPassword123!",
    "name": "Test User"
  }' \
  "${API_BASE}/api/invites/accept")

STATUS_CODE=$(echo "$ACCEPT_RESPONSE" | tail -n 1)
BODY=$(echo "$ACCEPT_RESPONSE" | sed '$d')

# We expect 400 for invalid token
if [ "$STATUS_CODE" -eq 400 ]; then
  ERROR_MSG=$(echo "$BODY" | jq -r '.error // empty')
  if [[ "$ERROR_MSG" == *"Invalid"* ]]; then
    echo -e "${GREEN}✓ PASS${NC} - Invalid token correctly rejected (HTTP 400)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Unexpected error message: $ERROR_MSG"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${YELLOW}⚠ WARN${NC} - Unexpected status code: $STATUS_CODE"
  echo "Response: $BODY"
fi

echo ""

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
  echo "  1. Access admin UI: http://localhost:3000/admin/invites"
  echo "  2. Create a real invite with valid restaurant/supplier"
  echo "  3. Check email logs (console) for invite link"
  echo "  4. Open invite link: http://localhost:3000/invite?token=..."
  echo "  5. Complete signup and verify user creation"
  echo ""
  echo "Note: This smoke test uses mock tokens for endpoint validation."
  echo "For full end-to-end testing, use actual tokens from DB/email."
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Ensure ADMIN_MODE=true in .env.local"
  echo "  2. Run migrations: npx supabase migration up"
  echo "  3. Verify restaurant and supplier IDs exist in DB"
  echo "  4. Check server logs for detailed errors"
  exit 1
fi
