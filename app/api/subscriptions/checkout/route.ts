/**
 * SUBSCRIPTION CHECKOUT API
 *
 * POST /api/subscriptions/checkout - Create Stripe checkout session
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createRouteClients } from '@/lib/supabase/route-client';
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

// Price IDs from Stripe (configure these in env)
function getPriceIds(): Record<string, string> {
  return {
    pro: process.env.STRIPE_PRICE_PRO || '',
    premium: process.env.STRIPE_PRICE_PREMIUM || '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    const { userClient } = await createRouteClients();
    const PRICE_IDS = getPriceIds();

    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json(
        { error: 'Seller access required' },
        { status: 403 }
      );
    }

    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'No supplier linked to user' },
        { status: 404 }
      );
    }

    const { tier } = await request.json();

    if (!tier || !['pro', 'premium'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be "pro" or "premium"' },
        { status: 400 }
      );
    }

    const priceId = PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe price not configured for this tier' },
        { status: 500 }
      );
    }

    // Get supplier info
    const { data: supplier } = await userClient
      .from('suppliers')
      .select('id, namn, kontakt_email')
      .eq('id', actor.supplier_id)
      .single();

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Check for existing Stripe customer
    const { data: existingSub } = await userClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('supplier_id', actor.supplier_id)
      .single();

    let customerId = existingSub?.stripe_customer_id;

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: supplier.kontakt_email,
        name: supplier.namn,
        metadata: {
          supplier_id: actor.supplier_id,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await userClient
        .from('subscriptions')
        .upsert({
          supplier_id: actor.supplier_id,
          stripe_customer_id: customerId,
          tier: 'free',
          status: 'active',
        }, {
          onConflict: 'supplier_id',
        });
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://winefeed.se';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/supplier/profile?subscription=success`,
      cancel_url: `${baseUrl}/supplier/profile?subscription=cancelled`,
      metadata: {
        supplier_id: actor.supplier_id,
        tier: tier,
      },
      subscription_data: {
        metadata: {
          supplier_id: actor.supplier_id,
          tier: tier,
        },
      },
    });

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
