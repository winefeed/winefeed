/**
 * SERVER-SIDE SUPABASE CLIENT - LAZY INITIALIZATION
 *
 * Provides lazy-initialized Supabase clients for server-side use.
 * Safe for Next.js build time - clients are only created when actually used.
 *
 * DO NOT import this in client components - use @supabase/ssr instead.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cached clients
let adminClient: SupabaseClient | null = null;

/**
 * Get admin Supabase client (service role)
 * Lazy initialization - safe for build time
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing Supabase credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
      );
    }

    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return adminClient;
}

/**
 * Helper to require environment variable at runtime (not build time)
 */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
