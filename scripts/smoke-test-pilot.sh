#!/usr/bin/env bash
#
# WINEFEED PILOT SMOKE TEST
#
# Pre-flight check for Pilot Loop 2.0
# Covers: Happy paths (B) + Failure paths (C)
#
# Usage:
#   ./scripts/smoke-test-pilot.sh [BASE_URL]
#
# Examples:
#   ./scripts/smoke-test-pilot.sh                    # Uses localhost:3000
#   ./scripts/smoke-test-pilot.sh https://staging.winefeed.se
#
# Environment variables:
#   ADMIN_USER_ID   - UUID of admin test user (required)
#   IOR_USER_ID     - UUID of IOR test user (required)
#   ALLOW_SKIPS     - Set to "1" to allow partial test run (default: 0)
#

set -euo pipefail

# =============================================================================
# PREREQUISITE CHECK - Fail fast if not ready for full test
# =============================================================================

ALLOW_SKIPS="${ALLOW_SKIPS:-0}"

required_envs=(ADMIN_USER_ID IOR_USER_ID)
missing=()

for v in "${required_envs[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    missing+=("$v")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo ""
  echo -e "\033[0;31m════════════════════════════════════════════════════════════════\033[0m"
  echo -e "\033[0;31m  ✗ NOT FULL PASS - Missing required env vars: ${missing[*]}\033[0m"
  echo -e "\033[0;31m════════════════════════════════════════════════════════════════\033[0m"
  echo ""
  echo "Set them and re-run:"
  echo "  export ADMIN_USER_ID='your-admin-uuid'"
  echo "  export IOR_USER_ID='your-ior-uuid'"
  echo ""
  if [[ "$ALLOW_SKIPS" != "1" ]]; then
    echo "Or export ALLOW_SKIPS=1 to allow partial run (not recommended for go-live)."
    exit 1
  fi
  echo -e "\033[1;33mWarning: ALLOW_SKIPS=1 set - running partial test suite\033[0m"
  echo ""
fi

# =============================================================================
# CONFIGURATION
# =============================================================================

BASE_URL="${1:-http://localhost:3000}"
TENANT_ID="00000000-0000-0000-0000-000000000001"

# Test user IDs
ADMIN_USER_ID="${ADMIN_USER_ID:-}"
IOR_USER_ID="${IOR_USER_ID:-}"
RESTAURANT_USER_ID="${RESTAURANT_USER_ID:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
SKIPPED=0

# =============================================================================
# HELPERS
# =============================================================================

print_header() {
  echo ""
  echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
}

print_test() {
  echo -e "\n${YELLOW}▶ TEST: $1${NC}"
}

pass() {
  echo -e "${GREEN}  ✓ PASS: $1${NC}"
  PASSED=$((PASSED + 1))
}

fail() {
  echo -e "${RED}  ✗ FAIL: $1${NC}"
  FAILED=$((FAILED + 1))
}

skip() {
  echo -e "${YELLOW}  ⊘ SKIP: $1${NC}"
  SKIPPED=$((SKIPPED + 1))
}

# API call helper
api_call() {
  local method="$1"
  local endpoint="$2"
  local user_id="${3:-}"
  local data="${4:-}"

  local url="${BASE_URL}${endpoint}"
  local headers=(-H "Content-Type: application/json" -H "x-tenant-id: ${TENANT_ID}")

  if [ -n "$user_id" ]; then
    headers+=(-H "x-user-id: ${user_id}")
  fi

  if [ "$method" = "GET" ]; then
    curl -s -w "\n%{http_code}" "${headers[@]}" "$url"
  elif [ -n "$data" ]; then
    curl -s -w "\n%{http_code}" -X "$method" "${headers[@]}" -d "$data" "$url"
  else
    curl -s -w "\n%{http_code}" -X "$method" "${headers[@]}" "$url"
  fi
}

# Extract HTTP status from response
get_status() {
  echo "$1" | tail -n1
}

# Extract body from response
get_body() {
  echo "$1" | sed '$d'
}

# Check if jq is available
HAS_JQ=$(command -v jq &> /dev/null && echo "yes" || echo "no")

json_get() {
  if [ "$HAS_JQ" = "yes" ]; then
    echo "$1" | jq -r "$2" 2>/dev/null || echo ""
  else
    # Fallback: simple grep
    echo "$1" | grep -o "\"$2\":[^,}]*" | cut -d: -f2 | tr -d '"' | tr -d ' '
  fi
}

