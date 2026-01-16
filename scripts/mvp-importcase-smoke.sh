#!/bin/bash
# MVP Importcase Smoke Test (Enhanced)
# Tests:
#   - Create import case
#   - Validate shipment (FAIL before approval)
#   - Status transitions (NOT_REGISTERED -> SUBMITTED -> APPROVED)
#   - Validate shipment (PASS after approval)
#   - Generate 5369 document
#   - List documents
#   - Invalid transitions
#   - Attach supplier import (optional)

set -e

API_BASE="http://localhost:3000/api"
TENANT_ID="00000000-0000-0000-0000-000000000001"
USER_ID="00000000-0000-0000-0000-000000000001"

echo "════════════════════════════════════════"
echo "MVP Importcase Smoke Test"
echo "════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Helper function
test_api() {
  local test_name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expected_status="$5"

  echo "Testing: $test_name"

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "x-user-id: $USER_ID" \
      "$url")
  else
    response=$(curl -s -w "\n%{http_code}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "x-user-id: $USER_ID" \
      -d "$data" \
      "$url")
  fi

  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status: $status_code"
    PASSED=$((PASSED + 1))
    echo "$body"
  else
    echo -e "${RED}✗ FAIL${NC} - Expected: $expected_status, Got: $status_code"
    FAILED=$((FAILED + 1))
    echo "$body"
  fi

  echo ""
}

# Check if test IDs are provided
if [ "$#" -lt 3 ]; then
  echo -e "${YELLOW}⚠ WARNING${NC}: Test requires 3 arguments:"
  echo "  1. restaurant_id"
  echo "  2. importer_id"
  echo "  3. delivery_location_id"
  echo ""
  echo "Usage: bash scripts/mvp-importcase-smoke.sh <restaurant_id> <importer_id> <delivery_location_id>"
  echo ""
  echo "Example:"
  echo "  bash scripts/mvp-importcase-smoke.sh \\"
  echo "    '11111111-1111-1111-1111-111111111111' \\"
  echo "    '22222222-2222-2222-2222-222222222222' \\"
  echo "    '33333333-3333-3333-3333-333333333333'"
  echo ""
  exit 1
fi

RESTAURANT_ID="$1"
IMPORTER_ID="$2"
DDL_ID="$3"

echo "Test parameters:"
echo "  Restaurant ID: $RESTAURANT_ID"
echo "  Importer ID:   $IMPORTER_ID"
echo "  DDL ID:        $DDL_ID"
echo ""

# Test 1: Create import case
echo "Test 1: Create Import Case"
CREATE_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-user-id: $USER_ID" \
  -d "{
    \"restaurant_id\": \"$RESTAURANT_ID\",
    \"importer_id\": \"$IMPORTER_ID\",
    \"delivery_location_id\": \"$DDL_ID\"
  }" \
  "$API_BASE/imports")

IMPORT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

if [ -z "$IMPORT_ID" ]; then
  echo -e "${RED}✗ FAIL${NC} - Failed to create import case"
  echo "$CREATE_RESPONSE"
  exit 1
else
  echo -e "${GREEN}✓ PASS${NC} - Import case created: $IMPORT_ID"
  PASSED=$((PASSED + 1))
fi
echo ""

# Test 2: Get import case
test_api "Get Import Case" "GET" "$API_BASE/imports/$IMPORT_ID" "" "200"

# Test 3: Validate shipment FAIL (import not approved yet)
echo "Test 3: Validate Shipment FAIL (import not approved)"
response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-user-id: $USER_ID" \
  "$API_BASE/imports/$IMPORT_ID/validate-shipment")

