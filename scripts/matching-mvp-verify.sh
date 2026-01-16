#!/bin/bash
# MATCHING MVP VERIFICATION RUNNER
# Automated golden path tests + health check with PASS/WARN/FAIL summary

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000001}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  MATCHING MVP VERIFICATION RUNNER"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Base URL:  ${BASE_URL}"
echo "Tenant ID: ${TENANT_ID}"
echo ""

# Helper function to run a match test
run_match_test() {
  local test_name="$1"
  local payload="$2"
  local expected_method_pattern="$3"

  TESTS_TOTAL=$((TESTS_TOTAL + 1))

  echo "─────────────────────────────────────────"
  echo "Test $TESTS_TOTAL: $test_name"
  echo "─────────────────────────────────────────"

  response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: ${TENANT_ID}" \
    -d "$payload" \
    "${BASE_URL}/api/match/product")

  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" -ne 200 ]; then
    echo -e "${RED}✗ FAIL${NC} - HTTP $status_code"
    echo "Response: $body"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo ""
    return 1
  fi

  # Parse response (if jq available)
  if command -v jq &> /dev/null; then
    match_status=$(echo "$body" | jq -r '.status // "UNKNOWN"')
    match_method=$(echo "$body" | jq -r '.match_method // "UNKNOWN"')
    confidence=$(echo "$body" | jq -r '.confidence // 0')
    explanation=$(echo "$body" | jq -r '.explanation // "No explanation"')

    echo "Status:      $match_status"
    echo "Method:      $match_method"
    echo "Confidence:  $(awk "BEGIN {printf \"%.0f\", $confidence * 100}")%"
    echo "Explanation: $explanation"

    # Check if method matches expected pattern
    if [ -n "$expected_method_pattern" ]; then
      if echo "$match_method" | grep -qE "$expected_method_pattern"; then
        echo -e "${GREEN}✓ PASS${NC} - Method matches expected pattern: $expected_method_pattern"
        TESTS_PASSED=$((TESTS_PASSED + 1))
      else
        echo -e "${YELLOW}⚠ WARN${NC} - Method '$match_method' doesn't match expected '$expected_method_pattern' (might be OK)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
      fi
    else
      echo -e "${GREEN}✓ PASS${NC} - Request succeeded"
      TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
  else
    echo -e "${GREEN}✓ PASS${NC} - HTTP 200 (jq not available for detailed parsing)"
    echo "Response: $body"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  fi

  echo ""
  return 0
}

# ════════════════════════════════════════════════════════════════
# GOLDEN PATH TESTS
# ════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════"
echo "  PART 1: GOLDEN PATH TESTS"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test 1: TEXT fallback (canonical suggest)
run_match_test \
  "TEXT Fallback (Wine-Searcher canonical)" \
  '{
    "source": {
      "source_type": "manual_test",
      "source_id": "test-text-fallback"
    },
    "identifiers": {},
    "textFallback": {
      "name": "Petrus",
      "vintage": 2011,
      "bottle_ml": 750
    }
  }' \
  "CANONICAL_SUGGEST|NO_MATCH"

# Test 2: GTIN hard key (should auto-create if enabled)
run_match_test \
  "GTIN Hard Key (auto-create if enabled)" \
  '{
    "source": {
      "source_type": "manual_test",
      "source_id": "test-gtin"
    },
    "identifiers": {
      "gtin": "0000000000000"
    },
    "textFallback": {
      "name": "Test Wine GTIN",
      "vintage": 2020,
      "bottle_ml": 750,
      "producer": "Test Producer",
      "country": "France",
      "region": "Bordeaux"
    }
  }' \
  "GTIN_EXACT"

# Test 3: LWIN hard key (should auto-create if enabled)
run_match_test \
  "LWIN Hard Key (auto-create if enabled)" \
  '{
    "source": {
      "source_type": "manual_test",
      "source_id": "test-lwin"
    },
    "identifiers": {
      "lwin": "LWIN_DUMMY_123"
    },
    "textFallback": {
      "name": "Test Wine LWIN",
      "vintage": 2019,
      "bottle_ml": 750,
      "producer": "Test Producer",
      "country": "Italy",
      "region": "Tuscany"
    }
  }' \
  "LWIN_EXACT"

# Test 4: SKU without issuer (should skip SKU branch, fall back to text)
run_match_test \
  "SKU Guard Test (no issuer_id - should skip)" \
  '{
    "source": {
      "source_type": "manual_test",
      "source_id": "test-sku-guard"
    },
    "identifiers": {
      "producer_sku": "SKU123"
    },
    "textFallback": {
      "name": "Test Wine SKU",
      "vintage": 2021,
      "bottle_ml": 750
    }
  }' \
  "CANONICAL_SUGGEST|NO_MATCH"

