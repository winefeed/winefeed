# Route Slug Compliance Check - Setup Guide

## What It Does

Automatically enforces the `[id]` routing standard by checking:

1. ✅ No forbidden slug directories (`[supplierId]`, `[restaurantId]`, etc.)
2. ✅ No mixed slugs for same path (catches duplicate routes)
3. ✅ No forbidden param patterns in code:
   - `params: { supplierId: string }`
   - `useParams<{ supplierId: string }>()`
   - `Page({ params: { supplierId } })`
   - `generateStaticParams` with forbidden slugs
4. ✅ All dynamic routes use `[id]`

## Usage

### Manual Check
```bash
npm run check:routes
```

### Test the Check Script
```bash
npm run test:routes  # Runs synthetic violation test
```

### Automatic on Build
```bash
npm run build  # Runs check:routes first
```

### Skip Check (emergency)
```bash
npm run build:skip-checks
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install

      # Test that the check script works correctly
      - name: Test route checker
        run: npm run test:routes

      # Run the actual check
      - name: Check route compliance
        run: npm run check:routes

  build:
    needs: compliance
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
```

## Pre-commit Hook (Recommended)

### Option 1: Using Husky (Recommended)

Install husky:
```bash
npm install --save-dev husky
npx husky init
```

The pre-commit hook is already created at `.husky/pre-commit`. Enable it:
```bash
chmod +x .husky/pre-commit
```

Add to `package.json`:
```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

Now the check runs automatically before every commit!

### Option 2: Manual Git Hook

If you don't want husky, copy the hook manually:
```bash
cp .husky/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Note:** Manual hooks don't sync via git, so each developer must set it up.

## Adding New Forbidden Slugs

Edit `scripts/check-route-slugs.sh`:
```bash
FORBIDDEN_SLUGS=(
  "supplierId"
  "restaurantId"
  # ... add more here
  "yourNewSlug"
)
```

## Example Output

### ✅ Pass
```
🔍 Checking route slug compliance...

1️⃣  Checking filesystem for forbidden slug directories...
   ✅ No forbidden slug directories found

2️⃣  Checking for mixed slugs in same path...
   ✅ No mixed slugs for same path

3️⃣  Checking code for forbidden param patterns...
   ✅ All code uses params: { id: string } pattern

4️⃣  Verifying all dynamic routes use [id]...
   ✅ Found 9 [id] directories

════════════════════════════════════════
✅ Route slug compliance: PASS
   All routes follow [id] standard
   Dynamic routes: 9
```

### ❌ Fail
```
🔍 Checking route slug compliance...

1️⃣  Checking filesystem for forbidden slug directories...
   ❌ FORBIDDEN DIRECTORY: [supplierId]
   app/api/suppliers/[supplierId]

2️⃣  Checking for mixed slugs in same path...
   ✅ No mixed slugs for same path

3️⃣  Checking code for forbidden param patterns...
   ❌ FORBIDDEN PATTERN: params: { supplierId: string }
   app/api/suppliers/[supplierId]/route.ts:10:  { params }: { params: { supplierId: string } }

════════════════════════════════════════
❌ Route slug compliance: FAIL
   Found 2 violation(s)

────────────────────────────────────────
🔧 How to fix:
   1. Rename directories to [id]
   2. Update param types to { id: string }
   3. Alias in code: const { id: supplierId } = params

📚 See: ROUTE_STANDARDIZATION_COMPLETE.md
────────────────────────────────────────
```

## Troubleshooting

### "command not found: rg"

Install ripgrep:
```bash
# macOS
brew install ripgrep

# Ubuntu/Debian
sudo apt-get install ripgrep

# Windows
choco install ripgrep
```

### Pre-commit hook not running

Make sure it's executable:
```bash
chmod +x .husky/pre-commit
# or
chmod +x .git/hooks/pre-commit
```

### Want to commit despite check failure

Use `--no-verify` (NOT recommended):
```bash
git commit --no-verify -m "Emergency fix"
```

## Maintenance

Update the forbidden slugs list as your codebase evolves. The check is fast (~100ms) and prevents costly routing bugs.
