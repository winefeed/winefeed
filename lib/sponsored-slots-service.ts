/**
 * SPONSORED SLOTS SERVICE
 *
 * Handles sponsored category placements for suppliers.
 * Integrates with subscription tiers for entitlements.
 *
 * Key concepts:
 * - Categories have sponsor_cap (max slots)
 * - Suppliers have entitlements (included from tier + purchased)
 * - Premium tier includes 1 sponsored slot
 * - Additional slots can be purchased via Stripe
 */

import { createClient } from '@supabase/supabase-js';
import { subscriptionService } from './subscription-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Types
export interface SponsoredCategory {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  sponsor_cap: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  price_monthly_sek: number;
  price_yearly_sek: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  active_slot_count?: number;
  is_full?: boolean;
}

export interface SponsoredSlot {
  id: string;
  tenant_id: string;
  supplier_id: string;
  category_id: string;
  slot_type: 'INCLUDED' | 'PURCHASED';
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  stripe_subscription_id: string | null;
  stripe_subscription_item_id: string | null;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  category?: SponsoredCategory;
}

export interface SupplierEntitlement {
  id: string;
  tenant_id: string;
  supplier_id: string;
  included_slots: number;
  purchased_slots: number;
  created_at: string;
  updated_at: string;
  // Computed
  total_slots?: number;
  used_slots?: number;
  remaining_slots?: number;
}

export interface SlotAssignmentResult {
  success: boolean;
  slot?: SponsoredSlot;
  error?: string;
}

// ============================================
// CATEGORIES
// ============================================

/**
 * List all active sponsored categories
 */
export async function listCategories(tenantId: string): Promise<SponsoredCategory[]> {
  const { data: categories, error } = await supabase
    .from('sponsored_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching sponsored categories:', error);
    throw new Error('Failed to fetch categories');
  }

  // Enrich with slot counts
  const enriched = await Promise.all(
    (categories || []).map(async (cat) => {
      const activeCount = await getActiveSlotCount(cat.id);
      return {
        ...cat,
        active_slot_count: activeCount,
        is_full: activeCount >= cat.sponsor_cap
      };
    })
  );

  return enriched;
}

/**
 * Get a single category by slug
 */
export async function getCategoryBySlug(
  tenantId: string,
  slug: string
): Promise<SponsoredCategory | null> {
  const { data, error } = await supabase
    .from('sponsored_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch category: ${error.message}`);
  }

  const activeCount = await getActiveSlotCount(data.id);
  return {
    ...data,
    active_slot_count: activeCount,
    is_full: activeCount >= data.sponsor_cap
  };
}

/**
 * Count active slots in a category
 */
