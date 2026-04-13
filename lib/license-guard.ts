/**
 * License-verification guard for transactional endpoints.
 *
 * Swedish alcohol law (alkohollagen 8 kap.) requires every restaurant
 * that buys alcohol from a wholesaler to hold a serving license
 * (serveringstillstånd). Winefeed is a marketplace, so we don't issue
 * the license ourselves — but we have to avoid connecting unlicensed
 * restaurants to suppliers. That would expose Winefeed to medverkans-
 * ansvar.
 *
 * Implementation: restaurants submit license_municipality,
 * license_case_number, and (optionally) a PDF at onboarding or via
 * /dashboard/verifiering. An admin reviews manually and sets
 * license_verified_at. Until then, the account can browse matches
 * but cannot send requests or accept offers.
 *
 * This file exposes a single helper: call it at the top of any
 * endpoint that creates a transactional link between restaurant
 * and supplier.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface LicenseStatus {
  verified: boolean;
  attested: boolean;
  municipality: string | null;
  case_number: string | null;
}

/**
 * Fetch the license status for a given restaurant id.
 * Returns the four relevant fields so callers can decide how to
 * react (hard-block vs teaser-mode).
 */
export async function getRestaurantLicenseStatus(
  adminClient: SupabaseClient,
  restaurantId: string
): Promise<LicenseStatus> {
  const { data } = await adminClient
    .from('restaurants')
    .select('license_municipality, license_case_number, license_verified_at')
    .eq('id', restaurantId)
    .single();

  return {
    verified: !!data?.license_verified_at,
    // attested = at least municipality+case number exist, awaiting admin review
    attested: !!(data?.license_municipality && data?.license_case_number),
    municipality: data?.license_municipality || null,
    case_number: data?.license_case_number || null,
  };
}

/**
 * Hard-block helper: returns a 403-shaped response body when the
 * restaurant is not license-verified, or null when access is granted.
 * Use for endpoints that create restaurant→supplier transactions.
 *
 * Example:
 *   const blocked = await blockIfUnverified(adminClient, restaurantId);
 *   if (blocked) return NextResponse.json(blocked, { status: 403 });
 */
export async function blockIfUnverified(
  adminClient: SupabaseClient,
  restaurantId: string
): Promise<{ error: string; code: string; redirect_url: string } | null> {
  const status = await getRestaurantLicenseStatus(adminClient, restaurantId);
  if (status.verified) return null;

  return {
    error: status.attested
      ? 'Din restaurang väntar på verifiering. Vi granskar uppgifterna och återkommer — oftast inom en timme på vardagar.'
      : 'Du måste verifiera din restaurang innan du kan skicka förfrågningar eller acceptera offerter.',
    code: status.attested ? 'license_pending_review' : 'license_required',
    redirect_url: '/dashboard/verifiering',
  };
}
