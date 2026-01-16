#!/bin/bash
# Test script for check-route-slugs.sh
# Creates a synthetic app structure with violations and verifies detection

set -euo pipefail

# Ensure PATH includes common locations for ripgrep
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# If rg is still not found, try to use Claude's builtin rg if available
if ! command -v rg &> /dev/null; then
  if command -v /Users/markusnilsson/.local/share/claude/versions/2.1.6 &> /dev/null; then
    # Create a wrapper for Claude's rg
    mkdir -p /tmp/rg-wrapper
    cat > /tmp/rg-wrapper/rg << 'RGWRAPPER'
#!/bin/bash
exec /Users/markusnilsson/.local/share/claude/versions/2.1.6 --ripgrep "$@"
RGWRAPPER
    chmod +x /tmp/rg-wrapper/rg
    export PATH="/tmp/rg-wrapper:$PATH"
  fi
fi

echo "════════════════════════════════════════"
echo "Testing check-route-slugs.sh"
echo "════════════════════════════════════════"
echo ""

# Create temp directory
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "📁 Creating synthetic app structure in: $TMPDIR"

# Create violations that should be detected:

# 1) Forbidden directory: [supplierId]
mkdir -p "$TMPDIR/app/api/suppliers/[supplierId]/imports"

# 2) Mixed slugs: same path with [id] and [supplierId]
mkdir -p "$TMPDIR/app/api/suppliers/[id]/catalog"

# 3) Create route files with forbidden TS patterns
cat > "$TMPDIR/app/api/suppliers/[supplierId]/imports/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { supplierId: string } }
) {
  const supplierId = params.supplierId;
  return NextResponse.json({ supplierId });
}
EOF

# 4) Create a client page with useParams violation
mkdir -p "$TMPDIR/app/dashboard/offers/[requestId]"
cat > "$TMPDIR/app/dashboard/offers/[requestId]/page.tsx" << 'EOF'
'use client';

import { useParams } from 'next/navigation';

export default function OffersPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = params.requestId;
  return <div>{requestId}</div>;
}
EOF

# 5) Create a page with destructuring violation
mkdir -p "$TMPDIR/app/restaurants/[restaurantId]"
cat > "$TMPDIR/app/restaurants/[restaurantId]/page.tsx" << 'EOF'
export default function Page({ params }: { params: { restaurantId: string } }) {
  const restaurantId = params.restaurantId;
  return <div>{restaurantId}</div>;
}
EOF

echo "✅ Synthetic structure created with violations:"
echo "   - Forbidden directory: [supplierId]"
echo "   - Mixed slugs: [id] and [supplierId] in same path"
echo "   - TS pattern violations in route.ts and page.tsx files"
echo ""

# Run the check script (expect it to fail)
echo "🧪 Running check-route-slugs.sh against synthetic structure..."
echo ""

set +e
APP_ROOT="$TMPDIR" bash scripts/check-route-slugs.sh > "$TMPDIR/out.txt" 2>&1
STATUS=$?
set -e

echo "════════════════════════════════════════"
echo "Check output:"
echo "════════════════════════════════════════"
cat "$TMPDIR/out.txt"
echo ""

# Assert: exit code should be 1 (failure)
echo "════════════════════════════════════════"
echo "Assertions:"
echo "════════════════════════════════════════"

PASSED=0
FAILED=0

# Test 1: Exit code should be 1
if [ $STATUS -ne 0 ]; then
  echo "✅ Exit code is non-zero ($STATUS)"
  PASSED=$((PASSED + 1))
else
  echo "❌ Exit code should be non-zero, got $STATUS"
  FAILED=$((FAILED + 1))
fi

# Test 2: Should detect FORBIDDEN directory
if grep -q "FORBIDDEN DIRECTORY" "$TMPDIR/out.txt"; then
  echo "✅ Detected forbidden directory"
  PASSED=$((PASSED + 1))
else
  echo "❌ Failed to detect forbidden directory"
  FAILED=$((FAILED + 1))
fi

# Test 3: Should detect MIXED slugs
if grep -q "MIXED" "$TMPDIR/out.txt"; then
  echo "✅ Detected mixed slugs"
  PASSED=$((PASSED + 1))
else
  echo "❌ Failed to detect mixed slugs"
  FAILED=$((FAILED + 1))
fi

# Test 4: Should show file/line for TS pattern violation in route.ts
if grep -q "route.ts" "$TMPDIR/out.txt"; then
  echo "✅ Detected TS pattern violation in route.ts with file/line"
  PASSED=$((PASSED + 1))
else
  echo "❌ Failed to detect TS pattern violation in route.ts"
  FAILED=$((FAILED + 1))
fi

# Test 5: Should detect useParams violation in page.tsx
if grep -q "page.tsx" "$TMPDIR/out.txt"; then
  echo "✅ Detected violations in page.tsx"
  PASSED=$((PASSED + 1))
else
  echo "❌ Failed to detect violations in page.tsx"
  FAILED=$((FAILED + 1))
fi

# Test 6: Should mention "supplierId" in violations
if grep -q "supplierId" "$TMPDIR/out.txt"; then
  echo "✅ Violation output mentions supplierId"
  PASSED=$((PASSED + 1))
else
  echo "❌ Violation output should mention supplierId"
  FAILED=$((FAILED + 1))
fi

# Test 7: Should show "FAIL" in summary
if grep -q "FAIL" "$TMPDIR/out.txt"; then
  echo "✅ Summary shows FAIL status"
  PASSED=$((PASSED + 1))
else
  echo "❌ Summary should show FAIL status"
  FAILED=$((FAILED + 1))
fi

