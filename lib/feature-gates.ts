/**
 * Feature Gates
 *
 * Middleware utilities for checking subscription limits and features.
 */

import { NextResponse } from 'next/server';
import { canPerformAction, hasFeature, getSubscriptionWithLimits, type TierLimits } from './subscription-service';

// ============================================================================
// Types
// ============================================================================

export type GatedAction = 'add_wine' | 'receive_lead' | 'send_offer';
export type GatedFeature = keyof TierLimits['features'];

export interface GateCheckResult {
  allowed: boolean;
  reason?: string;
  upgrade_required?: boolean;
}

// ============================================================================
// Gate Check Functions
// ============================================================================

/**
 * Check if supplier can perform a gated action
 * Returns a GateCheckResult that can be used to block or allow the action
 */
export async function checkActionGate(
  supplierId: string,
  action: GatedAction
): Promise<GateCheckResult> {
  return canPerformAction(supplierId, action);
}

/**
 * Check if supplier has access to a feature
 */
export async function checkFeatureGate(
  supplierId: string,
  feature: GatedFeature
): Promise<GateCheckResult> {
  const allowed = await hasFeature(supplierId, feature);

  if (!allowed) {
    const featureNames: Record<GatedFeature, string> = {
      analytics: 'Analys',
      analytics_competitors: 'Konkurrentanalys',
      extended_profile: 'Utökad profil',
      video_profile: 'Videoprofil',
      support: 'Support',
    };

    return {
      allowed: false,
      reason: `${featureNames[feature]} kräver uppgradering till Pro eller Premium.`,
      upgrade_required: true,
    };
  }

  return { allowed: true };
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a 403 response for blocked actions
 */
export function createGatedResponse(result: GateCheckResult): NextResponse {
  return NextResponse.json(
    {
      error: result.reason || 'Action not allowed',
      upgrade_required: result.upgrade_required,
      code: 'SUBSCRIPTION_LIMIT_REACHED',
    },
    { status: 403 }
  );
}

/**
 * Higher-order function to wrap API handlers with action gate
 *
 * Usage:
 * ```
 * export const POST = withActionGate('add_wine', async (request, supplierId) => {
 *   // Your handler code here
 * });
 * ```
 */
export function withActionGate(
  action: GatedAction,
  handler: (supplierId: string) => Promise<NextResponse>
) {
  return async (supplierId: string): Promise<NextResponse> => {
    const result = await checkActionGate(supplierId, action);

    if (!result.allowed) {
      return createGatedResponse(result);
    }

    return handler(supplierId);
  };
}

/**
 * Higher-order function to wrap API handlers with feature gate
 */
export function withFeatureGate(
  feature: GatedFeature,
  handler: (supplierId: string) => Promise<NextResponse>
) {
  return async (supplierId: string): Promise<NextResponse> => {
    const result = await checkFeatureGate(supplierId, feature);

    if (!result.allowed) {
      return createGatedResponse(result);
    }

    return handler(supplierId);
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get subscription status summary for UI display
 */
export async function getSubscriptionSummary(supplierId: string) {
  const sub = await getSubscriptionWithLimits(supplierId);

  return {
    tier: sub.tier,
    status: sub.status,
    usage: {
      wines: {
        used: sub.usage.wines_count,
        limit: sub.limits.max_wines,
        percentage: sub.limits.max_wines
          ? Math.round((sub.usage.wines_count / sub.limits.max_wines) * 100)
          : null,
      },
      leads: {
        used: sub.usage.leads_received,
        limit: sub.limits.max_leads_per_month,
        percentage: sub.limits.max_leads_per_month
          ? Math.round((sub.usage.leads_received / sub.limits.max_leads_per_month) * 100)
          : null,
      },
      offers: {
        used: sub.usage.offers_sent,
        limit: sub.limits.max_offers_per_month,
        percentage: sub.limits.max_offers_per_month
          ? Math.round((sub.usage.offers_sent / sub.limits.max_offers_per_month) * 100)
          : null,
      },
    },
    features: sub.limits.features,
    warnings: {
      wines_near_limit: sub.limits.max_wines
        ? sub.usage.wines_count >= sub.limits.max_wines * 0.8
        : false,
      leads_near_limit: sub.limits.max_leads_per_month
        ? sub.usage.leads_received >= sub.limits.max_leads_per_month * 0.8
        : false,
      offers_near_limit: sub.limits.max_offers_per_month
        ? sub.usage.offers_sent >= sub.limits.max_offers_per_month * 0.8
        : false,
    },
    period_end: sub.current_period_end,
    cancel_at_period_end: sub.cancel_at_period_end,
  };
}
