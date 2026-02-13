import { createClient as createUserClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * Create Supabase clients for API route handlers.
 *
 * - userClient: session-scoped (anon key + cookies), enforces RLS
 * - adminClient: service role, bypasses RLS — use sparingly
 */
export async function createRouteClients() {
  return {
    userClient: await createUserClient(),
    adminClient: getSupabaseAdmin(),
  };
}