export async function getActiveSlotCount(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('sponsored_slots')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('status', 'ACTIVE')
    .or('expires_at.is.null,expires_at.gt.now()');

  if (error) {
    console.error('Error counting slots:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get suppliers sponsoring a category (for display)
 */
export async function getCategorySponsors(categoryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('sponsored_slots')
    .select('supplier_id')
    .eq('category_id', categoryId)
    .eq('status', 'ACTIVE')
    .or('expires_at.is.null,expires_at.gt.now()');

  if (error) {
    console.error('Error fetching sponsors:', error);
    return [];
  }

  return (data || []).map(s => s.supplier_id);
}

// ============================================
// ENTITLEMENTS
// ============================================

/**
 * Get supplier's entitlement (with computed values)
 */
export async function getSupplierEntitlement(
  supplierId: string,
  tenantId: string
): Promise<SupplierEntitlement> {
  // Get or create entitlement record
  let { data, error } = await supabase
    .from('supplier_entitlements')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('tenant_id', tenantId)
    .single();

  if (error && error.code === 'PGRST116') {
    // Create default entitlement
    const { data: created, error: createError } = await supabase
      .from('supplier_entitlements')
      .insert({
        tenant_id: tenantId,
        supplier_id: supplierId,
        included_slots: 0,
        purchased_slots: 0
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create entitlement: ${createError.message}`);
    }
    data = created;
  } else if (error) {
    throw new Error(`Failed to fetch entitlement: ${error.message}`);
  }

  // Count used slots
  const { count: usedCount } = await supabase
    .from('sponsored_slots')
    .select('*', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('status', 'ACTIVE')
    .or('expires_at.is.null,expires_at.gt.now()');

  const total = data.included_slots + data.purchased_slots;
  const used = usedCount || 0;

  return {
    ...data,
    total_slots: total,
    used_slots: used,
    remaining_slots: Math.max(0, total - used)
  };
}

/**
 * Sync entitlements from subscription tier
 * Called when subscription changes
 */
export async function syncEntitlementsFromSubscription(
  supplierId: string,
  tenantId: string
): Promise<void> {
  // Get current subscription tier
  const subscription = await subscriptionService.getSubscription(supplierId);
  const tierLimits = await subscriptionService.getTierLimits(subscription?.tier || 'free');

  const includedSlots = tierLimits?.included_sponsored_slots || 0;

  // Upsert entitlement
  const { error } = await supabase
    .from('supplier_entitlements')
    .upsert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      included_slots: includedSlots
    }, {
      onConflict: 'tenant_id,supplier_id'
    });

  if (error) {
    console.error('Error syncing entitlements:', error);
    throw new Error('Failed to sync entitlements');
  }

  // Log event
  await logSlotEvent(tenantId, {
    supplier_id: supplierId,
    event_type: 'ENTITLEMENT_UPDATED',
    metadata: {
      included_slots: includedSlots,
      tier: subscription?.tier || 'free'
    }
  });
}

/**
 * Add purchased slots (from Stripe webhook)
 */
export async function addPurchasedSlots(
  supplierId: string,
  tenantId: string,
  slotsToAdd: number
): Promise<void> {
  // Get current entitlement
  const entitlement = await getSupplierEntitlement(supplierId, tenantId);

  const { error } = await supabase
    .from('supplier_entitlements')
    .update({
      purchased_slots: entitlement.purchased_slots + slotsToAdd
    })
    .eq('supplier_id', supplierId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to add purchased slots: ${error.message}`);
  }

  await logSlotEvent(tenantId, {
    supplier_id: supplierId,
    event_type: 'ENTITLEMENT_UPDATED',
    metadata: {
      action: 'add_purchased',
      slots_added: slotsToAdd,
      new_total: entitlement.purchased_slots + slotsToAdd
    }
  });
}

// ============================================
// SLOTS
// ============================================

/**
 * Get all active slots for a supplier
 */
export async function getSupplierSlots(supplierId: string): Promise<SponsoredSlot[]> {
  const { data, error } = await supabase
    .from('sponsored_slots')
    .select(`
      *,
      category:sponsored_categories(*)
    `)
    .eq('supplier_id', supplierId)
    .eq('status', 'ACTIVE')
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch slots: ${error.message}`);
  }

  return data || [];
}

/**
 * Assign a slot to a category
 * Validates entitlement and category cap
 */
export async function assignSlot(
  supplierId: string,
  categoryId: string,
  tenantId: string,
  slotType: 'INCLUDED' | 'PURCHASED' = 'INCLUDED',
  stripeSubscriptionId?: string
): Promise<SlotAssignmentResult> {
  // 1. Check supplier has remaining slots
  const entitlement = await getSupplierEntitlement(supplierId, tenantId);
  if (entitlement.remaining_slots <= 0) {
    return {
      success: false,
      error: 'No remaining slot entitlement. Purchase more slots or upgrade your plan.'
    };
  }

  // 2. Check category exists and is not full
  const { data: category, error: catError } = await supabase
    .from('sponsored_categories')
    .select('*')
    .eq('id', categoryId)
    .single();

  if (catError || !category) {
    return { success: false, error: 'Category not found' };
  }

  const activeCount = await getActiveSlotCount(categoryId);
  if (activeCount >= category.sponsor_cap) {
    return {
      success: false,
      error: `Category "${category.name}" is full (${category.sponsor_cap}/${category.sponsor_cap} slots)`
    };
  }

  // 3. Check supplier doesn't already have slot in this category
  const { data: existingSlot } = await supabase
    .from('sponsored_slots')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('category_id', categoryId)
    .eq('status', 'ACTIVE')
    .single();

  if (existingSlot) {
    return {
      success: false,
      error: 'You already have a slot in this category'
    };
  }

  // 4. Create the slot
  const { data: slot, error: slotError } = await supabase
    .from('sponsored_slots')
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      category_id: categoryId,
      slot_type: slotType,
      status: 'ACTIVE',
      stripe_subscription_id: stripeSubscriptionId || null,
      starts_at: new Date().toISOString()
    })
    .select(`
      *,
      category:sponsored_categories(*)
    `)
    .single();

  if (slotError) {
    console.error('Error creating slot:', slotError);
    return { success: false, error: 'Failed to create slot' };
  }

  // 5. Log event
  await logSlotEvent(tenantId, {
    slot_id: slot.id,
    supplier_id: supplierId,
    category_id: categoryId,
    event_type: 'SLOT_ASSIGNED',
    metadata: {
      slot_type: slotType,
      category_name: category.name
    }
  });

  return { success: true, slot };
}

/**
 * Unassign (cancel) a slot
 */
export async function unassignSlot(
  slotId: string,
  supplierId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  // Verify ownership
  const { data: slot, error: fetchError } = await supabase
    .from('sponsored_slots')
    .select('*')
    .eq('id', slotId)
    .eq('supplier_id', supplierId)
    .single();

  if (fetchError || !slot) {
    return { success: false, error: 'Slot not found' };
  }

  if (slot.status !== 'ACTIVE') {
    return { success: false, error: 'Slot is not active' };
  }

  // Update status to CANCELLED
  const { error: updateError } = await supabase
    .from('sponsored_slots')
    .update({ status: 'CANCELLED' })
    .eq('id', slotId);

  if (updateError) {
    return { success: false, error: 'Failed to cancel slot' };
  }

  // Log event
  await logSlotEvent(tenantId, {
    slot_id: slotId,
    supplier_id: supplierId,
    category_id: slot.category_id,
    event_type: 'SLOT_CANCELLED'
  });

  return { success: true };
}

/**
 * Expire slots (called by cron or webhook)
 */
export async function expireSlots(): Promise<number> {
  const { data, error } = await supabase
    .from('sponsored_slots')
    .update({ status: 'EXPIRED' })
    .eq('status', 'ACTIVE')
    .lt('expires_at', new Date().toISOString())
    .select('id, supplier_id, category_id, tenant_id');

  if (error) {
    console.error('Error expiring slots:', error);
    return 0;
  }

  // Log events for each expired slot
  for (const slot of data || []) {
    await logSlotEvent(slot.tenant_id, {
      slot_id: slot.id,
      supplier_id: slot.supplier_id,
      category_id: slot.category_id,
      event_type: 'SLOT_EXPIRED'
    });
  }

  return data?.length || 0;
}

// ============================================
// SPONSORSHIP CHECK (for search/browse)
// ============================================

/**
 * Check if a supplier is a sponsor in a category
 */
export async function isSupplierSponsoring(
  supplierId: string,
  categorySlug: string,
  tenantId: string
): Promise<boolean> {
  const { data: category } = await supabase
    .from('sponsored_categories')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', categorySlug)
    .single();

  if (!category) return false;

  const { data } = await supabase
    .from('sponsored_slots')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('category_id', category.id)
    .eq('status', 'ACTIVE')
    .or('expires_at.is.null,expires_at.gt.now()')
    .single();

  return !!data;
}

/**
 * Get all category slugs a supplier is sponsoring
 */
export async function getSupplierSponsoredCategories(
  supplierId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('sponsored_slots')
    .select(`
      category:sponsored_categories(slug)
    `)
    .eq('supplier_id', supplierId)
    .eq('status', 'ACTIVE')
    .or('expires_at.is.null,expires_at.gt.now()');

  if (error || !data) return [];

  return data
    .map((s: any) => s.category?.slug)
    .filter(Boolean);
}

// ============================================
// EVENTS
// ============================================

interface SlotEventParams {
  slot_id?: string;
  supplier_id: string;
  category_id?: string;
  event_type: string;
  actor_user_id?: string;
  metadata?: Record<string, any>;
}

async function logSlotEvent(
  tenantId: string,
  params: SlotEventParams
): Promise<void> {
  try {
    await supabase.from('sponsored_slot_events').insert({
      tenant_id: tenantId,
      slot_id: params.slot_id || null,
      supplier_id: params.supplier_id,
      category_id: params.category_id || null,
      event_type: params.event_type,
      actor_user_id: params.actor_user_id || null,
      metadata: params.metadata || {}
    });
  } catch (error) {
    console.error('Failed to log slot event:', error);
    // Non-critical, don't throw
  }
}

// Export service object
export const sponsoredSlotsService = {
  // Categories
  listCategories,
  getCategoryBySlug,
  getActiveSlotCount,
  getCategorySponsors,

  // Entitlements
  getSupplierEntitlement,
  syncEntitlementsFromSubscription,
  addPurchasedSlots,

  // Slots
  getSupplierSlots,
  assignSlot,
  unassignSlot,
  expireSlots,

  // Sponsorship checks
  isSupplierSponsoring,
  getSupplierSponsoredCategories
};
