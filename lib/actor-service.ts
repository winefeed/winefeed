/**
 * ACTOR SERVICE - Current User Context Resolution
 *
 * Resolves authenticated user's roles and entity IDs from database mappings.
 * Used by both client (via /api/me/actor) and server (direct calls).
 *
 * Resolution Rules:
 * 1. RESTAURANT role: User in restaurant_users table → restaurant_id
 * 2. SELLER role: User in supplier_users table → supplier_id
 * 3. IOR role: Match org_number between suppliers and importers (dual-role)
 *             OR explicit mapping if available
 * 4. ADMIN role: Check admin flag (ADMIN_MODE=true or explicit role)
 *
 * Security:
 * - Tenant isolation enforced
 * - Only returns data for authenticated user
 * - No sensitive data (passwords, tokens) returned
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
   */
  async resolveActor(input: ResolveActorInput): Promise<ActorContext> {
    const { user_id, tenant_id, user_email } = input;

    const roles: ActorRole[] = [];
    let restaurant_id: string | undefined;
    let supplier_id: string | undefined;
    let importer_id: string | undefined;

    // 1. Check RESTAURANT role (restaurant_users table)
    try {
      const { data: restaurantUser } = await supabase
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
    try {
      const { data: supplierUser } = await supabase
        .from('supplier_users')
        .select('supplier_id')
        .eq('user_id', user_id)
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
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('org_number, type')
          .eq('id', supplier_id)
          .single();

        if (supplier && supplier.org_number) {
          // Check if this org_number exists in importers table
          const { data: importer } = await supabase
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
}

export const actorService = new ActorService();
