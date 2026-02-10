/**
 * VINKOLL ACCESS - Admin Route Guard
 *
 * Shared helper for /api/admin/access/* routes.
 * Checks Supabase session AND verifies the user's email is in the allow-list.
 *
 * Usage:
 *   const guard = await requireVinkollAdmin();
 *   if (guard.error) return guard.error;
 *   // guard.user is available
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

// Comma-separated list of allowed admin emails.
// Falls back to markus@vinkoll.se if not set.
const ALLOWED_EMAILS = (process.env.VINKOLL_ADMIN_EMAILS || 'markus@vinkoll.se')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

interface GuardSuccess {
  user: User;
  error: null;
}

interface GuardFailure {
  user: null;
  error: NextResponse;
}

export async function requireVinkollAdmin(): Promise<GuardSuccess | GuardFailure> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const email = user.email?.toLowerCase();
  if (!email || !ALLOWED_EMAILS.includes(email)) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, error: null };
}
