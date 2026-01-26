/**
 * ACTOR SERVICE - Current User Context Resolution
 *
 * Resolves authenticated user's roles and entity IDs from database mappings.
 * Used by both client (via /api/me/actor) and server (direct calls).
 *
 * Resolution Sources (via user_roles_computed view):
 * 1. restaurant_users → RESTAURANT role + restaurant_id
 * 2. supplier_users → SELLER role + supplier_id
 * 3. org_number match → IOR role + importer_id
 * 4. admin_users → ADMIN role
 * 5. user_roles → explicit role assignments
 *
 * Security:
 * - Tenant isolation enforced
 * - Single optimized query via user_roles_computed view
 * - Only returns data for authenticated user
 * - No sensitive data (passwords, tokens) returned
 */

import { getSupabaseAdmin } from './supabase-server';

// ============================================================================
// TYPES
// ============================================================================

export type ActorRole = 'RESTAURANT' | 'SELLER' | 'IOR' | 'ADMIN';

export interface ActorContext {
  tenant_id: string;
  user_id: string;
  roles: ActorRole[];
  restaurant_id?: string;
  supplier_id?: string;
  importer_id?: string;
  user_email?: string;
}

export interface ResolveActorInput {
  user_id: string;
  tenant_id: string;
  user_email?: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class ActorService {
  /**
   * Resolve actor context for authenticated user
   * Returns all roles and entity IDs that user has access to
   *
   * Uses user_roles_computed view for efficient single-query resolution.
   * Falls back to legacy multi-query approach if view unavailable.
   */
  async resolveActor(input: ResolveActorInput): Promise<ActorContext> {
    const { user_id, tenant_id, user_email } = input;

    // Try optimized path using user_roles_computed view
    try {
      const result = await this.resolveActorFromView(user_id, tenant_id, user_email);
      if (result) {
        return result;
      }
    } catch (error) {
      // View might not exist yet - fall back to legacy
      console.debug('[ActorService] Falling back to legacy resolution');
    }

    // Legacy fallback (multiple queries)
    return this.resolveActorLegacy(input);
  }

  /**
   * Optimized resolution using user_roles_computed view (single query)
   */
  private async resolveActorFromView(
    user_id: string,
    tenant_id: string,
    user_email?: string
  ): Promise<ActorContext | null> {
    const { data: roleRows, error } = await getSupabaseAdmin()
      .from('user_roles_computed')
      .select('role, entity_type, entity_id')
      .eq('user_id', user_id);

    if (error) {
      // View doesn't exist or query failed
      return null;
    }

    if (!roleRows || roleRows.length === 0) {
      // No roles found - return empty context
      // (still check ADMIN_MODE in dev)
      const { adminService } = await import('./admin-service');
      const emptyActor: ActorContext = {
        tenant_id,
        user_id,
        roles: [],
        user_email
      };

      const isAdmin = await adminService.isAdmin(emptyActor);
      if (isAdmin) {
        emptyActor.roles.push('ADMIN');
      }

      return emptyActor;
    }

    // Build context from view results
    const roles: ActorRole[] = [];
    let restaurant_id: string | undefined;
    let supplier_id: string | undefined;
    let importer_id: string | undefined;

    for (const row of roleRows) {
      const role = row.role as ActorRole;

      // Add role if not already present
      if (!roles.includes(role)) {
        roles.push(role);
      }

      // Extract entity IDs
      if (row.entity_type === 'restaurant' && row.entity_id) {
        restaurant_id = row.entity_id;
      } else if (row.entity_type === 'supplier' && row.entity_id) {
        supplier_id = row.entity_id;
      } else if (row.entity_type === 'importer' && row.entity_id) {
        importer_id = row.entity_id;
      }
    }

    // Check ADMIN_MODE in dev (even if not in admin_users)
    if (!roles.includes('ADMIN')) {
      const { adminService } = await import('./admin-service');
      const preliminaryActor: ActorContext = {
        tenant_id,
        user_id,
        roles,
        restaurant_id,
        supplier_id,
        importer_id,
        user_email
      };

      const isAdmin = await adminService.isAdmin(preliminaryActor);
      if (isAdmin) {
        roles.push('ADMIN');
      }
    }

    return {
      tenant_id,
      user_id,
      roles,
      restaurant_id,
      supplier_id,
      importer_id,
      user_email
    };
  }

  /**
   * Legacy resolution (multiple queries) - fallback when view unavailable
   */
  private async resolveActorLegacy(input: ResolveActorInput): Promise<ActorContext> {
    const { user_id, tenant_id, user_email } = input;

    const roles: ActorRole[] = [];
    let restaurant_id: string | undefined;
    let supplier_id: string | undefined;
    let importer_id: string | undefined;

    // 1. Check RESTAURANT role (restaurant_users table)
    try {
      const { data: restaurantUser } = await getSupabaseAdmin()
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', user_id)
        .eq('tenant_id', tenant_id)
        .single();

      if (restaurantUser) {
        roles.push('RESTAURANT');
        restaurant_id = restaurantUser.restaurant_id;
      }
    } catch (error) {
      // User not in restaurant_users - skip
    }

    // 2. Check SELLER role (supplier_users table)
    // Note: supplier_users.id = auth.users.id (not user_id column)
    try {
      const { data: supplierUser } = await getSupabaseAdmin()
        .from('supplier_users')
        .select('supplier_id')
        .eq('id', user_id)
        .single();

      if (supplierUser) {
        roles.push('SELLER');
        supplier_id = supplierUser.supplier_id;
      }
    } catch (error) {
      // User not in supplier_users - skip
    }

    // 3. Check IOR role (dual-role via org_number matching)
    // If user is a SELLER, check if their supplier's org_number matches an importer
    if (supplier_id) {
      try {
        // Get supplier's org_number
        const { data: supplier } = await getSupabaseAdmin()
          .from('suppliers')
          .select('org_number, type')
          .eq('id', supplier_id)
          .single();

        if (supplier && supplier.org_number) {
          // Check if this org_number exists in importers table
          const { data: importer } = await getSupabaseAdmin()
            .from('importers')
            .select('id, tenant_id')
            .eq('org_number', supplier.org_number)
            .eq('tenant_id', tenant_id)
            .single();

          if (importer) {
            roles.push('IOR');
            importer_id = importer.id;
          }
        }
      } catch (error) {
        // No matching importer - user is SELLER only
      }
    }

    // 4. Check ADMIN role (admin_users table + ADMIN_MODE fallback in dev)
    // Import adminService inline to avoid circular dependency
    const { adminService } = await import('./admin-service');

    // Build preliminary actor context for isAdmin check
    const preliminaryActor = {
      tenant_id,
      user_id,
      roles,
      restaurant_id,
      supplier_id,
      importer_id,
      user_email
    };

    const isAdmin = await adminService.isAdmin(preliminaryActor);
    if (isAdmin) {
      roles.push('ADMIN');
    }

    // Return actor context
    return {
      tenant_id,
      user_id,
      roles,
      restaurant_id,
      supplier_id,
      importer_id,
      user_email
    };
  }

  /**
   * Verify user has required role
   */
  hasRole(actor: ActorContext, role: ActorRole): boolean {
    return actor.roles.includes(role);
  }

  /**
   * Verify user has IOR access
   */
  hasIORAccess(actor: ActorContext): boolean {
    return this.hasRole(actor, 'IOR') && !!actor.importer_id;
  }

  /**
   * Get entity ID for role
   */
  getEntityId(actor: ActorContext, role: ActorRole): string | undefined {
    switch (role) {
      case 'RESTAURANT':
        return actor.restaurant_id;
      case 'SELLER':
        return actor.supplier_id;
      case 'IOR':
        return actor.importer_id;
      default:
        return undefined;
    }
  }

  /**
   * Verify user has any of the required roles
   */
  hasAnyRole(actor: ActorContext, roles: ActorRole[]): boolean {
    return roles.some((role) => actor.roles.includes(role));
  }

  /**
   * Verify user has all of the required roles
   */
  hasAllRoles(actor: ActorContext, roles: ActorRole[]): boolean {
    return roles.every((role) => actor.roles.includes(role));
  }

  /**
   * Check if actor can access a specific entity
   */
  canAccessEntity(
    actor: ActorContext,
    entityType: 'restaurant' | 'supplier' | 'importer',
    entityId: string
  ): boolean {
    switch (entityType) {
      case 'restaurant':
        return actor.restaurant_id === entityId || this.hasRole(actor, 'ADMIN');
      case 'supplier':
        return actor.supplier_id === entityId || this.hasRole(actor, 'ADMIN');
      case 'importer':
        return actor.importer_id === entityId || this.hasRole(actor, 'ADMIN');
      default:
        return false;
    }
  }

  /**
   * Get role display label (Swedish)
   */
  getRoleLabel(role: ActorRole): string {
    switch (role) {
      case 'RESTAURANT':
        return 'Restaurang';
      case 'SELLER':
        return 'Leverantör';
      case 'IOR':
        return 'Importör';
      case 'ADMIN':
        return 'Admin';
      default:
        return role;
    }
  }
}

export const actorService = new ActorService();