status_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$status_code" = "200" ]; then
  # Check if valid=false
  valid=$(echo "$body" | jq -r '.valid // empty')
  error_code=$(echo "$body" | jq -r '.error_code // empty')

  if [ "$valid" = "false" ] && [ -n "$error_code" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Validation correctly failed with error_code: $error_code"
    PASSED=$((PASSED + 1))
    echo "$body"
  else
    echo -e "${RED}✗ FAIL${NC} - Expected valid=false with error_code, got: $body"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - Expected 200, got $status_code"
  FAILED=$((FAILED + 1))
  echo "$body"
fi
echo ""

# Test 4: Update status to SUBMITTED
test_api "Update Status to SUBMITTED" "POST" "$API_BASE/imports/$IMPORT_ID/status" \
  '{"to_status": "SUBMITTED", "why": "Smoke test submission"}' "200"

# Test 5: Update status to APPROVED
test_api "Update Status to APPROVED" "POST" "$API_BASE/imports/$IMPORT_ID/status" \
  '{"to_status": "APPROVED", "why": "Smoke test approval"}' "200"

# Test 6: Validate shipment PASS (after approval)
echo "Test 6: Validate Shipment PASS (after approval)"
response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-user-id: $USER_ID" \
  "$API_BASE/imports/$IMPORT_ID/validate-shipment")

status_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$status_code" = "200" ]; then
  # Check if valid=true
  valid=$(echo "$body" | jq -r '.valid // empty')

  if [ "$valid" = "true" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Validation passed (valid=true)"
    PASSED=$((PASSED + 1))
    echo "$body"
  else
    echo -e "${RED}✗ FAIL${NC} - Expected valid=true, got: $body"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - Expected 200, got $status_code"
  FAILED=$((FAILED + 1))
  echo "$body"
fi
echo ""

# Test 7: Generate 5369 document
echo "Test 7: Generate 5369 Document"
response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-user-id: $USER_ID" \
  "$API_BASE/imports/$IMPORT_ID/documents/5369")

status_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

DOCUMENT_ID=""

if [ "$status_code" = "200" ]; then
  document_id=$(echo "$body" | jq -r '.document_id // empty')
  version=$(echo "$body" | jq -r '.version // empty')
  storage_path=$(echo "$body" | jq -r '.storage_path // empty')
  sha256=$(echo "$body" | jq -r '.sha256 // empty')

  if [ -n "$document_id" ] && [ -n "$version" ] && [ -n "$storage_path" ] && [ -n "$sha256" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Document generated successfully"
    echo "  Document ID: $document_id"
    echo "  Version: $version"
    echo "  Storage Path: $storage_path"
    echo "  SHA-256: ${sha256:0:16}..."
    PASSED=$((PASSED + 1))
    DOCUMENT_ID="$document_id"
  else
    echo -e "${RED}✗ FAIL${NC} - Missing required fields in response"
    FAILED=$((FAILED + 1))
    echo "$body"
  fi
else
  echo -e "${RED}✗ FAIL${NC} - Expected 200, got $status_code"
  FAILED=$((FAILED + 1))
  echo "$body"
fi
echo ""

# Test 7b: Get signed URL for download
if [ -n "$DOCUMENT_ID" ]; then
  echo "Test 7b: Get Signed Download URL"
  response=$(curl -s -w "\n%{http_code}" \
    -H "x-tenant-id: $TENANT_ID" \
    "$API_BASE/imports/$IMPORT_ID/documents/$DOCUMENT_ID/download")

  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" = "200" ]; then
    signed_url=$(echo "$body" | jq -r '.url // empty')
    expires_in=$(echo "$body" | jq -r '.expires_in // empty')

    if [ -n "$signed_url" ] && [ -n "$expires_in" ]; then
      # Check if URL looks valid (starts with http)
      if [[ "$signed_url" == http* ]]; then
        echo -e "${GREEN}✓ PASS${NC} - Signed URL generated successfully"
        echo "  Expires in: ${expires_in}s"
        echo "  URL prefix: ${signed_url:0:50}..."
        PASSED=$((PASSED + 1))
      else
        echo -e "${RED}✗ FAIL${NC} - URL doesn't look valid"
        FAILED=$((FAILED + 1))
        echo "  URL: $signed_url"
      fi
    else
      echo -e "${RED}✗ FAIL${NC} - Missing url or expires_in in response"
      FAILED=$((FAILED + 1))
      echo "$body"
    fi
  else
    echo -e "${RED}✗ FAIL${NC} - Expected 200, got $status_code"
    FAILED=$((FAILED + 1))
    echo "$body"
  fi
  echo ""
else
  echo -e "${YELLOW}⚠ SKIPPED${NC} - Test 7b: Get Signed Download URL (no document_id from previous test)"
  echo ""
fi

# Test 8: List documents
test_api "List Documents" "GET" "$API_BASE/imports/$IMPORT_ID/documents" "" "200"

# Test 9: Try invalid transition (should fail)
echo "Test 9: Invalid Transition (APPROVED -> SUBMITTED)"
response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "x-user-id: $USER_ID" \
  -d '{"to_status": "SUBMITTED"}' \
  "$API_BASE/imports/$IMPORT_ID/status")

status_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | sed '$d')

if [ "$status_code" = "409" ]; then
  echo -e "${GREEN}✓ PASS${NC} - Invalid transition correctly blocked (409)"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - Expected 409, got $status_code"
  FAILED=$((FAILED + 1))
fi
echo "$body"
echo ""

# Test 10: Attach supplier import (optional - if supplier_import_id provided)
if [ "$#" -ge 4 ]; then
  SUPPLIER_IMPORT_ID="$4"
  test_api "Attach Supplier Import" "POST" "$API_BASE/imports/$IMPORT_ID/attach-supplier-import" \
    "{\"supplier_import_id\": \"$SUPPLIER_IMPORT_ID\"}" "200"
else
  echo -e "${YELLOW}⚠ SKIPPED${NC} - Test 10: Attach Supplier Import (no supplier_import_id provided)"
  echo ""
fi

# Test 11: List linked supplier imports
test_api "List Linked Supplier Imports" "GET" "$API_BASE/imports/$IMPORT_ID/supplier-imports" "" "200"

# Summary
echo "════════════════════════════════════════"
echo "Test Summary"
echo "════════════════════════════════════════"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""
echo "Import ID: $IMPORT_ID"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
fi
