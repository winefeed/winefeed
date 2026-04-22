/**
 * Enable RLS on wine_feedback + supplier_specializations.
 *
 * Both tables are accessed exclusively via service role in server
 * routes (see app/api/wine-feedback/route.ts, app/api/admin/suppliers/[id]/route.ts,
 * lib/matching-agent/open-request-fanout.ts). Service role bypasses RLS,
 * so no policies are required — RLS with zero policies = default deny for
 * anon + authenticated roles.
 *
 * Fixes Supabase Security Advisor "Table publicly accessible" / rls_disabled_in_public.
 */

ALTER TABLE wine_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_specializations ENABLE ROW LEVEL SECURITY;