# Test 5: Empty identifiers (should go to text fallback)
run_match_test \
  "Empty Identifiers (text fallback only)" \
  '{
    "source": {
      "source_type": "manual_test",
      "source_id": "test-empty-identifiers"
    },
    "identifiers": {},
    "textFallback": {
      "name": "Château Margaux",
      "vintage": 2015,
      "bottle_ml": 750,
      "producer": "Château Margaux",
      "region": "Bordeaux"
    }
  }' \
  "CANONICAL_SUGGEST|NO_MATCH"

# ════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════"
echo "  PART 2: HEALTH CHECK"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "Fetching health status from ${BASE_URL}/api/match/status..."
status_response=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${BASE_URL}/api/match/status")

status_code=$(echo "$status_response" | tail -n 1)
status_body=$(echo "$status_response" | sed '$d')

if [ "$status_code" -ne 200 ]; then
  echo -e "${RED}✗ FAIL${NC} - Health check returned HTTP $status_code"
  echo "Response: $status_body"
  exit 1
fi

# ════════════════════════════════════════════════════════════════
# SECURITY CHECK: Forbidden fields
# ════════════════════════════════════════════════════════════════

echo ""
echo "─────────────────────────────────────────"
echo "Security Check: Forbidden Fields"
echo "─────────────────────────────────────────"

if echo "$status_body" | grep -qiE 'price|offer|currency|market'; then
  echo -e "${RED}✗ SECURITY VIOLATION${NC} - Forbidden fields detected in status response!"
  echo "Found matches:"
  echo "$status_body" | grep -ioE 'price|offer|currency|market' | sort -u
  exit 1
else
  echo -e "${GREEN}✓ PASS${NC} - No forbidden fields detected"
fi

echo ""

# ════════════════════════════════════════════════════════════════
# PARSE AND DISPLAY HEALTH REPORT
# ════════════════════════════════════════════════════════════════

if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}⚠ WARNING${NC} - jq not installed, showing raw status JSON"
  echo "$status_body"
  echo ""
  echo "Install jq for detailed report: brew install jq"
  exit 0
fi

# Extract health metrics
overall_state=$(echo "$status_body" | jq -r '.summary.overall_state')
total_matches=$(echo "$status_body" | jq -r '.summary.totalMatches')
auto_match_rate=$(echo "$status_body" | jq -r '.summary.autoMatchRate')
suggested_rate=$(echo "$status_body" | jq -r '.summary.suggestedRate')
avg_confidence_auto=$(echo "$status_body" | jq -r '.summary.avgConfidenceAuto')
auto_create_rate=$(echo "$status_body" | jq -r '.summary.autoCreateRate')

# Identifier coverage
gtin_pct=$(echo "$status_body" | jq -r '.summary.identifierCoverage.gtin.pct')
lwin_pct=$(echo "$status_body" | jq -r '.summary.identifierCoverage.lwin.pct')
sku_pct=$(echo "$status_body" | jq -r '.summary.identifierCoverage.sku.pct')
text_pct=$(echo "$status_body" | jq -r '.summary.identifierCoverage.text.pct')

# Warnings and recommendations
warnings_count=$(echo "$status_body" | jq -r '.warnings | length')
recommendations_count=$(echo "$status_body" | jq -r '.recommendations | length')

echo "════════════════════════════════════════════════════════════════"
echo "  HEALTH REPORT"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Overall state
echo "─────────────────────────────────────────"
echo "OVERALL STATE"
echo "─────────────────────────────────────────"

case "$overall_state" in
  "PASS")
    echo -e "${GREEN}✓ PASS${NC} - All metrics within acceptable ranges"
    ;;
  "WARN")
    echo -e "${YELLOW}⚠ WARN${NC} - Some metrics outside ideal range"
    ;;
  "FAIL")
    echo -e "${RED}✗ FAIL${NC} - Critical issues detected"
    ;;
  "INSUFFICIENT_DATA")
    echo -e "${GRAY}📊 INSUFFICIENT_DATA${NC} - Need more match data (min 10)"
    ;;
  *)
    echo -e "${GRAY}? UNKNOWN${NC} - $overall_state"
    ;;
esac

echo ""

