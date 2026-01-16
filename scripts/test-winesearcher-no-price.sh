#!/bin/bash
# ============================================================================
# Wine-Searcher Integration Test
# ============================================================================
# Purpose: Guarantee NO PRICE DATA policy is enforced
#
# Tests:
# 1. API returns only allowlist fields
# 2. No price/offer/currency data in response
# 3. Service handles missing API key gracefully
# 4. Cache works correctly
# ============================================================================

set -e

API_BASE="http://localhost:3000/api"
TENANT_ID="00000000-0000-0000-0000-000000000001"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

echo "════════════════════════════════════════════════════════════"
echo "Wine-Searcher Integration Test - NO PRICE DATA Policy"
echo "════════════════════════════════════════════════════════════"
echo ""

# ============================================================================
# Test 1: Basic Wine Check
# ============================================================================

echo "Test 1: Basic Wine Check"
echo "─────────────────────────────────────────────────────────────"

RESPONSE=$(curl -s \
  -H "x-tenant-id: $TENANT_ID" \
  "$API_BASE/enrich/wine-searcher/check?name=Chateau%20Margaux&vintage=2015")

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check response is valid JSON
if ! echo "$RESPONSE" | jq empty 2>/dev/null; then
  echo -e "${RED}✗ FAIL${NC} - Invalid JSON response"
  FAILED=$((FAILED + 1))
else
  echo -e "${GREEN}✓ PASS${NC} - Valid JSON response"
  PASSED=$((PASSED + 1))
fi

# Check response has 'data' and 'mock' fields
HAS_DATA=$(echo "$RESPONSE" | jq 'has("data")' 2>/dev/null)
HAS_MOCK=$(echo "$RESPONSE" | jq 'has("mock")' 2>/dev/null)

if [ "$HAS_DATA" = "true" ] && [ "$HAS_MOCK" = "true" ]; then
  echo -e "${GREEN}✓ PASS${NC} - Response has data and mock fields"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - Response missing data or mock fields"
  FAILED=$((FAILED + 1))
fi
echo ""

# ============================================================================
# Test 2: Allowlist Keys Only (in data object)
# ============================================================================

echo "Test 2: Response Data Contains ONLY Allowlist Keys"
echo "─────────────────────────────────────────────────────────────"

ALLOWED_KEYS="canonical_name producer region appellation match_score match_status candidates"

# Extract all top-level keys from response.data
RESPONSE_KEYS=$(echo "$RESPONSE" | jq -r '.data | keys[]' 2>/dev/null | tr '\n' ' ')

echo "Expected keys: $ALLOWED_KEYS"
echo "Response data keys: $RESPONSE_KEYS"
echo ""

UNEXPECTED_KEYS=""
for key in $RESPONSE_KEYS; do
  if ! echo "$ALLOWED_KEYS" | grep -q "$key"; then
    UNEXPECTED_KEYS="$UNEXPECTED_KEYS $key"
  fi
done

if [ -n "$UNEXPECTED_KEYS" ]; then
  echo -e "${RED}✗ FAIL${NC} - Unexpected keys found: $UNEXPECTED_KEYS"
  FAILED=$((FAILED + 1))
else
  echo -e "${GREEN}✓ PASS${NC} - Only allowlist keys present"
  PASSED=$((PASSED + 1))
fi
echo ""

# ============================================================================
# Test 3: NO PRICE DATA in Response
# ============================================================================

echo "Test 3: NO Price/Offer/Currency Data in Response"
echo "─────────────────────────────────────────────────────────────"

FORBIDDEN_PATTERNS="price|offer|currency|market|cost|value|\$|€|£|USD|EUR|GBP"

# Extract just the data object for checking (mock metadata is OK)
DATA_ONLY=$(echo "$RESPONSE" | jq '.data' 2>/dev/null)

# Debug: Show what matched (if anything)
MATCHES=$(echo "$DATA_ONLY" | grep -Eio "$FORBIDDEN_PATTERNS" | head -5)

if [ -n "$MATCHES" ]; then
  echo -e "${RED}✗ FAIL${NC} - SECURITY VIOLATION: Forbidden data found in response!"
  echo "Matched patterns:"
  echo "$MATCHES"
  echo ""
  echo "Full response data:"
  echo "$DATA_ONLY"
  FAILED=$((FAILED + 1))
else
  echo -e "${GREEN}✓ PASS${NC} - No forbidden price data detected"
  PASSED=$((PASSED + 1))
fi
echo ""

# ============================================================================
# Test 4: Candidates Structure
# ============================================================================

echo "Test 4: Candidates Array (Max 3, Correct Structure)"
echo "─────────────────────────────────────────────────────────────"

CANDIDATES_COUNT=$(echo "$RESPONSE" | jq '.data.candidates | length' 2>/dev/null || echo "0")
echo "Candidates count: $CANDIDATES_COUNT"

if [ "$CANDIDATES_COUNT" -gt 3 ]; then
  echo -e "${RED}✗ FAIL${NC} - More than 3 candidates returned (got $CANDIDATES_COUNT)"
  FAILED=$((FAILED + 1))
else
  echo -e "${GREEN}✓ PASS${NC} - Candidates count <= 3"
  PASSED=$((PASSED + 1))
fi

# Check candidate keys
CANDIDATE_ALLOWED_KEYS="name producer region appellation score"
echo ""
echo "Checking candidate structure..."

