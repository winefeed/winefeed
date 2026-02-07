/**
 * VINKOLL ACCESS - Direct PostgreSQL Connection
 *
 * Bypasses PostgREST entirely to avoid schema cache issues.
 * Uses the 'postgres' package for direct database access.
 *
 * Requires DATABASE_URL in .env.local
 * (Supabase Dashboard → Settings → Database → Connection string → URI)
 */

import postgres from 'postgres';

let sql: ReturnType<typeof postgres> | null = null;

export function getAccessDb() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set. Get it from Supabase Dashboard → Settings → Database → Connection string (URI).');
    }
    sql = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return sql;
}