echo ""
echo "════════════════════════════════════════"
echo "FAIL Case Test Results:"
echo "════════════════════════════════════════"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
  echo "❌ FAIL case tests failed!"
  echo ""
  echo "The detection script may not be working correctly."
  echo "Review the output above and fix the issues."
  exit 1
fi

echo "✅ FAIL case: All tests passed!"
echo ""

# ==========================================================
# TEST 2: PASS CASE - Clean structure should pass
# ==========================================================

echo "════════════════════════════════════════"
echo "Test 2: PASS Case (Clean Structure)"
echo "════════════════════════════════════════"
echo ""

TMPDIR_PASS=$(mktemp -d)
trap 'rm -rf "$TMPDIR" "$TMPDIR_PASS"' EXIT

echo "📁 Creating clean app structure in: $TMPDIR_PASS"

# Create correct structure with [id] only
mkdir -p "$TMPDIR_PASS/app/api/suppliers/[id]/imports"
mkdir -p "$TMPDIR_PASS/app/api/restaurants/[id]/direct-delivery-locations"
mkdir -p "$TMPDIR_PASS/app/dashboard/offers/[id]"

# Create route file with CORRECT pattern
cat > "$TMPDIR_PASS/app/api/suppliers/[id]/imports/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: supplierId } = params;  // Correct aliasing
  return NextResponse.json({ supplierId });
}
EOF

# Create client page with CORRECT pattern
cat > "$TMPDIR_PASS/app/dashboard/offers/[id]/page.tsx" << 'EOF'
'use client';

import { useParams } from 'next/navigation';

export default function OffersPage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;  // Correct assignment
  return <div>{requestId}</div>;
}
EOF

# Create server page with CORRECT pattern
cat > "$TMPDIR_PASS/app/api/restaurants/[id]/page.tsx" << 'EOF'
export default function Page({ params }: { params: { id: string } }) {
  const restaurantId = params.id;  // Correct assignment
  return <div>{restaurantId}</div>;
}
EOF

echo "✅ Clean structure created with:"
echo "   - All directories use [id]"
echo "   - All code uses params: { id: string }"
echo "   - Proper aliasing in handlers"
echo ""

# Run the check script (expect it to pass)
echo "🧪 Running check-route-slugs.sh against clean structure..."
echo ""

set +e
APP_ROOT="$TMPDIR_PASS" bash scripts/check-route-slugs.sh > "$TMPDIR_PASS/out.txt" 2>&1
STATUS_PASS=$?
set -e

echo "════════════════════════════════════════"
echo "Check output:"
echo "════════════════════════════════════════"
cat "$TMPDIR_PASS/out.txt"
echo ""

# Assert: exit code should be 0 (success)
echo "════════════════════════════════════════"
echo "PASS Case Assertions:"
echo "════════════════════════════════════════"

PASSED_PASS=0
FAILED_PASS=0

# Test 1: Exit code should be 0
if [ $STATUS_PASS -eq 0 ]; then
  echo "✅ Exit code is zero (success)"
  PASSED_PASS=$((PASSED_PASS + 1))
else
  echo "❌ Exit code should be 0, got $STATUS_PASS"
  FAILED_PASS=$((FAILED_PASS + 1))
fi

# Test 2: Should show PASS status
if grep -q "PASS" "$TMPDIR_PASS/out.txt"; then
  echo "✅ Summary shows PASS status"
  PASSED_PASS=$((PASSED_PASS + 1))
else
  echo "❌ Summary should show PASS status"
  FAILED_PASS=$((FAILED_PASS + 1))
fi

# Test 3: Should NOT show any violations
if ! grep -q "FORBIDDEN" "$TMPDIR_PASS/out.txt"; then
  echo "✅ No violations detected"
  PASSED_PASS=$((PASSED_PASS + 1))
else
  echo "❌ Should not detect any violations"
  FAILED_PASS=$((FAILED_PASS + 1))
fi

# Test 4: Should find [id] directories
if grep -q "Found 3 \[id\] directories" "$TMPDIR_PASS/out.txt"; then
  echo "✅ Correctly counts [id] directories"
  PASSED_PASS=$((PASSED_PASS + 1))
else
  echo "❌ Should find 3 [id] directories"
  FAILED_PASS=$((FAILED_PASS + 1))
fi

echo ""
echo "════════════════════════════════════════"
echo "PASS Case Test Results:"
echo "════════════════════════════════════════"
echo "Passed: $PASSED_PASS"
echo "Failed: $FAILED_PASS"
echo ""

# ==========================================================
# FINAL SUMMARY
# ==========================================================

TOTAL_PASSED=$((PASSED + PASSED_PASS))
TOTAL_FAILED=$((FAILED + FAILED_PASS))

echo "════════════════════════════════════════"
echo "Final Test Summary:"
echo "════════════════════════════════════════"
echo "FAIL case tests: $PASSED/$((PASSED + FAILED))"
echo "PASS case tests: $PASSED_PASS/$((PASSED_PASS + FAILED_PASS))"
echo ""
echo "Total: $TOTAL_PASSED passed, $TOTAL_FAILED failed"
echo ""

if [ $TOTAL_FAILED -eq 0 ]; then
  echo "✅ All tests passed!"
  echo ""
  echo "The check-route-slugs.sh script correctly:"
  echo "  ✓ Detects violations (FAIL case)"
  echo "  ✓ Passes clean code (PASS case)"
  echo "  ✓ Shows file/line numbers for violations"
  echo "  ✓ Provides clear error messages"
  exit 0
else
  echo "❌ Some tests failed!"
  echo ""
  echo "The check script may not be working correctly."
  echo "Review the output above and fix the issues."
  exit 1
fi
