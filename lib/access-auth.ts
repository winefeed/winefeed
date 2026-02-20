/**
 * VINKOLL ACCESS - Consumer Authentication
 *
 * Magic link auth for consumers:
 * - Token generation with SHA-256 hashing
 * - Cookie-based session (access_consumer = consumer UUID)
 * - 30-minute token expiry, 30-day cookie
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getAccessAdmin } from './supabase-server';

const COOKIE_NAME = 'access_consumer';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const TOKEN_EXPIRY_MINUTES = 30;

/**
 * Generate a secure random token and its SHA-256 hash
 */
export function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

/**
 * Hash a raw token with SHA-256
 */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Create an auth token in the database
 * @param expiryMinutes - Token lifetime in minutes. Default 30 min (consumer login). Use 10080 (7 days) for importer tokens.
 */
export async function createAuthToken(
  subjectType: string,
  subjectId: string,
  metadata: Record<string, unknown> = {},
  expiryMinutes: number = TOKEN_EXPIRY_MINUTES
): Promise<string> {
  const supabase = getAccessAdmin();
  const { raw, hash } = generateToken();

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

  const { error } = await supabase.from('access_auth_tokens').insert({
    token_hash: hash,
    subject_type: subjectType,
    subject_id: subjectId,
    metadata,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('Failed to create auth token:', error);
    throw new Error('Failed to create auth token');
  }

  return raw;
}

/**
 * Verify a raw token: lookup by hash, check expiry, mark used
 * Returns subject info if valid, null otherwise
 */
export async function verifyAuthToken(raw: string): Promise<{
  subjectType: string;
  subjectId: string;
  metadata: Record<string, unknown>;
} | null> {
  const supabase = getAccessAdmin();
  const hash = hashToken(raw);

  const { data: token, error } = await supabase
    .from('access_auth_tokens')
    .select('id, subject_type, subject_id, metadata, expires_at, used_at')
    .eq('token_hash', hash)
    .single();

  if (error || !token) return null;
  if (token.used_at) return null;
  if (new Date(token.expires_at) < new Date()) return null;

  // Mark as used
  await supabase
    .from('access_auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', token.id);

  return {
    subjectType: token.subject_type,
    subjectId: token.subject_id,
    metadata: token.metadata || {},
  };
}

/**
 * Verify a raw token WITHOUT consuming it (peek).
 * Used for importer response pages — importör can open the page multiple times.
 * Token is only consumed on POST submit via verifyAuthToken().
 */
export async function verifyAuthTokenPeek(raw: string): Promise<{
  subjectType: string;
  subjectId: string;
  metadata: Record<string, unknown>;
} | null> {
  const supabase = getAccessAdmin();
  const hash = hashToken(raw);

  const { data: token, error } = await supabase
    .from('access_auth_tokens')
    .select('id, subject_type, subject_id, metadata, expires_at, used_at')
    .eq('token_hash', hash)
    .single();

  if (error || !token) return null;
  if (token.used_at) return null;
  if (new Date(token.expires_at) < new Date()) return null;

  return {
    subjectType: token.subject_type,
    subjectId: token.subject_id,
    metadata: token.metadata || {},
  };
}

/**
 * Set access consumer cookie
 */
export async function setAccessCookie(consumerId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, consumerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Get consumer ID from cookie
 */
export async function getAccessConsumerId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Clear access consumer cookie
 */
export async function clearAccessCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}
