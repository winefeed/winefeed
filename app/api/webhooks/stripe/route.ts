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
    apiVersion: '2025-12-15.clover',
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

    console.log(`[Stripe Webhook] Subscription cancelled for supplier ${sub.supplier_id}`);
  }
}