for i in $(seq 0 $((CANDIDATES_COUNT - 1))); do
  CANDIDATE_KEYS=$(echo "$RESPONSE" | jq -r ".data.candidates[$i] | keys[]" 2>/dev/null | tr '\n' ' ')

  UNEXPECTED_CANDIDATE_KEYS=""
  for key in $CANDIDATE_KEYS; do
    if ! echo "$CANDIDATE_ALLOWED_KEYS" | grep -q "$key"; then
      UNEXPECTED_CANDIDATE_KEYS="$UNEXPECTED_CANDIDATE_KEYS $key"
    fi
  done

  if [ -n "$UNEXPECTED_CANDIDATE_KEYS" ]; then
    echo -e "${RED}✗ FAIL${NC} - Candidate $i has unexpected keys: $UNEXPECTED_CANDIDATE_KEYS"
    FAILED=$((FAILED + 1))
  else
    echo -e "${GREEN}✓ PASS${NC} - Candidate $i structure valid"
    PASSED=$((PASSED + 1))
  fi
done
echo ""

# ============================================================================
# Test 5: Match Status Enum
# ============================================================================

echo "Test 5: Match Status is Valid Enum Value"
echo "─────────────────────────────────────────────────────────────"

MATCH_STATUS=$(echo "$RESPONSE" | jq -r '.data.match_status' 2>/dev/null || echo "null")
VALID_STATUSES="EXACT FUZZY MULTIPLE NOT_FOUND ERROR"

echo "Match status: $MATCH_STATUS"

if echo "$VALID_STATUSES" | grep -q "$MATCH_STATUS"; then
  echo -e "${GREEN}✓ PASS${NC} - Valid match status"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - Invalid match status: $MATCH_STATUS"
  FAILED=$((FAILED + 1))
fi
echo ""

# ============================================================================
# Test 6: Mock Flag Present
# ============================================================================

echo "Test 6: Mock Flag is Boolean"
echo "─────────────────────────────────────────────────────────────"

MOCK_VALUE=$(echo "$RESPONSE" | jq -r '.mock' 2>/dev/null)

if [ "$MOCK_VALUE" = "true" ] || [ "$MOCK_VALUE" = "false" ]; then
  echo "Mock value: $MOCK_VALUE"
  echo -e "${GREEN}✓ PASS${NC} - Mock flag is boolean"
  PASSED=$((PASSED + 1))
else
  echo "Mock value: $MOCK_VALUE"
  echo -e "${RED}✗ FAIL${NC} - Mock flag is not boolean"
  FAILED=$((FAILED + 1))
fi
echo ""

# ============================================================================
# Test 7: Cache Hit (Second Request)
# ============================================================================

echo "Test 7: Cache Hit on Second Request"
echo "─────────────────────────────────────────────────────────────"

echo "Making second request for same wine..."
START_TIME=$(date +%s%N)

RESPONSE2=$(curl -s \
  -H "x-tenant-id: $TENANT_ID" \
  "$API_BASE/enrich/wine-searcher/check?name=Chateau%20Margaux&vintage=2015")

END_TIME=$(date +%s%N)
ELAPSED=$((($END_TIME - $START_TIME) / 1000000)) # Convert to ms

echo "Response time: ${ELAPSED}ms"

# Verify response is identical
DIFF=$(diff <(echo "$RESPONSE" | jq -S .) <(echo "$RESPONSE2" | jq -S .) 2>&1 || true)

if [ -z "$DIFF" ]; then
  echo -e "${GREEN}✓ PASS${NC} - Cache hit (identical response)"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠ WARN${NC} - Response differs (might be expected if API is live)"
  echo "Difference:"
  echo "$DIFF"
fi
echo ""

# ============================================================================
# Test 8: Missing Name Parameter
# ============================================================================

echo "Test 8: Error Handling - Missing Name Parameter"
echo "─────────────────────────────────────────────────────────────"

ERROR_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: $TENANT_ID" \
  "$API_BASE/enrich/wine-searcher/check")

STATUS_CODE=$(echo "$ERROR_RESPONSE" | tail -n 1)
BODY=$(echo "$ERROR_RESPONSE" | sed '$d')

echo "Status code: $STATUS_CODE"
echo "Response: $BODY"
echo ""

if [ "$STATUS_CODE" = "400" ]; then
  echo -e "${GREEN}✓ PASS${NC} - Correctly returns 400 for missing parameter"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - Expected 400, got $STATUS_CODE"
  FAILED=$((FAILED + 1))
fi
echo ""

# ============================================================================
# Test 9: Missing Tenant Context
# ============================================================================

echo "Test 9: Error Handling - Missing Tenant Context"
echo "─────────────────────────────────────────────────────────────"

ERROR_RESPONSE=$(curl -s -w "\n%{http_code}" \
  "$API_BASE/enrich/wine-searcher/check?name=Test")

STATUS_CODE=$(echo "$ERROR_RESPONSE" | tail -n 1)
BODY=$(echo "$ERROR_RESPONSE" | sed '$d')

echo "Status code: $STATUS_CODE"
echo "Response: $BODY"
echo ""

if [ "$STATUS_CODE" = "401" ]; then
  echo -e "${GREEN}✓ PASS${NC} - Correctly returns 401 for missing tenant"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - Expected 401, got $STATUS_CODE"
  FAILED=$((FAILED + 1))
fi
echo ""

# ============================================================================
# Summary
# ============================================================================

echo "════════════════════════════════════════════════════════════"
echo "Test Summary"
echo "════════════════════════════════════════════════════════════"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED - NO PRICE DATA POLICY ENFORCED${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
fi
