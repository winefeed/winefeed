/**
 * STRIPE WEBHOOK API
 *
 * POST /api/webhooks/stripe - Handle Stripe webhook events
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-01-28.clover',
  });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getWebhookSecret() {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }
  return process.env.STRIPE_WEBHOOK_SECRET;
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    const supabase = getSupabase();
    const webhookSecret = getWebhookSecret();

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(stripe, supabase, session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const checkoutType = session.metadata?.type;

  // Handle sponsored slot purchase
  if (checkoutType === 'sponsored_slot') {
    await handleSponsoredSlotCheckout(stripe, supabase, session);
    return;
  }

  // Handle regular subscription checkout
  const supplierId = session.metadata?.supplier_id;
  const tier = session.metadata?.tier as 'pro' | 'premium';

  if (!supplierId || !tier) {
    console.error('Missing metadata in checkout session');
    return;
  }

  // Get subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  ) as Stripe.Subscription;

  // Update our database
  await supabase
    .from('subscriptions')
    .upsert({
      supplier_id: supplierId,
      tier: tier,
      status: 'active',
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: stripeSubscription.items.data[0]?.price.id,
      current_period_start: new Date((stripeSubscription as any).current_period_start * 1000).toISOString(),
      current_period_end: new Date((stripeSubscription as any).current_period_end * 1000).toISOString(),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'supplier_id',
    });

  // Also update the supplier's tier directly (trigger should handle this, but just in case)
  await supabase
    .from('suppliers')
    .update({ tier: tier })
    .eq('id', supplierId);

  // Sync sponsored slot entitlements after subscription change
  const tenantId = session.metadata?.tenant_id;
  if (tenantId) {
    await syncSponsoredEntitlements(supabase, supplierId, tenantId, tier);
  }

  console.log(`[Stripe Webhook] Subscription activated for supplier ${supplierId}: ${tier}`);
}

async function handleInvoicePaid(supabase: SupabaseClient, invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;
  if (!subscriptionId) return;

  // Find subscription in our database
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('supplier_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!sub) {
    console.error('Subscription not found for invoice:', subscriptionId);
    return;
  }

  // Update status to active (in case it was past_due)
  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log(`[Stripe Webhook] Invoice paid for supplier ${sub.supplier_id}`);
}

async function handlePaymentFailed(supabase: SupabaseClient, invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;
  if (!subscriptionId) return;

  // Update status to past_due
  await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  console.log(`[Stripe Webhook] Payment failed for subscription ${subscriptionId}`);
}

async function handleSubscriptionUpdated(supabase: SupabaseClient, subscription: Stripe.Subscription) {
  const supplierId = subscription.metadata?.supplier_id;

  // Determine tier from price
  const tier = subscription.metadata?.tier as 'pro' | 'premium' || 'pro';

  // Map Stripe status to our status
  let status: 'active' | 'cancelled' | 'past_due' | 'trialing' = 'active';
  if (subscription.status === 'canceled') status = 'cancelled';
  else if (subscription.status === 'past_due') status = 'past_due';
  else if (subscription.status === 'trialing') status = 'trialing';

  await supabase
    .from('subscriptions')
    .update({
      tier: tier,
      status: status,
      current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
      current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Update supplier tier
  if (supplierId) {
    await supabase
      .from('suppliers')
      .update({ tier: status === 'cancelled' ? 'free' : tier })
      .eq('id', supplierId);
  }

  console.log(`[Stripe Webhook] Subscription updated: ${subscription.id} -> ${status}`);
}

async function handleSubscriptionDeleted(supabase: SupabaseClient, subscription: Stripe.Subscription) {
  const subscriptionType = subscription.metadata?.type;

  // Handle sponsored slot subscription cancellation
  if (subscriptionType === 'sponsored_slot') {
    await handleSponsoredSlotCancelled(supabase, subscription);
    return;
  }

  // Downgrade to free
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('supplier_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (sub) {
    await supabase
      .from('subscriptions')
      .update({
        tier: 'free',
        status: 'cancelled',
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('supplier_id', sub.supplier_id);

    await supabase
      .from('suppliers')
      .update({ tier: 'free' })
      .eq('id', sub.supplier_id);

    // Sync entitlements after downgrade
    const tenantId = subscription.metadata?.tenant_id;
    if (tenantId) {
      await syncSponsoredEntitlements(supabase, sub.supplier_id, tenantId, 'free');
    }

    console.log(`[Stripe Webhook] Subscription cancelled for supplier ${sub.supplier_id}`);
  }
}

// ============================================================================
// SPONSORED SLOT HANDLERS
// ============================================================================

/**
 * Handle sponsored slot checkout completion
 * Creates the slot and updates entitlements
 */
