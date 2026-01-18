/**
 * ADMIN SERVICE - Production-Ready Admin Access Control
 *
 * Provides isAdmin() helper for checking admin privileges.
 *
 * Rules:
 * - Development (NODE_ENV !== 'production'): ADMIN_MODE=true fallback
 * - Production: User must exist in admin_users table for the tenant
 *
 * Security:
 * - Multi-tenant scoped (admins are per-tenant)
 * - Uses service role for admin_users table access
 * - No direct user access to admin_users (via RLS)
 *
 * Usage:
 * ```typescript
 * const actor = await actorService.resolveActor({ user_id, tenant_id });
 * const isAdmin = await adminService.isAdmin(actor);
 * if (!isAdmin) {
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 * }
 * ```
 */

import { ActorContext } from './actor-service';
import { getSupabaseAdmin } from './supabase-server';

// ============================================================================
// SERVICE CLASS
// ============================================================================

class AdminService {
  /**
   * Check if user has admin privileges for their tenant
   *
   * @param actor - Actor context from actorService.resolveActor()
   * @returns true if user is admin (via ADMIN_MODE in dev or admin_users table in prod)
   */
  async isAdmin(actor: ActorContext): Promise<boolean> {
    // Development fallback: ADMIN_MODE=true bypasses table check
    // Only active when NODE_ENV !== 'production'
    if (process.env.NODE_ENV !== 'production' && process.env.ADMIN_MODE === 'true') {
      return true;
    }

    // Production: Check admin_users table
    try {
      const supabase = getSupabaseAdmin();

      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('tenant_id', actor.tenant_id)
        .eq('user_id', actor.user_id)
        .maybeSingle();

      if (error) {
        console.error('[AdminService] Error checking admin status:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('[AdminService] Unexpected error in isAdmin:', error);
      return false;
    }
  }

  /**
   * Grant admin access to a user (must be called by existing admin)
   *
   * @param grantedBy - Actor granting admin access (must be admin)
   * @param userId - User ID to grant admin access to
   * @param tenantId - Tenant ID (defaults to grantedBy's tenant)
   * @returns Created admin_users record ID or throws error
   */
  async grantAdmin(
    grantedBy: ActorContext,
    userId: string,
    tenantId?: string
  ): Promise<string> {
    // Verify caller is admin
    const isCallerAdmin = await this.isAdmin(grantedBy);
    if (!isCallerAdmin) {
      throw new Error('Only admins can grant admin access');
    }

    const targetTenantId = tenantId || grantedBy.tenant_id;

    // Verify caller has admin access to target tenant
    if (targetTenantId !== grantedBy.tenant_id) {
      throw new Error('Cannot grant admin access to different tenant');
    }

    try {
      const supabase = getSupabaseAdmin();

      const { data, error } = await supabase
        .from('admin_users')
        .insert({
          tenant_id: targetTenantId,
          user_id: userId,
          created_by_user_id: grantedBy.user_id,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          throw new Error('User is already an admin for this tenant');
        }
        throw new Error(`Failed to grant admin access: ${error.message}`);
      }

      return data.id;
    } catch (error: any) {
      console.error('[AdminService] Error granting admin access:', error);
      throw error;
    }
  }

  /**
   * Revoke admin access from a user
   *
   * @param revokedBy - Actor revoking admin access (must be admin)
   * @param userId - User ID to revoke admin access from
   * @param tenantId - Tenant ID (defaults to revokedBy's tenant)
   */
  async revokeAdmin(
    revokedBy: ActorContext,
    userId: string,
    tenantId?: string
  ): Promise<void> {
    // Verify caller is admin
    const isCallerAdmin = await this.isAdmin(revokedBy);
    if (!isCallerAdmin) {
      throw new Error('Only admins can revoke admin access');
    }

    const targetTenantId = tenantId || revokedBy.tenant_id;

    // Verify caller has admin access to target tenant
    if (targetTenantId !== revokedBy.tenant_id) {
      throw new Error('Cannot revoke admin access from different tenant');
    }

    // Prevent self-revoke (safety check)
    if (userId === revokedBy.user_id) {
      throw new Error('Cannot revoke your own admin access');
    }

    try {
      const supabase = getSupabaseAdmin();

      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('tenant_id', targetTenantId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to revoke admin access: ${error.message}`);
      }
    } catch (error: any) {
      console.error('[AdminService] Error revoking admin access:', error);
      throw error;
    }
  }

  /**
   * List all admins for a tenant
   *
   * @param actor - Actor requesting admin list (must be admin)
   * @returns List of admin user IDs
   */
  async listAdmins(actor: ActorContext): Promise<string[]> {
    // Verify caller is admin
    const isCallerAdmin = await this.isAdmin(actor);
    if (!isCallerAdmin) {
      throw new Error('Only admins can list admins');
    }

    try {
      const supabase = getSupabaseAdmin();

      const { data, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('tenant_id', actor.tenant_id);

      if (error) {
        throw new Error(`Failed to list admins: ${error.message}`);
      }

      return (data || []).map((row) => row.user_id);
    } catch (error: any) {
      console.error('[AdminService] Error listing admins:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();
