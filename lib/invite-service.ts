/**
 * INVITE SERVICE - PILOT ONBOARDING 1.0
 *
 * Handles invite creation, verification, and acceptance
 *
 * Features:
 * - Secure token generation (SHA-256 hash storage)
 * - Email sending with fail-safe pattern
 * - Expiry validation
 * - Single-use enforcement
 * - Tenant isolation
 */

import { getSupabaseAdmin } from './supabase-server';
import crypto from 'crypto';

export interface CreateInviteInput {
  tenant_id: string;
  email: string;
  role: 'RESTAURANT' | 'SUPPLIER';
  restaurant_id?: string;
  supplier_id?: string;
  created_by_user_id?: string;
}

export interface VerifyInviteResult {
  invite_id: string;
  email: string;
  role: 'RESTAURANT' | 'SUPPLIER';
  entity_name: string;
  expires_at: string;
  is_valid: boolean;
  error?: string;
}

export interface AcceptInviteInput {
  token: string;
  password: string;
  name?: string;  // User's full name
}

/**
 * Generate secure random token (32 bytes = 256 bits)
 * Returns hex string (64 characters)
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash token with SHA-256
 * This is what gets stored in DB (never store plaintext tokens)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify token matches hash (constant-time comparison)
 */
function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(hash)
  );
}

class InviteService {
  /**
   * Create invite and return plaintext token (for email)
   * Token hash is stored in DB
   */
  async createInvite(input: CreateInviteInput): Promise<{ invite_id: string; token: string; expires_at: string }> {
    const supabase = getSupabaseAdmin();

    // Validate role-specific requirements
    if (input.role === 'RESTAURANT' && !input.restaurant_id) {
      throw new Error('restaurant_id is required for RESTAURANT role');
    }

    if (input.role === 'SUPPLIER' && !input.supplier_id) {
      throw new Error('supplier_id is required for SUPPLIER role');
    }

    // Generate token
    const token = generateToken();
    const tokenHash = hashToken(token);

    // Calculate expiry (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite
    const { data, error } = await supabase
      .from('invites')
      .insert({
        tenant_id: input.tenant_id,
        email: input.email.toLowerCase().trim(),
        role: input.role,
        restaurant_id: input.restaurant_id || null,
        supplier_id: input.supplier_id || null,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        created_by_user_id: input.created_by_user_id || null
      })
      .select('id, expires_at')
      .single();

    if (error) {
      console.error('Failed to create invite:', error);
      throw new Error(`Failed to create invite: ${error.message}`);
    }

    return {
      invite_id: data.id,
      token: token,  // Return plaintext token for email
      expires_at: data.expires_at
    };
  }

  /**
   * Verify invite token and return invite metadata
   */
  async verifyInvite(token: string): Promise<VerifyInviteResult> {
    const supabase = getSupabaseAdmin();
    const tokenHash = hashToken(token);

    // Fetch invite by token hash
    const { data: invite, error } = await supabase
      .from('invites')
      .select(`
        id,
        email,
        role,
        restaurant_id,
        supplier_id,
        expires_at,
        used_at,
        restaurants (name),
        suppliers (namn)
      `)
      .eq('token_hash', tokenHash)
      .single();

    if (error || !invite) {
      return {
        invite_id: '',
        email: '',
        role: 'RESTAURANT',
        entity_name: '',
        expires_at: '',
        is_valid: false,
        error: 'Invalid invite token'
      };
    }

    // Check if already used
    if (invite.used_at) {
      return {
        invite_id: invite.id,
        email: invite.email,
        role: invite.role,
        entity_name: '',
        expires_at: invite.expires_at,
        is_valid: false,
        error: 'Invite has already been used'
      };
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);

    if (now > expiresAt) {
      return {
        invite_id: invite.id,
        email: invite.email,
        role: invite.role,
        entity_name: '',
        expires_at: invite.expires_at,
        is_valid: false,
        error: 'Invite has expired'
      };
    }

    // Get entity name
    const entityName = invite.role === 'RESTAURANT'
      ? (invite.restaurants as any)?.name || 'Unknown Restaurant'
      : (invite.suppliers as any)?.namn || 'Unknown Supplier';

    return {
      invite_id: invite.id,
      email: invite.email,
      role: invite.role,
      entity_name: entityName,
      expires_at: invite.expires_at,
      is_valid: true
    };
  }

