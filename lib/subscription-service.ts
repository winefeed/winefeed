/**
 * Subscription Service
 *
 * Handles subscription logic, tier checks, and usage tracking.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================================================
// Types
// ============================================================================

export type SubscriptionTier = 'free' | 'pro' | 'premium';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';

export interface Subscription {
  id: string;
  supplier_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface TierLimits {
  tier: SubscriptionTier;
  max_wines: number | null;
  max_leads_per_month: number | null;
  max_offers_per_month: number | null;
  priority_in_search: number;
  included_sponsored_slots: number;
  features: {
    analytics?: boolean;
    analytics_competitors?: boolean;
    extended_profile?: boolean;
    video_profile?: boolean;
    support?: string;
  };
}

export interface SupplierUsage {
  wines_count: number;
  leads_received: number;
  offers_sent: number;
}

export interface SubscriptionWithLimits extends Subscription {
  limits: TierLimits;
  usage: SupplierUsage;
  can_add_wine: boolean;
  can_receive_lead: boolean;
  can_send_offer: boolean;
}

// ============================================================================
// Tier Limits
// ============================================================================

const DEFAULT_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    tier: 'free',
    max_wines: null,
    max_leads_per_month: 5,
    max_offers_per_month: 10,
    priority_in_search: 0,
    included_sponsored_slots: 0,
    features: { analytics: false, extended_profile: false, support: 'self-service' },
  },
  pro: {
    tier: 'pro',
    max_wines: null,
    max_leads_per_month: null,
    max_offers_per_month: null,
    priority_in_search: 10,
    included_sponsored_slots: 0,
    features: { analytics: true, extended_profile: true, support: 'email' },
  },
  premium: {
    tier: 'premium',
    max_wines: null,
    max_leads_per_month: null,
    max_offers_per_month: null,
    priority_in_search: 20,
    included_sponsored_slots: 1,
    features: { analytics: true, analytics_competitors: true, extended_profile: true, video_profile: true, support: 'dedicated' },
  },
};

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get subscription for a supplier
 */
export async function getSubscription(supplierId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('supplier_id', supplierId)
    .single();

  if (error || !data) {
    // Return a default free subscription if none exists
    return {
      id: '',
      supplier_id: supplierId,
      tier: 'free',
      status: 'active',
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      stripe_customer_id: null,
      stripe_subscription_id: null,
    };
  }

  return data;
}

/**
 * Get tier limits from database or use defaults
 */
export async function getTierLimits(tier: SubscriptionTier): Promise<TierLimits> {
  const { data } = await supabase
    .from('tier_limits')
    .select('*')
    .eq('tier', tier)
    .single();

  return data || DEFAULT_LIMITS[tier];
}

/**
 * Get current usage for a supplier
 */
export async function getSupplierUsage(supplierId: string): Promise<SupplierUsage> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  // Get wine count
  const { count: winesCount } = await supabase
    .from('supplier_wines')
    .select('*', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('is_active', true);

  // Get usage record for current period
  const { data: usageData } = await supabase
    .from('subscription_usage')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('period_start', periodStart)
    .single();

  return {
    wines_count: winesCount || 0,
    leads_received: usageData?.leads_received || 0,
    offers_sent: usageData?.offers_sent || 0,
  };
}

/**
 * Get full subscription with limits and usage
 */
export async function getSubscriptionWithLimits(supplierId: string): Promise<SubscriptionWithLimits> {
  const subscription = await getSubscription(supplierId);
  const tier = subscription?.tier || 'free';
  const limits = await getTierLimits(tier);
  const usage = await getSupplierUsage(supplierId);

  const canAddWine = limits.max_wines === null || usage.wines_count < limits.max_wines;
  const canReceiveLead = limits.max_leads_per_month === null || usage.leads_received < limits.max_leads_per_month;
  const canSendOffer = limits.max_offers_per_month === null || usage.offers_sent < limits.max_offers_per_month;

  return {
    ...subscription!,
    limits,
    usage,
    can_add_wine: canAddWine,
    can_receive_lead: canReceiveLead,
    can_send_offer: canSendOffer,
  };
}

/**
 * Update or create subscription
 */
export async function upsertSubscription(
  supplierId: string,
  data: Partial<Subscription>
): Promise<Subscription> {
  const { data: result, error } = await supabase
    .from('subscriptions')
    .upsert({
      supplier_id: supplierId,
      ...data,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'supplier_id',
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
  supplierId: string,
  field: 'leads_received' | 'offers_sent'
): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Upsert usage record and increment
  await supabase.rpc('increment_subscription_usage', {
    p_supplier_id: supplierId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_field: field,
  });
}

/**
 * Check if supplier can perform action
 */
export async function canPerformAction(
  supplierId: string,
  action: 'add_wine' | 'receive_lead' | 'send_offer'
): Promise<{ allowed: boolean; reason?: string; upgrade_required?: boolean }> {
  const sub = await getSubscriptionWithLimits(supplierId);

  switch (action) {
    case 'add_wine':
      if (!sub.can_add_wine) {
        return {
          allowed: false,
          reason: `Du har nått gränsen på ${sub.limits.max_wines} viner. Uppgradera till Pro för obegränsat.`,
          upgrade_required: true,
        };
      }
      break;
    case 'receive_lead':
      if (!sub.can_receive_lead) {
        return {
          allowed: false,
          reason: `Du har nått gränsen på ${sub.limits.max_leads_per_month} leads denna månad. Uppgradera till Pro för obegränsat.`,
          upgrade_required: true,
        };
      }
      break;
    case 'send_offer':
      if (!sub.can_send_offer) {
        return {
          allowed: false,
          reason: `Du har nått gränsen på ${sub.limits.max_offers_per_month} offerter denna månad. Uppgradera till Pro för obegränsat.`,
          upgrade_required: true,
        };
      }
      break;
  }

  return { allowed: true };
}

/**
 * Check if supplier has feature
 */
export async function hasFeature(
  supplierId: string,
  feature: keyof TierLimits['features']
): Promise<boolean> {
  const sub = await getSubscriptionWithLimits(supplierId);
  return !!sub.limits.features[feature];
}

// Export service object for convenience
export const subscriptionService = {
  getSubscription,
  getTierLimits,
  getSupplierUsage,
  getSubscriptionWithLimits,
  upsertSubscription,
  incrementUsage,
  canPerformAction,
  hasFeature,
};
