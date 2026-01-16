#!/bin/bash
# CI check: Enforce [id] routing standard
# Fails if any forbidden slug names are found

set -eo pipefail

# Allow testing against different root directory
ROOT="${APP_ROOT:-.}"

# Guard: app directory must exist
if [ ! -d "$ROOT/app" ]; then
  echo "❌ ERROR: $ROOT/app directory not found"
  echo "   Make sure you're running this from the project root"
  echo "   or set APP_ROOT to point to the correct directory"
  exit 1
fi

# Guard: Check for search tool (prefer rg, fallback to grep)
USE_RG=false
if command -v rg &> /dev/null; then
  USE_RG=true
elif ! command -v grep &> /dev/null; then
  echo "❌ ERROR: Neither ripgrep (rg) nor grep is available"
  echo "   Please install ripgrep for best performance:"
  echo "     macOS:    brew install ripgrep"
  echo "     Ubuntu:   sudo apt-get install ripgrep"
  echo "     Windows:  choco install ripgrep"
  exit 1
fi

echo "🔍 Checking route slug compliance..."
echo "   Root: $ROOT"

# Helper function: search with rg or grep
search_pattern() {
  local pattern="$1"
  local path="$2"

  if [ "$USE_RG" = true ]; then
    rg -n "$pattern" "$path" --glob "*.ts" --glob "*.tsx" 2>/dev/null || true
  else
    # Fallback to grep (slower but portable)
    find "$path" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -Hn -E "$pattern" {} \; 2>/dev/null || true
  fi
}

# 1) Explicit list of forbidden slugs (easy to update)
FORBIDDEN_SLUGS=(
  "supplierId"
  "restaurantId"
  "importerId"
  "importId"
  "ddlId"
  "queueItemId"
  "requestId"
  "shipmentId"
  "orderId"
  "offerId"
  "quoteRequestId"
  "tenantId"
  "userId"
  "productId"
)

ERRORS=0
VIOLATIONS=()

# Check 1: Filesystem - no forbidden directory names
echo ""
echo "1️⃣  Checking filesystem for forbidden slug directories..."
for slug in "${FORBIDDEN_SLUGS[@]}"; do
  FOUND=$(find "$ROOT/app" -type d -name "\[${slug}\]" 2>/dev/null || true)
  if [ -n "$FOUND" ]; then
    VIOLATIONS+=("❌ FORBIDDEN DIRECTORY: [$slug]")
    VIOLATIONS+=("$(echo "$FOUND" | sed 's/^/   /')")
    ERRORS=$((ERRORS + 1))
  fi
done

if [ $ERRORS -eq 0 ]; then
  echo "   ✅ No forbidden slug directories found"
fi

# Check 2: Mixed slugs for same path (catches hidden duplicates)
echo ""
echo "2️⃣  Checking for mixed slugs in same path..."
# Find all dynamic segments and group by parent path
MIXED_SLUGS=$(find "$ROOT/app" -type d -name '\[*\]' 2>/dev/null | \
  perl -ne '
    if (m{^(.*)/\[([^\]]+)\](.*)$}) {
      my ($prefix, $slug, $suffix) = ($1, $2, $3);
      $paths{$prefix}{$slug}++;
    }
    END {
      foreach my $prefix (keys %paths) {
        my @slugs = keys %{$paths{$prefix}};
        if (@slugs > 1) {
          print "MIXED: $prefix has: [" . join("], [", @slugs) . "]\n";
        }
      }
    }
  ' || true)

if [ -n "$MIXED_SLUGS" ]; then
  VIOLATIONS+=("❌ MIXED SLUGS (same path, different names):")
  VIOLATIONS+=("$(echo "$MIXED_SLUGS" | sed 's/^/   /')")
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ No mixed slugs for same path"
fi

# Check 3: Code patterns - TypeScript param types
echo ""
echo "3️⃣  Checking code for forbidden param patterns..."

# 3a) Check function signatures: params: { supplierId: string }
for slug in "${FORBIDDEN_SLUGS[@]}"; do
  MATCHES=$(search_pattern "params:\s*\{\s*${slug}:\s*string" "$ROOT/app")
  if [ -n "$MATCHES" ]; then
    VIOLATIONS+=("❌ FORBIDDEN PATTERN: params: { ${slug}: string }")
    VIOLATIONS+=("$(echo "$MATCHES" | sed 's/^/   /')")
    ERRORS=$((ERRORS + 1))
  fi
done

# 3b) Check useParams generics: useParams<{ supplierId: string }>()
for slug in "${FORBIDDEN_SLUGS[@]}"; do
  MATCHES=$(search_pattern "useParams<\{[^}]*${slug}:\s*string" "$ROOT/app")
  if [ -n "$MATCHES" ]; then
    VIOLATIONS+=("❌ FORBIDDEN PATTERN: useParams<{ ${slug}: string }>")
    VIOLATIONS+=("$(echo "$MATCHES" | sed 's/^/   /')")
    ERRORS=$((ERRORS + 1))
  fi
done

# 3c) Check Page component destructuring: Page({ params: { supplierId } })
for slug in "${FORBIDDEN_SLUGS[@]}"; do
  MATCHES=$(search_pattern "Page\([^)]*params:\s*\{\s*${slug}[,\s}]" "$ROOT/app")
  if [ -n "$MATCHES" ]; then
    VIOLATIONS+=("❌ FORBIDDEN PATTERN: Page({ params: { ${slug} } })")
    VIOLATIONS+=("$(echo "$MATCHES" | sed 's/^/   /')")
    ERRORS=$((ERRORS + 1))
  fi
done

# 3d) Check generateStaticParams return types
for slug in "${FORBIDDEN_SLUGS[@]}"; do
  MATCHES=$(search_pattern "generateStaticParams[^{]*\{[^}]*${slug}:" "$ROOT/app")
  if [ -n "$MATCHES" ]; then
    VIOLATIONS+=("❌ FORBIDDEN PATTERN: generateStaticParams with ${slug}")
    VIOLATIONS+=("$(echo "$MATCHES" | sed 's/^/   /')")
    ERRORS=$((ERRORS + 1))
  fi
done

if [ $ERRORS -eq 0 ]; then
  echo "   ✅ All code uses params: { id: string } pattern"
fi

# Check 4: Verify all dynamic routes use [id]
echo ""
echo "4️⃣  Verifying all dynamic routes use [id]..."
ID_COUNT=$(find "$ROOT/app" -type d -name "\[id\]" 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ Found $ID_COUNT [id] directories"

# Summary - fail fast with clear output
echo ""
echo "════════════════════════════════════════"

if [ $ERRORS -eq 0 ]; then
  echo "✅ Route slug compliance: PASS"
  echo "   All routes follow [id] standard"
  echo "   Dynamic routes: $ID_COUNT"
  exit 0
else
  echo "❌ Route slug compliance: FAIL"
  echo "   Found $ERRORS violation(s)"
  echo ""

  # Print all violations with clear diff-like output
  for violation in "${VIOLATIONS[@]}"; do
    echo "$violation"
  done

  echo ""
  echo "────────────────────────────────────────"
  echo "🔧 How to fix:"
  echo "   1. Rename directories to [id]"
  echo "   2. Update param types to { id: string }"
  echo "   3. Alias in code: const { id: supplierId } = params"
  echo ""
  echo "📚 See: ROUTE_STANDARDIZATION_COMPLETE.md"
  echo "────────────────────────────────────────"
  exit 1
fi