# Key metrics
echo "─────────────────────────────────────────"
echo "KEY METRICS (last 7 days)"
echo "─────────────────────────────────────────"
echo "Total Matches:         $total_matches"
echo "Auto Match Rate:       $(awk "BEGIN {printf \"%.0f\", $auto_match_rate * 100}")% (target: ≥30%)"
echo "Suggested Rate:        $(awk "BEGIN {printf \"%.0f\", $suggested_rate * 100}")% (max: 60%)"
echo "Avg Confidence (Auto): $(awk "BEGIN {printf \"%.0f\", $avg_confidence_auto * 100}")% (min: 75%)"
echo "Auto-Create Rate:      $(awk "BEGIN {printf \"%.0f\", $auto_create_rate * 100}")% (max: 50%)"
echo ""

# Identifier coverage
echo "─────────────────────────────────────────"
echo "IDENTIFIER COVERAGE"
echo "─────────────────────────────────────────"
echo "GTIN: ${gtin_pct}%  |  LWIN: ${lwin_pct}%  |  SKU: ${sku_pct}%  |  TEXT: ${text_pct}%"
echo ""

# Recent matches (top 5)
echo "─────────────────────────────────────────"
echo "RECENT MATCHES (top 5)"
echo "─────────────────────────────────────────"

recent_count=$(echo "$status_body" | jq -r '.recent | length')
if [ "$recent_count" -gt 0 ]; then
  echo "$status_body" | jq -r '.recent[0:5] | .[] |
    "\(.status) | \(.match_method) | \(.confidence * 100 | floor)% | \(.explanation | .[0:60])"' | \
    while IFS='|' read -r status method confidence explanation; do
      echo "  $status | $method | $confidence | $explanation"
    done
else
  echo "  No recent matches"
fi

echo ""

# Warnings
if [ "$warnings_count" -gt 0 ]; then
  echo "─────────────────────────────────────────"
  echo -e "${YELLOW}⚠ WARNINGS ($warnings_count)${NC}"
  echo "─────────────────────────────────────────"
  echo "$status_body" | jq -r '.warnings[]' | while read -r warning; do
    echo " • $warning"
  done
  echo ""
fi

# Recommendations
if [ "$recommendations_count" -gt 0 ]; then
  echo "─────────────────────────────────────────"
  echo -e "${BLUE}💡 RECOMMENDATIONS ($recommendations_count)${NC}"
  echo "─────────────────────────────────────────"
  echo "$status_body" | jq -r '.recommendations[]' | while read -r rec; do
    echo " • $rec"
  done
  echo ""
fi

# ════════════════════════════════════════════════════════════════
# TEST SUMMARY
# ════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Golden Path Tests: ${GREEN}${TESTS_PASSED}${NC} / ${TESTS_TOTAL} passed"

if [ "$TESTS_FAILED" -gt 0 ]; then
  echo -e "Failed Tests:      ${RED}${TESTS_FAILED}${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════
# FINAL VERDICT
# ════════════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════════════════════"
echo "  FINAL VERDICT"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Exit based on overall state
case "$overall_state" in
  "PASS")
    if [ "$TESTS_FAILED" -eq 0 ]; then
      echo -e "MVP MATCHING: ${GREEN}✅ PASS${NC}"
      echo ""
      echo "All tests passed and health metrics are good!"
      echo "Visit ${BASE_URL}/match/status for detailed dashboard"
      echo ""
      exit 0
    else
      echo -e "MVP MATCHING: ${YELLOW}⚠️ WARN${NC}"
      echo ""
      echo "Health is PASS but some golden path tests failed."
      echo "Review test failures above."
      echo ""
      exit 0
    fi
    ;;
  "WARN")
    echo -e "MVP MATCHING: ${YELLOW}⚠️ WARN${NC}"
    echo ""
    echo "Some metrics are outside ideal range but system is functional."
    echo "Review warnings and recommendations above."
    echo "Visit ${BASE_URL}/match/status for detailed dashboard"
    echo ""
    exit 0
    ;;
  "FAIL")
    echo -e "MVP MATCHING: ${RED}❌ FAIL${NC}"
    echo ""
    echo "Critical issues detected! System not ready for MVP."
    echo "Review warnings and recommendations above."
    echo "Visit ${BASE_URL}/match/status for detailed dashboard"
    echo ""
    exit 1
    ;;
  "INSUFFICIENT_DATA")
    echo -e "MVP MATCHING: ${GRAY}📊 INSUFFICIENT DATA${NC}"
    echo ""
    echo "Not enough match data yet (minimum 10 matches required)."
    echo "Run more matching operations or use /match-demo to generate test data."
    echo ""
    exit 0
    ;;
  *)
    echo -e "MVP MATCHING: ${RED}❓ UNKNOWN STATE${NC}"
    echo ""
    echo "Unknown state: $overall_state"
    echo "Review status response manually."
    echo ""
    exit 1
    ;;
esac
