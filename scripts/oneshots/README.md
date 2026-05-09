# One-shot scripts

Scripts that ran once for a specific operation (CRM cleanup, manual
onboarding, ad-hoc research). Kept here for reference and reusability —
not part of the regular runtime or test suite.

Each script reads env from `.env.local` and connects to the production
Supabase instance via service-role key. Use with care.

## Inventory (2026-05-08)

**CRM / pipeline:**
- `audit-importer-leads.mjs` — cross-checks importer leads in
  `restaurant_leads` (status=contacted) vs actual `suppliers`-rows
- `fix-importer-lead-status.mjs` — bulk-update lead statuses to match
  reality (e.g. Vinagenterna, Gardshol contacted → onboarded)
- `link-mario-lead.mjs` — backfilled `restaurant_leads.restaurant_id`
  for Pontus Frithiof so the login-notifications cron can monitor it
- `pipeline-fix.mjs` — generic helper to repair lead/restaurant joins

**Onboarding:**
- `onboard-ett-hem.mjs` — created auth user + restaurant row + invite
  token for Marcus Henningsson at Ett Hem (2026-05-07)
- `send-ett-hem.mjs` — sent the Bordeaux IOR-catalogue intro mail
  (CC Corentin, BCC Markus)
- `send-markus-copy.mjs` — fixed the missed-BCC by sending Markus
  a retroactive copy of the Ett Hem mail

**Research / data extraction:**
- `bordeaux-ior.mjs` — IOR-Bordeaux catalogue summary by decade
- `bordeaux-detailed.mjs` — top-30 producer breakdown
- `decade-samples.mjs` — sample wines per decade for the Marcus mail
- `find-corentin.mjs` — looked up Brasri AB supplier_users for Corentin's
  email address

**Misc:**
- `check-mario.mjs` — debug helper to inspect Mario/Pontus state
- `test-login-cron.mjs` — dry-run for the login-notifications cron
