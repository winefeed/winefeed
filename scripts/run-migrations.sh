#!/usr/bin/env bash
#
# WINEFEED: Run Pilot Migrations
#
# Kör migrations mot remote Supabase-databas.
#
# Usage:
#   ./scripts/run-migrations.sh
#
# Förutsättningar:
#   - Supabase CLI installerat (brew install supabase/tap/supabase)
#   - Inloggad i Supabase CLI (kör: supabase login)
#   - DATABASE_URL eller databas-lösenord tillgängligt
#

set -euo pipefail

# Projekt-ref från .env.local
PROJECT_REF="pqmmgclfpyydrbjaoump"
MIGRATION_FILE="scripts/pilot_migrations_combined.sql"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  WINEFEED PILOT MIGRATIONS"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if migration file exists
if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📦 Migration file: $MIGRATION_FILE"
echo "🔗 Project ref: $PROJECT_REF"
echo ""

# Method 1: Try DATABASE_URL if available
if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "📡 Using DATABASE_URL..."
  /usr/local/opt/libpq/bin/psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"
  echo ""
  echo "✅ Migrations completed successfully!"
  exit 0
fi

# Method 2: Try Supabase CLI
echo "🔐 DATABASE_URL not set. Trying Supabase CLI..."
echo ""

# Check if logged in
if ! supabase projects list &>/dev/null; then
  echo "❌ Not logged in to Supabase CLI."
  echo ""
  echo "Två alternativ:"
  echo ""
  echo "1️⃣  Logga in i Supabase CLI:"
  echo "    supabase login"
  echo "    ./scripts/run-migrations.sh"
  echo ""
  echo "2️⃣  Sätt DATABASE_URL direkt:"
  echo "    export DATABASE_URL='postgresql://postgres:LÖSENORD@db.${PROJECT_REF}.supabase.co:5432/postgres'"
  echo "    ./scripts/run-migrations.sh"
  echo ""
  echo "3️⃣  Kör manuellt i Supabase Dashboard:"
  echo "    https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"
  echo "    Klistra in innehållet från: $MIGRATION_FILE"
  echo ""
  exit 1
fi

# Link project if not already linked
if [[ ! -f "supabase/.temp/project-ref" ]] || [[ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "$PROJECT_REF" ]]; then
  echo "🔗 Linking project..."
  echo ""
  echo "Du kommer bli ombedd att ange databas-lösenordet."
  echo "Hittas i Supabase Dashboard → Settings → Database → Connection string"
  echo ""
  supabase link --project-ref "$PROJECT_REF"
fi

# Push migrations
echo ""
echo "🚀 Pushing migrations..."
supabase db push

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ MIGRATIONS COMPLETED"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Kör nu smoke test för att verifiera:"
echo "  export IOR_USER_ID='00000000-0000-0000-0000-000000000001'"
echo "  export ADMIN_USER_ID='00000000-0000-0000-0000-000000000001'"
echo "  ./scripts/smoke-test-pilot.sh"
echo ""
