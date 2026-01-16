#!/bin/bash
# PILOT SEED KIT - Bash Wrapper
# Creates complete EU order + compliance demo
#
# Usage: bash scripts/pilot-seed.sh

set -e

echo "Starting Pilot Seed Kit..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local not found"
  echo ""
  echo "Please create .env.local with:"
  echo "  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url"
  echo "  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
  echo ""
  exit 1
fi

# Check if dev server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "❌ Error: Dev server not running on http://localhost:3000"
  echo ""
  echo "Please start the dev server first:"
  echo "  npm run dev"
  echo ""
  exit 1
fi

# Load environment variables
set -a
source .env.local
set +a

# Check required env vars
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Missing required environment variables"
  echo ""
  echo "Required in .env.local:"
  echo "  NEXT_PUBLIC_SUPABASE_URL"
  echo "  SUPABASE_SERVICE_ROLE_KEY"
  echo ""
  exit 1
fi

# Run TypeScript seed script
npx ts-node scripts/pilot-seed.ts

# Check exit code
if [ $? -eq 0 ]; then
  echo "════════════════════════════════════════"
  echo "✅ Pilot Seed Complete!"
  echo "════════════════════════════════════════"
  echo ""
  echo "Next steps:"
  echo "  1. Open the URLs printed above"
  echo "  2. Test each view (Restaurant, IOR, Admin)"
  echo "  3. Use the test IDs for smoke tests"
  echo ""
else
  echo ""
  echo "❌ Pilot Seed Failed"
  echo ""
  exit 1
fi