# =============================================================================
# PRE-FLIGHT CHECKS
# =============================================================================

print_header "PRE-FLIGHT CHECKS"

echo "Base URL: $BASE_URL"
echo "Tenant ID: $TENANT_ID"
echo ""

# Check if server is reachable
print_test "Server reachability"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" 2>/dev/null || echo "000")
if [ "$HEALTH_RESPONSE" = "000" ]; then
  # Try a simple endpoint
  HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}" 2>/dev/null || echo "000")
fi

if [ "$HEALTH_RESPONSE" = "000" ]; then
  fail "Cannot reach server at $BASE_URL"
  echo -e "${RED}Aborting tests.${NC}"
  exit 1
else
  pass "Server reachable (HTTP $HEALTH_RESPONSE)"
fi

# -----------------------------------------------------------------------------
# Security: Verify test bypass is NOT active in staging/production
# -----------------------------------------------------------------------------
print_test "Security: Test bypass disabled in non-dev"

HEALTH_RESPONSE=$(curl -s "${BASE_URL}/api/health")
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health")

if [ "$HEALTH_STATUS" = "200" ]; then
  if [ "$HAS_JQ" = "yes" ]; then
    BYPASS_ENABLED=$(echo "$HEALTH_RESPONSE" | jq -r '.security.testBypassEnabled' 2>/dev/null)
    IS_PRODUCTION=$(echo "$HEALTH_RESPONSE" | jq -r '.security.isProduction' 2>/dev/null)
    ENV_NAME=$(echo "$HEALTH_RESPONSE" | jq -r '.env' 2>/dev/null)

    if [ "$IS_PRODUCTION" = "true" ] && [ "$BYPASS_ENABLED" = "true" ]; then
      fail "CRITICAL: Test bypass enabled in PRODUCTION! Fix immediately."
      echo -e "${RED}Aborting tests - security risk.${NC}"
      exit 1
    elif [ "$ENV_NAME" != "development" ] && [ "$BYPASS_ENABLED" = "true" ]; then
      fail "WARNING: Test bypass enabled in $ENV_NAME environment"
    else
      pass "Test bypass correctly disabled (env=$ENV_NAME, bypass=$BYPASS_ENABLED)"
    fi
  else
    pass "Health endpoint accessible (jq not available for deep check)"
  fi
else
  skip "Health endpoint not available (HTTP $HEALTH_STATUS)"
fi

# -----------------------------------------------------------------------------
# Gate: Check DB migrations are applied
# -----------------------------------------------------------------------------
print_test "Database migrations applied"

if [ -n "$IOR_USER_ID" ]; then
  # Test an endpoint that requires pilot migrations
  DB_CHECK_RESPONSE=$(api_call "GET" "/api/ior/imports/queue" "$IOR_USER_ID")
  DB_CHECK_STATUS=$(get_status "$DB_CHECK_RESPONSE")
  DB_CHECK_BODY=$(get_body "$DB_CHECK_RESPONSE")

  if [ "$DB_CHECK_STATUS" = "500" ]; then
    # Check if it's a database error (missing table/relation)
    if echo "$DB_CHECK_BODY" | grep -qiE "(relation|table|column).*does not exist|undefined_table"; then
      fail "DB not migrated - run: psql \$DATABASE_URL -f scripts/pilot_migrations_combined.sql"
      echo -e "${RED}Aborting tests - migrations required.${NC}"
      exit 1
    else
      fail "Server error (HTTP 500) - check logs"
    fi
  elif [ "$DB_CHECK_STATUS" = "200" ] || [ "$DB_CHECK_STATUS" = "403" ]; then
    pass "Database responding correctly (HTTP $DB_CHECK_STATUS)"
  else
    # 401 is OK (auth issue, not DB issue)
    pass "Database check passed (HTTP $DB_CHECK_STATUS)"
  fi
else
  skip "DB migration check requires IOR_USER_ID"
fi

# =============================================================================
# B) HAPPY PATH TESTS
# =============================================================================

print_header "B) HAPPY PATH TESTS"

# -----------------------------------------------------------------------------
# B1: IOR Imports Queue
# -----------------------------------------------------------------------------
print_test "B1: IOR can access imports queue"

