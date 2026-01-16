#!/bin/bash
# MATCHING HEALTH STATUS - CLI SMOKE TEST
# Quick health check for matching service

set -e

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-00000000-0000-0000-0000-000000000001}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo ""
echo "════════════════════════════════════════"
echo "  MATCHING HEALTH STATUS"
echo "════════════════════════════════════════"
echo ""

# Fetch status
echo "Fetching status from ${API_BASE}/api/match/status..."
response=$(curl -s \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/match/status")

# Check if request succeeded
if [ -z "$response" ]; then
  echo -e "${RED}✗ FAIL${NC} - Could not fetch status"
  exit 1
fi

# Parse JSON (requires jq)
if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}⚠ WARNING${NC} - jq not installed, showing raw JSON"
  echo "$response"
  exit 0
fi

# Extract key fields
overall_state=$(echo "$response" | jq -r '.summary.overall_state')
total_matches=$(echo "$response" | jq -r '.summary.totalMatches')
auto_match_rate=$(echo "$response" | jq -r '.summary.autoMatchRate')
suggested_rate=$(echo "$response" | jq -r '.summary.suggestedRate')
avg_confidence_auto=$(echo "$response" | jq -r '.summary.avgConfidenceAuto')
auto_create_rate=$(echo "$response" | jq -r '.summary.autoCreateRate')

# DB Health
can_read=$(echo "$response" | jq -r '.dbHealth.canRead')
can_write=$(echo "$response" | jq -r '.dbHealth.canWrite')

# Config
auto_create_enabled=$(echo "$response" | jq -r '.config.matching_auto_create_enabled')
ws_mode=$(echo "$response" | jq -r '.config.wine_searcher_mode')

# Identifier coverage
gtin_pct=$(echo "$response" | jq -r '.summary.identifierCoverage.gtin.pct')
lwin_pct=$(echo "$response" | jq -r '.summary.identifierCoverage.lwin.pct')
sku_pct=$(echo "$response" | jq -r '.summary.identifierCoverage.sku.pct')
text_pct=$(echo "$response" | jq -r '.summary.identifierCoverage.text.pct')

# Warnings and recommendations
warnings_count=$(echo "$response" | jq -r '.warnings | length')
recommendations_count=$(echo "$response" | jq -r '.recommendations | length')

# Display overall state
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

# Display KPIs
echo "─────────────────────────────────────────"
echo "KEY METRICS (last 7 days)"
echo "─────────────────────────────────────────"
echo "Total Matches:        $total_matches"
echo "Auto Match Rate:      $(awk "BEGIN {printf \"%.0f\", $auto_match_rate * 100}")% (target: ≥30%)"
echo "Suggested Rate:       $(awk "BEGIN {printf \"%.0f\", $suggested_rate * 100}")% (max: 60%)"
echo "Avg Confidence (Auto): $(awk "BEGIN {printf \"%.0f\", $avg_confidence_auto * 100}")% (min: 75%)"
echo "Auto-Create Rate:     $(awk "BEGIN {printf \"%.0f\", $auto_create_rate * 100}")% (max: 50%)"
echo ""

# Display identifier coverage
echo "─────────────────────────────────────────"
echo "IDENTIFIER COVERAGE"
echo "─────────────────────────────────────────"
echo "GTIN: ${gtin_pct}%  |  LWIN: ${lwin_pct}%  |  SKU: ${sku_pct}%  |  TEXT: ${text_pct}%"
echo ""

# Display configuration
echo "─────────────────────────────────────────"
echo "CONFIGURATION"
echo "─────────────────────────────────────────"
echo "DB Read:       $([ "$can_read" = "true" ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}FAIL${NC}")"
echo "DB Write:      $([ "$can_write" = "true" ] && echo -e "${GREEN}OK${NC}" || [ "$can_write" = "SKIPPED_PROD_READONLY" ] && echo -e "${BLUE}SKIPPED (Prod)${NC}" || echo -e "${RED}FAIL${NC}")"
echo "Auto-Create:   $([ "$auto_create_enabled" = "true" ] && echo -e "${BLUE}ENABLED${NC}" || echo -e "${GRAY}DISABLED${NC}")"
echo "Wine-Searcher: ${ws_mode^^}"
echo ""

# Display warnings
if [ "$warnings_count" -gt 0 ]; then
  echo "─────────────────────────────────────────"
  echo -e "${YELLOW}⚠ WARNINGS ($warnings_count)${NC}"
  echo "─────────────────────────────────────────"
  echo "$response" | jq -r '.warnings[]' | while read -r warning; do
    echo " • $warning"
  done
  echo ""
fi

# Display recommendations
if [ "$recommendations_count" -gt 0 ]; then
  echo "─────────────────────────────────────────"
  echo -e "${BLUE}💡 RECOMMENDATIONS ($recommendations_count)${NC}"
  echo "─────────────────────────────────────────"
  echo "$response" | jq -r '.recommendations[]' | while read -r rec; do
    echo " • $rec"
  done
  echo ""
fi

# Display footer
echo "─────────────────────────────────────────"
echo "For detailed view, visit: ${API_BASE}/match/status"
echo "─────────────────────────────────────────"
echo ""

# Exit code based on state
case "$overall_state" in
  "PASS")
    exit 0
    ;;
  "WARN")
    exit 0
    ;;
  "FAIL")
    exit 1
    ;;
  "INSUFFICIENT_DATA")
    exit 0
    ;;
  *)
    exit 1
    ;;
esac
