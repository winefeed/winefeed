#!/bin/bash
# PILOT ADMIN CONSOLE - SMOKE TEST
# Tests: GET /api/admin/pilot/overview returns 200 + contains arrays

set -e

API_BASE="http://localhost:3000"
TENANT_ID="00000000-0000-0000-0000-000000000001"

echo "════════════════════════════════════════"
echo "Pilot Admin Console - Smoke Test"
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
echo "  3. Tenant ID: $TENANT_ID"
echo ""

# Test 1: GET /api/admin/pilot/overview
echo "─────────────────────────────────────────"
echo "Test 1: GET /api/admin/pilot/overview"
echo "─────────────────────────────────────────"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "x-tenant-id: ${TENANT_ID}" \
  "${API_BASE}/api/admin/pilot/overview")

STATUS_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  echo -e "${GREEN}✓ PASS${NC} - HTTP 200 OK"
  PASSED=$((PASSED + 1))

  # Verify response structure
  echo ""
  echo "Response structure:"
  echo "$BODY" | jq '{
    tenant_id: .tenant_id,
    requests_count: (.recent_requests | length),
    offers_count: (.recent_offers | length),
    events_count: (.recent_events | length),
    timestamp: .timestamp
  }'

  # Verify arrays exist
  REQUESTS_COUNT=$(echo "$BODY" | jq '.recent_requests | length')
  OFFERS_COUNT=$(echo "$BODY" | jq '.recent_offers | length')
  EVENTS_COUNT=$(echo "$BODY" | jq '.recent_events | length')

  echo ""
  echo "Data summary:"
  echo "  - Recent requests: $REQUESTS_COUNT"
  echo "  - Recent offers: $OFFERS_COUNT"
  echo "  - Recent events: $EVENTS_COUNT"

  # Check if arrays are present (even if empty)
  if echo "$BODY" | jq -e '.recent_requests' > /dev/null 2>&1 && \
     echo "$BODY" | jq -e '.recent_offers' > /dev/null 2>&1 && \
     echo "$BODY" | jq -e '.recent_events' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC} - All arrays present in response"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} - Missing required arrays in response"
    FAILED=$((FAILED + 1))
  fi

elif [ "$STATUS_CODE" -eq 403 ]; then
  echo -e "${YELLOW}⚠ SKIP${NC} - HTTP 403 Forbidden"
  echo "Admin access denied. Make sure ADMIN_MODE=true in .env.local"
  echo ""
  echo "To fix:"
  echo "  1. Add to .env.local: ADMIN_MODE=true"
  echo "  2. Restart dev server: npm run dev"
  echo "  3. Run test again"
  echo ""
  FAILED=$((FAILED + 1))
else
  echo -e "${RED}✗ FAIL${NC} - HTTP $STATUS_CODE"
  echo "Response:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  FAILED=$((FAILED + 1))
fi

echo ""

# Test 2: Verify email masking (if MAIL_SENT events exist)
echo "─────────────────────────────────────────"
echo "Test 2: Verify Email Masking in Events"
echo "─────────────────────────────────────────"

if [ "$STATUS_CODE" -eq 200 ]; then
  MAIL_SENT_EVENTS=$(echo "$BODY" | jq '[.recent_events[] | select(.event_type == "MAIL_SENT")]')
  MAIL_SENT_COUNT=$(echo "$MAIL_SENT_EVENTS" | jq 'length')

  if [ "$MAIL_SENT_COUNT" -gt 0 ]; then
    echo "Found $MAIL_SENT_COUNT MAIL_SENT events"

    # Check first MAIL_SENT event for masked email
    FIRST_MAIL_EVENT=$(echo "$MAIL_SENT_EVENTS" | jq '.[0]')
    EMAIL_TO=$(echo "$FIRST_MAIL_EVENT" | jq -r '.payload.to // "N/A"')

    echo "Sample email address: $EMAIL_TO"

    # Verify email is masked (contains ***)
    if [[ "$EMAIL_TO" == *"***"* ]]; then
      echo -e "${GREEN}✓ PASS${NC} - Email address is masked"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - Email address is NOT masked: $EMAIL_TO"
      FAILED=$((FAILED + 1))
    fi
  else
    echo -e "${YELLOW}⚠ SKIP${NC} - No MAIL_SENT events found"
    echo "This is expected if:"
    echo "  - No offers created with emails enabled"
    echo "  - EMAIL_NOTIFICATIONS_ENABLED=false"
    PASSED=$((PASSED + 1))
  fi