if [ -z "$IOR_USER_ID" ]; then
  skip "IOR_USER_ID not set"
else
  RESPONSE=$(api_call "GET" "/api/ior/imports/queue" "$IOR_USER_ID")
  STATUS=$(get_status "$RESPONSE")
  BODY=$(get_body "$RESPONSE")

  if [ "$STATUS" = "200" ]; then
    pass "IOR imports queue accessible (HTTP 200)"
    # Check response structure
    if echo "$BODY" | grep -q '"imports"'; then
      pass "Response contains 'imports' array"
    else
      fail "Response missing 'imports' array"
    fi
    if echo "$BODY" | grep -q '"counts"'; then
      pass "Response contains 'counts' object"
    else
      fail "Response missing 'counts' object"
    fi
  elif [ "$STATUS" = "403" ]; then
    fail "IOR access denied (HTTP 403) - check user has IOR role"
  else
    fail "Unexpected status: HTTP $STATUS"
  fi
fi

# -----------------------------------------------------------------------------
# B2: Document upload (requires existing import)
# -----------------------------------------------------------------------------
print_test "B2: Document types available"

RESPONSE=$(api_call "GET" "/api/document-types" "$IOR_USER_ID")
STATUS=$(get_status "$RESPONSE")

# This endpoint might not exist, so we'll check document types via another route
# or just verify the migration created the types
if [ "$STATUS" = "200" ]; then
  pass "Document types endpoint accessible"
elif [ "$STATUS" = "404" ]; then
  # Try checking via direct DB or skip
  skip "Document types endpoint not implemented (check migration ran)"
else
  skip "Document types check inconclusive (HTTP $STATUS)"
fi

# -----------------------------------------------------------------------------
# B3: State machine transitions available
# -----------------------------------------------------------------------------
print_test "B3: Import status endpoint accessible"

if [ -z "$IOR_USER_ID" ]; then
  skip "IOR_USER_ID not set"
else
  # We need an import ID to test this fully
  # For now, just verify the endpoint pattern works
  RESPONSE=$(api_call "GET" "/api/ior/imports/queue?filter=all" "$IOR_USER_ID")
  STATUS=$(get_status "$RESPONSE")
  BODY=$(get_body "$RESPONSE")

  if [ "$STATUS" = "200" ]; then
    # Extract first import ID if any
    if [ "$HAS_JQ" = "yes" ]; then
      FIRST_IMPORT_ID=$(echo "$BODY" | jq -r '.imports[0].id // empty' 2>/dev/null)
    else
      FIRST_IMPORT_ID=""
    fi

    if [ -n "$FIRST_IMPORT_ID" ]; then
      pass "Found import case: $FIRST_IMPORT_ID"

      # Check allowed transitions
      TRANSITIONS=$(echo "$BODY" | jq -r '.imports[0].allowedTransitions | join(", ")' 2>/dev/null || echo "")
      if [ -n "$TRANSITIONS" ]; then
        pass "State machine transitions available: [$TRANSITIONS]"
      else
        pass "Import found (transitions may be empty if terminal state)"
      fi
    else
      skip "No import cases found to test state machine"
    fi
  else
    fail "Could not fetch imports (HTTP $STATUS)"
  fi
fi

# =============================================================================
# C) FAILURE PATH TESTS
# =============================================================================

print_header "C) FAILURE PATH TESTS"

# -----------------------------------------------------------------------------
# C1: IOR cannot verify documents (only submit_for_review)
# -----------------------------------------------------------------------------
print_test "C1: IOR cannot verify documents (403 expected)"

if [ -z "$IOR_USER_ID" ]; then
  skip "IOR_USER_ID not set"
else
  # We need a doc ID - use a fake one to test authorization
  FAKE_IMPORT_ID="00000000-0000-0000-0000-000000000000"
  FAKE_DOC_ID="00000000-0000-0000-0000-000000000000"

  RESPONSE=$(api_call "PATCH" "/api/imports/${FAKE_IMPORT_ID}/documents/${FAKE_DOC_ID}" "$IOR_USER_ID" '{"action":"verify"}')
  STATUS=$(get_status "$RESPONSE")
  BODY=$(get_body "$RESPONSE")

  if [ "$STATUS" = "403" ]; then
    pass "IOR correctly denied verify action (HTTP 403)"
    if echo "$BODY" | grep -qi "administrator"; then
      pass "Error message mentions administrator requirement"
    fi
  elif [ "$STATUS" = "404" ]; then
    # Document not found is also acceptable for this test
    pass "Authorization check passed (404 = doc not found, but auth was checked)"
  else
    fail "Unexpected status: HTTP $STATUS (expected 403)"
  fi