  /**
   * Accept invite: Create Supabase auth user and link to entity
   */
  async acceptInvite(input: AcceptInviteInput): Promise<{ user_id: string; email: string; role: string }> {
    const supabase = getSupabaseAdmin();

    // 1. Verify invite token
    const verifyResult = await this.verifyInvite(input.token);

    if (!verifyResult.is_valid) {
      throw new Error(verifyResult.error || 'Invalid invite');
    }

    // 2. Check if user already exists with this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(
      u => u.email?.toLowerCase() === verifyResult.email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      // User exists - just link to entity
      userId = existingUser.id;
    } else {
      // 3. Create new auth user
      const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
        email: verifyResult.email,
        password: input.password,
        email_confirm: true,  // Auto-confirm email for invited users
        user_metadata: {
          user_type: verifyResult.role.toLowerCase(),
          name: input.name || verifyResult.email.split('@')[0],
          invited: true
        }
      });

      if (signUpError || !newUser.user) {
        console.error('Failed to create user:', signUpError);
        throw new Error(`Failed to create user: ${signUpError?.message || 'Unknown error'}`);
      }

      userId = newUser.user.id;
    }

    // 4. Link user to restaurant or supplier
    const tokenHash = hashToken(input.token);

    const { data: invite } = await supabase
      .from('invites')
      .select('role, restaurant_id, supplier_id, tenant_id')
      .eq('token_hash', tokenHash)
      .single();

    if (!invite) {
      throw new Error('Invite not found');
    }

    if (invite.role === 'RESTAURANT') {
      // Link to restaurant_users
      const { error: linkError } = await supabase
        .from('restaurant_users')
        .upsert({
          id: userId,
          restaurant_id: invite.restaurant_id!,
          role: 'admin',
          is_active: true
        });

      if (linkError) {
        console.error('Failed to link restaurant user:', linkError);
        throw new Error(`Failed to link user to restaurant: ${linkError.message}`);
      }

      // Also update restaurants table if user is primary (for backwards compat)
      await supabase
        .from('restaurants')
        .update({ tenant_id: invite.tenant_id })
        .eq('id', invite.restaurant_id!);

    } else if (invite.role === 'SUPPLIER') {
      // Link to supplier_users
      const { error: linkError } = await supabase
        .from('supplier_users')
        .upsert({
          id: userId,
          supplier_id: invite.supplier_id!,
          role: 'admin',
          is_active: true
        });

      if (linkError) {
        console.error('Failed to link supplier user:', linkError);
        throw new Error(`Failed to link user to supplier: ${linkError.message}`);
      }
    }

    // 5. Mark invite as used
    const { error: updateError } = await supabase
      .from('invites')
      .update({
        used_at: new Date().toISOString(),
        used_by_user_id: userId
      })
      .eq('token_hash', tokenHash);

    if (updateError) {
      console.error('Failed to mark invite as used:', updateError);
      // Don't throw - user creation succeeded
    }

    return {
      user_id: userId,
      email: verifyResult.email,
      role: verifyResult.role
    };
  }

  /**
   * Get recent invites for admin UI
   */
  async getRecentInvites(tenantId: string, limit: number = 20): Promise<any[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('invites')
      .select(`
        id,
        email,
        role,
        expires_at,
        used_at,
        created_at,
        restaurants (name),
        suppliers (namn)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch invites:', error);
      throw new Error(`Failed to fetch invites: ${error.message}`);
    }

    return (data || []).map(invite => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      entity_name: invite.role === 'RESTAURANT'
        ? (invite.restaurants as any)?.name || 'Unknown'
        : (invite.suppliers as any)?.namn || 'Unknown',
      status: invite.used_at
        ? 'used'
        : new Date(invite.expires_at) < new Date()
        ? 'expired'
        : 'pending',
      expires_at: invite.expires_at,
      used_at: invite.used_at,
      created_at: invite.created_at
    }));
  }
}

export const inviteService = new InviteService();