else
  echo -e "${YELLOW}⚠ SKIP${NC} - API request failed in Test 1"
  FAILED=$((FAILED + 1))
fi

echo ""

# Test 3: Verify alerts object exists with all required keys
echo "─────────────────────────────────────────"
echo "Test 3: Verify Pilot Ops Alerts"
echo "─────────────────────────────────────────"

if [ "$STATUS_CODE" -eq 200 ]; then
  # Check if alerts object exists
  if echo "$BODY" | jq -e '.alerts' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC} - alerts object exists"
    PASSED=$((PASSED + 1))

    # Verify all 5 alert keys exist
    REQUIRED_KEYS=(
      "eu_orders_without_import_case"
      "import_cases_missing_ddl_or_not_approved"
      "approved_import_cases_missing_5369"
      "orders_stuck_over_3_days"
      "email_failures_last_24h"
    )

    ALL_KEYS_PRESENT=true
    for key in "${REQUIRED_KEYS[@]}"; do
      if echo "$BODY" | jq -e ".alerts.$key" > /dev/null 2>&1; then
        COUNT=$(echo "$BODY" | jq ".alerts.$key.count")
        ITEMS_LENGTH=$(echo "$BODY" | jq ".alerts.$key.items | length")
        echo "  ✓ $key: count=$COUNT, items=$ITEMS_LENGTH"
      else
        echo -e "  ${RED}✗ Missing key: $key${NC}"
        ALL_KEYS_PRESENT=false
      fi
    done

    if [ "$ALL_KEYS_PRESENT" = true ]; then
      echo -e "${GREEN}✓ PASS${NC} - All 5 alert keys present with count and items"
      PASSED=$((PASSED + 1))
    else
      echo -e "${RED}✗ FAIL${NC} - Some alert keys are missing"
      FAILED=$((FAILED + 1))
    fi

    # Display alerts summary
    echo ""
    echo "Alerts summary:"
    echo "$BODY" | jq '{
      eu_orders_without_import: .alerts.eu_orders_without_import_case.count,
      import_missing_ddl: .alerts.import_cases_missing_ddl_or_not_approved.count,
      approved_missing_5369: .alerts.approved_import_cases_missing_5369.count,
      stuck_orders: .alerts.orders_stuck_over_3_days.count,
      email_failures: .alerts.email_failures_last_24h.count
    }'

    # Verify email failures structure (if any failures exist)
    EMAIL_FAILURES_COUNT=$(echo "$BODY" | jq '.alerts.email_failures_last_24h.count')
    if [ "$EMAIL_FAILURES_COUNT" -gt 0 ]; then
      echo ""
      echo "Verifying email_failures_last_24h structure:"

      # Check first failure item for required fields
      FIRST_FAILURE=$(echo "$BODY" | jq '.alerts.email_failures_last_24h.items[0]')

      # Verify source field exists and is valid
      SOURCE=$(echo "$FIRST_FAILURE" | jq -r '.source // "missing"')
      if [[ "$SOURCE" == "offer_events" || "$SOURCE" == "order_events" ]]; then
        echo -e "  ${GREEN}✓${NC} source field valid: $SOURCE"
      else
        echo -e "  ${RED}✗${NC} source field invalid or missing: $SOURCE"
        FAILED=$((FAILED + 1))
      fi

      # Verify to_masked field exists and contains ***
      TO_MASKED=$(echo "$FIRST_FAILURE" | jq -r '.to_masked // "missing"')
      if [[ "$TO_MASKED" == *"***"* ]]; then
        echo -e "  ${GREEN}✓${NC} to_masked field masked: $TO_MASKED"
      else
        echo -e "  ${RED}✗${NC} to_masked field not masked or missing: $TO_MASKED"
        FAILED=$((FAILED + 1))
      fi

      # Verify entity field exists and has correct ID based on source
      if echo "$FIRST_FAILURE" | jq -e '.entity' > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} entity field exists"

        # Verify entity has correct ID based on source
        if [ "$SOURCE" = "offer_events" ]; then
          OFFER_ID=$(echo "$FIRST_FAILURE" | jq -r '.entity.offer_id // "missing"')
          if [ "$OFFER_ID" != "missing" ]; then
            echo -e "  ${GREEN}✓${NC} entity.offer_id exists: ${OFFER_ID:0:12}..."
          else
            echo -e "  ${RED}✗${NC} entity.offer_id missing for offer_events source"
            FAILED=$((FAILED + 1))
          fi
        elif [ "$SOURCE" = "order_events" ]; then
          ORDER_ID=$(echo "$FIRST_FAILURE" | jq -r '.entity.order_id // "missing"')
          if [ "$ORDER_ID" != "missing" ]; then
            echo -e "  ${GREEN}✓${NC} entity.order_id exists: ${ORDER_ID:0:12}..."
          else
            echo -e "  ${RED}✗${NC} entity.order_id missing for order_events source"
            FAILED=$((FAILED + 1))
          fi
        fi
      else
        echo -e "  ${RED}✗${NC} entity field missing"
        FAILED=$((FAILED + 1))
      fi

      # Verify template field exists
      TEMPLATE=$(echo "$FIRST_FAILURE" | jq -r '.template // "missing"')
      if [ "$TEMPLATE" != "missing" ]; then
        echo -e "  ${GREEN}✓${NC} template field: $TEMPLATE"
      else
        echo -e "  ${RED}✗${NC} template field missing"
        FAILED=$((FAILED + 1))
      fi

      # Verify action_hint field exists
      ACTION_HINT=$(echo "$FIRST_FAILURE" | jq -r '.action_hint // "missing"')
      if [ "$ACTION_HINT" != "missing" ]; then
        echo -e "  ${GREEN}✓${NC} action_hint field exists: ${ACTION_HINT:0:50}..."
      else
        echo -e "  ${RED}✗${NC} action_hint field missing"
        FAILED=$((FAILED + 1))
      fi

    else
      echo ""
      echo -e "${YELLOW}⚠ INFO${NC} - No email failures in last 24h (cannot verify structure)"
      echo "  This is expected if:"
      echo "    - EMAIL_NOTIFICATIONS_ENABLED=false"
      echo "    - No emails failed recently"
      echo "  Structure will be validated when failures occur"
    fi

  else
    echo -e "${RED}✗ FAIL${NC} - alerts object missing from response"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${YELLOW}⚠ SKIP${NC} - API request failed in Test 1"
  FAILED=$((FAILED + 1))