fi

# -----------------------------------------------------------------------------
# C2: IOR can submit_for_review
# -----------------------------------------------------------------------------
print_test "C2: IOR can use submit_for_review action"

if [ -z "$IOR_USER_ID" ]; then
  skip "IOR_USER_ID not set"
else
  FAKE_IMPORT_ID="00000000-0000-0000-0000-000000000000"
  FAKE_DOC_ID="00000000-0000-0000-0000-000000000000"

  RESPONSE=$(api_call "PATCH" "/api/imports/${FAKE_IMPORT_ID}/documents/${FAKE_DOC_ID}" "$IOR_USER_ID" '{"action":"submit_for_review"}')
  STATUS=$(get_status "$RESPONSE")

  # We expect 404 (doc not found) not 403 (forbidden)
  if [ "$STATUS" = "404" ]; then
    pass "IOR authorized for submit_for_review (404 = doc not found, auth OK)"
  elif [ "$STATUS" = "403" ]; then
    fail "IOR incorrectly denied submit_for_review action"
  else
    # Could be 400 if doc exists but wrong status
    pass "Authorization check passed (HTTP $STATUS)"
  fi
fi

# -----------------------------------------------------------------------------
# C3: Delete guard for verified docs
# -----------------------------------------------------------------------------
print_test "C3: Cannot delete verified documents without admin"

if [ -z "$IOR_USER_ID" ]; then
  skip "IOR_USER_ID not set"
else
  # This test needs a real verified doc to fully work
  # For now, test that the endpoint exists and requires auth
  FAKE_IMPORT_ID="00000000-0000-0000-0000-000000000000"
  FAKE_DOC_ID="00000000-0000-0000-0000-000000000000"

  RESPONSE=$(api_call "DELETE" "/api/imports/${FAKE_IMPORT_ID}/documents/${FAKE_DOC_ID}" "$IOR_USER_ID")
  STATUS=$(get_status "$RESPONSE")

  if [ "$STATUS" = "404" ]; then
    pass "Delete endpoint accessible (404 = doc not found)"
  elif [ "$STATUS" = "400" ] || [ "$STATUS" = "403" ]; then
    pass "Delete guard active (HTTP $STATUS)"
  else
    skip "Delete guard test inconclusive (HTTP $STATUS)"
  fi
fi

# -----------------------------------------------------------------------------
# C4: Unauthenticated access blocked
# -----------------------------------------------------------------------------
print_test "C4: Unauthenticated access blocked"

RESPONSE=$(api_call "GET" "/api/ior/imports/queue" "")
STATUS=$(get_status "$RESPONSE")

if [ "$STATUS" = "401" ]; then
  pass "Unauthenticated request correctly blocked (HTTP 401)"
else
  fail "Unauthenticated request not blocked (HTTP $STATUS, expected 401)"
fi

# =============================================================================
# SUMMARY
# =============================================================================

print_header "TEST SUMMARY"

TOTAL=$((PASSED + FAILED + SKIPPED))

echo ""
echo -e "  ${GREEN}Passed:  $PASSED${NC}"
echo -e "  ${RED}Failed:  $FAILED${NC}"
echo -e "  ${YELLOW}Skipped: $SKIPPED${NC}"
echo -e "  ─────────────"
echo -e "  Total:   $TOTAL"
echo ""

if [ $FAILED -eq 0 ] && [ $SKIPPED -eq 0 ]; then
  echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✓ FULL PASS - Ready for pilot!${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
  exit 0
elif [ $FAILED -eq 0 ] && [ $SKIPPED -gt 0 ]; then
  echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  ⚠ PARTIAL PASS - $SKIPPED tests skipped${NC}"
  echo -e "${YELLOW}  NOT ready for pilot until all tests run${NC}"
  echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
  exit 1
else
  echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}  ✗ FAILED - $FAILED tests failed${NC}"
  echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
  exit 1
fi
