/**
 * SPONSORED SLOT CHECKOUT API
 *
 * POST /api/sponsored/checkout
 * Create a Stripe checkout session to purchase additional slots
 *
 * Request body:
 * - category_id: The category to sponsor
 * - billing_period: 'monthly' | 'yearly'
 *
 * Returns:
 * - checkout_url: Stripe checkout URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { sponsoredSlotsService } from '@/lib/sponsored-slots-service';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover'
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const stripe = getStripe();

    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    // Resolve actor - must be supplier
    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId
    });

    if (!actor.supplier_id) {
      return NextResponse.json(
        { error: 'Supplier access required' },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const { category_id, billing_period = 'monthly' } = body;

    if (!category_id) {
      return NextResponse.json(
        { error: 'category_id is required' },
        { status: 400 }
      );
    }

    // Get category to verify it exists and get price
    const { data: category, error: catError } = await supabase
      .from('sponsored_categories')
      .select('*')
      .eq('id', category_id)
      .single();

    if (catError || !category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check category is not full
    const activeCount = await sponsoredSlotsService.getActiveSlotCount(category_id);
    if (activeCount >= category.sponsor_cap) {
      return NextResponse.json(
        { error: `Category "${category.name}" is full` },
        { status: 400 }
      );
    }

    // Get Stripe price ID
    const priceId = billing_period === 'yearly'
      ? category.stripe_price_id_yearly
      : category.stripe_price_id_monthly;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Pricing not configured for this category' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('supplier_id', actor.supplier_id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      // Get supplier info for customer creation
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('namn, kontakt_email')
        .eq('id', actor.supplier_id)
        .single();

      const customer = await stripe.customers.create({
        email: supplier?.kontakt_email || undefined,
        name: supplier?.namn || undefined,
        metadata: {
          supplier_id: actor.supplier_id,
          tenant_id: tenantId
        }
      });
      customerId = customer.id;

      // Save customer ID
      await supabase
        .from('subscriptions')
        .upsert({
          supplier_id: actor.supplier_id,
          stripe_customer_id: customerId,
          tier: 'free',
          status: 'active'
        }, {
          onConflict: 'supplier_id'
        });
    }

    // Create Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        type: 'sponsored_slot',
        supplier_id: actor.supplier_id,
        tenant_id: tenantId,
        category_id: category_id,
        category_name: category.name
      },
      subscription_data: {
        metadata: {
          type: 'sponsored_slot',
          supplier_id: actor.supplier_id,
          tenant_id: tenantId,
          category_id: category_id
        }
      },
      success_url: `${appUrl}/supplier/promotions?checkout=success&category=${category.slug}`,
      cancel_url: `${appUrl}/supplier/promotions?checkout=cancelled`
    });

    return NextResponse.json({
      checkout_url: session.url
    });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