fi

echo ""

# Test 4: Verify pilot_metrics (counts and timings)
echo "─────────────────────────────────────────"
echo "Test 4: Verify Pilot KPI Metrics"
echo "─────────────────────────────────────────"

if [ "$STATUS_CODE" -eq 200 ]; then
  # Check if pilot_metrics object exists
  if echo "$BODY" | jq -e '.pilot_metrics' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC} - pilot_metrics object exists"
    PASSED=$((PASSED + 1))

    # Verify counts object and all count keys
    if echo "$BODY" | jq -e '.pilot_metrics.counts' > /dev/null 2>&1; then
      echo -e "${GREEN}✓ PASS${NC} - pilot_metrics.counts exists"
      PASSED=$((PASSED + 1))

      COUNT_KEYS=(
        "requests_created"
        "offers_created"
        "offers_sent"
        "offers_accepted"
        "orders_created"
        "imports_created"
        "imports_approved"
        "orders_shipped"
      )

      ALL_COUNT_KEYS_PRESENT=true
      for key in "${COUNT_KEYS[@]}"; do
        if echo "$BODY" | jq -e ".pilot_metrics.counts.$key" > /dev/null 2>&1; then
          VALUE=$(echo "$BODY" | jq ".pilot_metrics.counts.$key")
          echo "  ✓ counts.$key: $VALUE"
        else
          echo -e "  ${RED}✗ Missing count key: $key${NC}"
          ALL_COUNT_KEYS_PRESENT=false
        fi
      done

      if [ "$ALL_COUNT_KEYS_PRESENT" = true ]; then
        echo -e "${GREEN}✓ PASS${NC} - All 8 count keys present"
        PASSED=$((PASSED + 1))
      else
        echo -e "${RED}✗ FAIL${NC} - Some count keys are missing"
        FAILED=$((FAILED + 1))
      fi
    else
      echo -e "${RED}✗ FAIL${NC} - pilot_metrics.counts missing"
      FAILED=$((FAILED + 1))
    fi

    echo ""

    # Verify timings object and all timing keys
    if echo "$BODY" | jq -e '.pilot_metrics.timings' > /dev/null 2>&1; then
      echo -e "${GREEN}✓ PASS${NC} - pilot_metrics.timings exists"
      PASSED=$((PASSED + 1))

      TIMING_KEYS=(
        "request_to_offer_created"
        "offer_created_to_accepted"
        "accept_to_order_created"
        "order_created_to_import_approved"
      )

      ALL_TIMING_KEYS_PRESENT=true
      for key in "${TIMING_KEYS[@]}"; do
        if echo "$BODY" | jq -e ".pilot_metrics.timings.$key" > /dev/null 2>&1; then
          MEDIAN=$(echo "$BODY" | jq ".pilot_metrics.timings.$key.median_hours")
          P90=$(echo "$BODY" | jq ".pilot_metrics.timings.$key.p90_hours")
          SAMPLE_SIZE=$(echo "$BODY" | jq ".pilot_metrics.timings.$key.sample_size")

          # Verify required fields exist
          if [ "$MEDIAN" != "null" ] || [ "$SAMPLE_SIZE" -lt 5 ] 2>/dev/null; then
            echo "  ✓ timings.$key: median=${MEDIAN}h, p90=${P90}h, n=${SAMPLE_SIZE}"
          else
            echo -e "  ${RED}✗ Invalid timing data for $key${NC}"
            ALL_TIMING_KEYS_PRESENT=false
          fi
        else
          echo -e "  ${RED}✗ Missing timing key: $key${NC}"
          ALL_TIMING_KEYS_PRESENT=false
        fi
      done

      if [ "$ALL_TIMING_KEYS_PRESENT" = true ]; then
        echo -e "${GREEN}✓ PASS${NC} - All 4 timing keys present with required fields"
        PASSED=$((PASSED + 1))
      else
        echo -e "${RED}✗ FAIL${NC} - Some timing keys are missing or invalid"
        FAILED=$((FAILED + 1))
      fi
    else
      echo -e "${RED}✗ FAIL${NC} - pilot_metrics.timings missing"
      FAILED=$((FAILED + 1))
    fi

    # Display full pilot_metrics summary
    echo ""
    echo "Pilot KPI Summary (last 30 days):"
    echo "$BODY" | jq '.pilot_metrics.counts'
    echo ""
    echo "Timing Metrics:"
    echo "$BODY" | jq '.pilot_metrics.timings'

  else
    echo -e "${RED}✗ FAIL${NC} - pilot_metrics object missing from response"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "${YELLOW}⚠ SKIP${NC} - API request failed in Test 1"
  FAILED=$((FAILED + 1))
fi

echo ""

# Summary
echo "════════════════════════════════════════"
echo "Test Summary"
echo "════════════════════════════════════════"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "Admin console is ready to use:"
  echo "  → http://localhost:3000/admin/pilot"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Make sure dev server is running: npm run dev"
  echo "  2. Set ADMIN_MODE=true in .env.local"
  echo "  3. Check tenant_id is valid"
  exit 1
fi
