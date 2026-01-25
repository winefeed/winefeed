import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ActorContext, ActorRole } from '@/lib/actor-service';

/**
 * Unit Tests: Actor Service
 *
 * Tests for role resolution, access control, and tenant isolation.
 * Mocks Supabase to test service logic in isolation.
 */

// Mock Supabase module
const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
}));

vi.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

// Mock admin-service
vi.mock('@/lib/admin-service', () => ({
  adminService: {
    isAdmin: vi.fn().mockResolvedValue(false),
  },
}));

// Import after mocks are set up
import { actorService } from '@/lib/actor-service';
import { adminService } from '@/lib/admin-service';

describe('ActorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // hasRole() Tests
  // ==========================================================================
  describe('hasRole', () => {
    it('returns true when actor has the specified role', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: ['ADMIN', 'SELLER'],
      };

      expect(actorService.hasRole(actor, 'ADMIN')).toBe(true);
      expect(actorService.hasRole(actor, 'SELLER')).toBe(true);
    });

    it('returns false when actor does not have the specified role', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: ['SELLER'],
      };

      expect(actorService.hasRole(actor, 'ADMIN')).toBe(false);
      expect(actorService.hasRole(actor, 'RESTAURANT')).toBe(false);
      expect(actorService.hasRole(actor, 'IOR')).toBe(false);
    });

    it('handles empty roles array', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: [],
      };

      expect(actorService.hasRole(actor, 'ADMIN')).toBe(false);
      expect(actorService.hasRole(actor, 'SELLER')).toBe(false);
    });

    it('handles all role types correctly', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: ['RESTAURANT', 'SELLER', 'IOR', 'ADMIN'],
        restaurant_id: 'rest-1',
        supplier_id: 'sup-1',
        importer_id: 'imp-1',
      };

      const allRoles: ActorRole[] = ['RESTAURANT', 'SELLER', 'IOR', 'ADMIN'];
      allRoles.forEach((role) => {
        expect(actorService.hasRole(actor, role)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // hasIORAccess() Tests
  // ==========================================================================
  describe('hasIORAccess', () => {
    it('returns true when actor has IOR role AND importer_id', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: ['IOR', 'SELLER'],
        supplier_id: 'sup-1',
        importer_id: 'imp-1',
      };

      expect(actorService.hasIORAccess(actor)).toBe(true);
    });

    it('returns false when actor has IOR role but no importer_id', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: ['IOR', 'SELLER'],
        supplier_id: 'sup-1',
        // No importer_id
      };

      expect(actorService.hasIORAccess(actor)).toBe(false);
    });

    it('returns false when actor has importer_id but no IOR role', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: ['SELLER'],
        supplier_id: 'sup-1',
        importer_id: 'imp-1', // Has importer_id but not IOR role
      };

      expect(actorService.hasIORAccess(actor)).toBe(false);
    });

    it('returns false when actor has neither IOR role nor importer_id', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: ['SELLER'],
        supplier_id: 'sup-1',
      };

      expect(actorService.hasIORAccess(actor)).toBe(false);
    });
  });

  // ==========================================================================
  // getEntityId() Tests
  // ==========================================================================
  describe('getEntityId', () => {
    const actor: ActorContext = {
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      roles: ['RESTAURANT', 'SELLER', 'IOR'],
      restaurant_id: 'rest-123',
      supplier_id: 'sup-456',
      importer_id: 'imp-789',
    };

    it('returns restaurant_id for RESTAURANT role', () => {
      expect(actorService.getEntityId(actor, 'RESTAURANT')).toBe('rest-123');
    });

    it('returns supplier_id for SELLER role', () => {
      expect(actorService.getEntityId(actor, 'SELLER')).toBe('sup-456');
    });

    it('returns importer_id for IOR role', () => {
      expect(actorService.getEntityId(actor, 'IOR')).toBe('imp-789');
    });

    it('returns undefined for ADMIN role', () => {
      expect(actorService.getEntityId(actor, 'ADMIN')).toBeUndefined();
    });

    it('returns undefined when entity_id is not set', () => {
      const actorWithoutIds: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: [],
      };

      expect(actorService.getEntityId(actorWithoutIds, 'RESTAURANT')).toBeUndefined();
      expect(actorService.getEntityId(actorWithoutIds, 'SELLER')).toBeUndefined();
      expect(actorService.getEntityId(actorWithoutIds, 'IOR')).toBeUndefined();
    });
  });

  // ==========================================================================
  // resolveActor() Tests (with mocked Supabase)
  // ==========================================================================
  describe('resolveActor', () => {
    it('resolves RESTAURANT role from restaurant_users table', async () => {
      // Setup mock chain for restaurant_users query
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { restaurant_id: 'rest-abc' },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(mockChain);

      const result = await actorService.resolveActor({
        user_id: 'user-1',
        tenant_id: 'tenant-1',
      });

      expect(result.roles).toContain('RESTAURANT');
      expect(result.restaurant_id).toBe('rest-abc');
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.user_id).toBe('user-1');
    });

    it('resolves SELLER role from supplier_users table', async () => {
      // First call (restaurant_users) returns null
      // Second call (supplier_users) returns supplier_id
      let callCount = 0;
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // restaurant_users - not found
            return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
          } else if (callCount === 2) {
            // supplier_users - found
            return Promise.resolve({ data: { supplier_id: 'sup-xyz' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      }));

      const result = await actorService.resolveActor({
        user_id: 'user-1',
        tenant_id: 'tenant-1',
      });

      expect(result.roles).toContain('SELLER');
      expect(result.supplier_id).toBe('sup-xyz');
    });

    it('resolves IOR role when supplier org_number matches importer', async () => {
      // Setup complex mock chain for IOR resolution
      let callCount = 0;
      mockFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (table === 'restaurant_users') {
            return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
          }
          if (table === 'supplier_users') {
            return Promise.resolve({ data: { supplier_id: 'sup-1' }, error: null });
          }
          if (table === 'suppliers') {
            return Promise.resolve({ data: { org_number: '556123-4567', type: 'EU_PRODUCER' }, error: null });
          }
          if (table === 'importers') {
            return Promise.resolve({ data: { id: 'imp-1', tenant_id: 'tenant-1' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      }));

      const result = await actorService.resolveActor({
        user_id: 'user-1',
        tenant_id: 'tenant-1',
      });

      expect(result.roles).toContain('SELLER');
      expect(result.roles).toContain('IOR');
      expect(result.supplier_id).toBe('sup-1');
      expect(result.importer_id).toBe('imp-1');
    });

    it('includes ADMIN role when adminService.isAdmin returns true', async () => {
      // Mock isAdmin to return true
      vi.mocked(adminService.isAdmin).mockResolvedValue(true);

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      const result = await actorService.resolveActor({
        user_id: 'admin-user',
        tenant_id: 'tenant-1',
        user_email: 'admin@example.com',
      });

      expect(result.roles).toContain('ADMIN');
      expect(result.user_email).toBe('admin@example.com');
    });

    it('preserves tenant isolation in queries', async () => {
      const eqCalls: string[] = [];

      // Create a chainable mock that tracks ALL eq calls
      const createTrackingChain = () => {
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn((field: string, value: string) => {
            eqCalls.push(`${field}=${value}`);
            return chain;
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        };
        return chain;
      };

      mockFrom.mockReturnValue(createTrackingChain());

      await actorService.resolveActor({
        user_id: 'user-1',
        tenant_id: 'tenant-specific',
      });

      // Verify tenant_id is used in queries
      expect(eqCalls.some((call) => call.includes('tenant_id=tenant-specific'))).toBe(true);
    });

    it('returns empty roles array when user has no mappings', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      const result = await actorService.resolveActor({
        user_id: 'orphan-user',
        tenant_id: 'tenant-1',
      });

      // Should have no roles (except possibly ADMIN which is mocked to false)
      expect(result.roles.filter((r) => r !== 'ADMIN')).toHaveLength(0);
      expect(result.restaurant_id).toBeUndefined();
      expect(result.supplier_id).toBeUndefined();
      expect(result.importer_id).toBeUndefined();
    });

    it('handles user with multiple roles correctly', async () => {
      // User is both a restaurant user and a seller
      let callCount = 0;
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // restaurant_users - found
            return Promise.resolve({ data: { restaurant_id: 'rest-1' }, error: null });
          } else if (callCount === 2) {
            // supplier_users - found
            return Promise.resolve({ data: { supplier_id: 'sup-1' }, error: null });
          }
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        }),
      }));

      const result = await actorService.resolveActor({
        user_id: 'multi-role-user',
        tenant_id: 'tenant-1',
      });

      expect(result.roles).toContain('RESTAURANT');
      expect(result.roles).toContain('SELLER');
      expect(result.restaurant_id).toBe('rest-1');
      expect(result.supplier_id).toBe('sup-1');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles null/undefined in actor context gracefully', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: ['RESTAURANT'],
        restaurant_id: undefined,
      };

      // Should not throw
      expect(() => actorService.hasRole(actor, 'RESTAURANT')).not.toThrow();
      expect(() => actorService.getEntityId(actor, 'RESTAURANT')).not.toThrow();
      expect(actorService.getEntityId(actor, 'RESTAURANT')).toBeUndefined();
    });

    it('role check is case-sensitive', () => {
      const actor: ActorContext = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        roles: ['ADMIN'],
      };

      // TypeScript enforces this, but testing for clarity
      expect(actorService.hasRole(actor, 'ADMIN')).toBe(true);
      // @ts-expect-error - Testing lowercase intentionally
      expect(actorService.hasRole(actor, 'admin')).toBe(false);
    });
  });
});