async function handleSponsoredSlotCheckout(
  stripe: Stripe,
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const supplierId = session.metadata?.supplier_id;
  const tenantId = session.metadata?.tenant_id;
  const categoryId = session.metadata?.category_id;
  const categoryName = session.metadata?.category_name;

  if (!supplierId || !tenantId || !categoryId) {
    console.error('Missing metadata in sponsored slot checkout');
    return;
  }

  // Get subscription details from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  ) as Stripe.Subscription;

  // Check if slot already exists (idempotency)
  const { data: existingSlot } = await supabase
    .from('sponsored_slots')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('category_id', categoryId)
    .eq('status', 'ACTIVE')
    .single();

  if (existingSlot) {
    console.log(`[Stripe Webhook] Sponsored slot already exists for ${supplierId} in ${categoryName}`);
    return;
  }

  // Check category cap before creating slot
  const { data: category } = await supabase
    .from('sponsored_categories')
    .select('sponsor_cap')
    .eq('id', categoryId)
    .single();

  const { count: activeCount } = await supabase
    .from('sponsored_slots')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('status', 'ACTIVE');

  if (category && activeCount !== null && activeCount >= category.sponsor_cap) {
    console.error(`[Stripe Webhook] Category ${categoryName} is full, refunding...`);
    // In a real scenario, you'd issue a refund here
    // For now, just log the error
    return;
  }

  // Add purchased slot to entitlements
  // First try to get existing entitlement
  const { data: existingEntitlement } = await supabase
    .from('supplier_entitlements')
    .select('purchased_slots')
    .eq('supplier_id', supplierId)
    .eq('tenant_id', tenantId)
    .single();

  const currentPurchased = existingEntitlement?.purchased_slots || 0;

  await supabase
    .from('supplier_entitlements')
    .upsert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      included_slots: 0,
      purchased_slots: currentPurchased + 1
    }, {
      onConflict: 'tenant_id,supplier_id'
    });

  // Create the sponsored slot
  const { error: slotError } = await supabase
    .from('sponsored_slots')
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      category_id: categoryId,
      slot_type: 'PURCHASED',
      status: 'ACTIVE',
      stripe_subscription_id: stripeSubscription.id,
      stripe_subscription_item_id: stripeSubscription.items.data[0]?.id,
      starts_at: new Date().toISOString()
    });

  if (slotError) {
    console.error('Failed to create sponsored slot:', slotError);
    return;
  }

  // Log event
  await supabase.from('sponsored_slot_events').insert({
    tenant_id: tenantId,
    supplier_id: supplierId,
    category_id: categoryId,
    event_type: 'SLOT_ASSIGNED',
    metadata: {
      slot_type: 'PURCHASED',
      category_name: categoryName,
      stripe_subscription_id: stripeSubscription.id,
      source: 'stripe_webhook'
    }
  });

  console.log(`[Stripe Webhook] Sponsored slot created for ${supplierId} in ${categoryName}`);
}

/**
 * Handle sponsored slot subscription cancellation
 */
async function handleSponsoredSlotCancelled(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const supplierId = subscription.metadata?.supplier_id;
  const tenantId = subscription.metadata?.tenant_id;
  const categoryId = subscription.metadata?.category_id;

  // Find and cancel the slot
  const { data: slot, error: findError } = await supabase
    .from('sponsored_slots')
    .select('id, category_id')
    .eq('stripe_subscription_id', subscription.id)
    .eq('status', 'ACTIVE')
    .single();

  if (findError || !slot) {
    console.log(`[Stripe Webhook] No active slot found for subscription ${subscription.id}`);
    return;
  }

  // Update slot status to CANCELLED
  await supabase
    .from('sponsored_slots')
    .update({ status: 'CANCELLED' })
    .eq('id', slot.id);

  // Decrement purchased slots
  if (supplierId && tenantId) {
    const { data: entitlement } = await supabase
      .from('supplier_entitlements')
      .select('purchased_slots')
      .eq('supplier_id', supplierId)
      .eq('tenant_id', tenantId)
      .single();

    if (entitlement && entitlement.purchased_slots > 0) {
      await supabase
        .from('supplier_entitlements')
        .update({
          purchased_slots: Math.max(0, entitlement.purchased_slots - 1)
        })
        .eq('supplier_id', supplierId)
        .eq('tenant_id', tenantId);
    }
  }

  // Log event
  await supabase.from('sponsored_slot_events').insert({
    tenant_id: tenantId,
    supplier_id: supplierId,
    category_id: slot.category_id,
    slot_id: slot.id,
    event_type: 'SLOT_CANCELLED',
    metadata: {
      stripe_subscription_id: subscription.id,
      source: 'stripe_webhook'
    }
  });

  console.log(`[Stripe Webhook] Sponsored slot cancelled for subscription ${subscription.id}`);
}

/**
 * Sync sponsored slot entitlements based on subscription tier
 * Premium tier includes 1 sponsored slot
 */
async function syncSponsoredEntitlements(
  supabase: SupabaseClient,
  supplierId: string,
  tenantId: string,
  tier: string
) {
  // Get tier limits to find included slots
  const { data: tierLimits } = await supabase
    .from('tier_limits')
    .select('included_sponsored_slots')
    .eq('tier', tier)
    .single();

  const includedSlots = tierLimits?.included_sponsored_slots || (tier === 'premium' ? 1 : 0);

  // Upsert entitlement
  await supabase
    .from('supplier_entitlements')
    .upsert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      included_slots: includedSlots
    }, {
      onConflict: 'tenant_id,supplier_id'
    });

  // Log event
  await supabase.from('sponsored_slot_events').insert({
    tenant_id: tenantId,
    supplier_id: supplierId,
    event_type: 'ENTITLEMENT_UPDATED',
    metadata: {
      included_slots: includedSlots,
      tier: tier,
      source: 'subscription_change'
    }
  });

  console.log(`[Stripe Webhook] Entitlements synced for ${supplierId}: ${includedSlots} included slots (${tier})`);
}
