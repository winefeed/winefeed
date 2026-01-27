/**
 * ADMIN SUPPLIER SUBSCRIPTION API
 *
 * PUT /api/admin/suppliers/[id]/subscription
 *
 * Update supplier subscription tier (for admin manual upgrades)
 *
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';
import { SubscriptionTier } from '@/lib/subscription-service';
import { sendEmail } from '@/lib/email-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: supplierId } = params;
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tier } = body as { tier: SubscriptionTier };

    if (!tier || !['free', 'pro', 'premium'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be: free, pro, or premium' },
        { status: 400 }
      );
    }

    // Check supplier exists
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, namn')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Get current subscription to determine if upgrade or downgrade
    const { data: currentSub } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('supplier_id', supplierId)
      .single();

    const oldTier = currentSub?.tier || 'free';

    // Upsert subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        supplier_id: supplierId,
        tier: tier,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'supplier_id',
      })
      .select()
      .single();

    if (subError) {
      console.error('Error updating subscription:', subError);
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }

    // Send email notification to supplier users
    const { data: supplierUsers } = await supabase
      .from('supplier_users')
      .select('user_id')
      .eq('supplier_id', supplierId);

    if (supplierUsers && supplierUsers.length > 0) {
      const userIds = supplierUsers.map(u => u.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email')
        .in('id', userIds);

      const tierLabels: Record<string, string> = {
        free: 'Free',
        pro: 'Pro',
        premium: 'Premium',
      };

      const tierOrder = { free: 0, pro: 1, premium: 2 };
      const isUpgrade = tierOrder[tier as keyof typeof tierOrder] > tierOrder[oldTier as keyof typeof tierOrder];
      const isDowngrade = tierOrder[tier as keyof typeof tierOrder] < tierOrder[oldTier as keyof typeof tierOrder];

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://winefeed.se';

      for (const profile of profiles || []) {
        if (!profile.email) continue;

        let subject: string;
        let html: string;
        let text: string;

        if (isUpgrade) {
          subject = `Din Winefeed-prenumeration har uppgraderats till ${tierLabels[tier]}`;
          html = `
            <h2>Grattis! Din prenumeration har uppgraderats</h2>
            <p>Hej!</p>
            <p>Din Winefeed-prenumeration för <strong>${supplier.namn}</strong> har uppgraderats till <strong>${tierLabels[tier]}</strong>.</p>
            ${tier === 'pro' || tier === 'premium' ? `
            <p>Du har nu tillgång till:</p>
            <ul>
              <li>Obegränsat antal viner</li>
              <li>Obegränsat antal offerter</li>
              ${tier === 'premium' ? '<li>Prioriterad placering i sökresultat</li>' : ''}
              ${tier === 'premium' ? '<li>Konkurrentanalys</li>' : ''}
            </ul>
            ` : ''}
            <p><a href="${appUrl}/supplier">Logga in på Winefeed</a> för att fortsätta.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Vill du ändra din prenumeration? Gå till <a href="${appUrl}/supplier/pricing">Prissättning</a>
              eller kontakta oss på <a href="mailto:support@winefeed.se">support@winefeed.se</a>.
            </p>
          `;
          text = `Grattis! Din Winefeed-prenumeration för ${supplier.namn} har uppgraderats till ${tierLabels[tier]}.\n\nLogga in på ${appUrl}/supplier för att fortsätta.\n\nVill du ändra din prenumeration? Gå till ${appUrl}/supplier/pricing eller kontakta oss på support@winefeed.se.`;
        } else if (isDowngrade) {
          subject = `Din Winefeed-prenumeration har ändrats till ${tierLabels[tier]}`;
          html = `
            <h2>Din prenumeration har ändrats</h2>
            <p>Hej!</p>
            <p>Din Winefeed-prenumeration för <strong>${supplier.namn}</strong> har ändrats till <strong>${tierLabels[tier]}</strong>.</p>
            ${tier === 'free' ? `
            <p>Med Free-planen har du:</p>
            <ul>
              <li>Max 10 aktiva viner</li>
              <li>Max 5 leads per månad</li>
              <li>Max 10 offerter per månad</li>
            </ul>
            <p>Behöver du fler viner eller obegränsade offerter? <a href="${appUrl}/supplier/pricing">Uppgradera till Pro</a>.</p>
            ` : ''}
            <p><a href="${appUrl}/supplier">Logga in på Winefeed</a> för att se ditt konto.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Vill du ändra din prenumeration? Gå till <a href="${appUrl}/supplier/pricing">Prissättning</a>
              eller kontakta oss på <a href="mailto:support@winefeed.se">support@winefeed.se</a>.
            </p>
          `;
          text = `Din Winefeed-prenumeration för ${supplier.namn} har ändrats till ${tierLabels[tier]}.\n\nLogga in på ${appUrl}/supplier för att se ditt konto.\n\nVill du ändra din prenumeration? Gå till ${appUrl}/supplier/pricing eller kontakta oss på support@winefeed.se.`;
        } else {
          // Same tier, no email needed
          continue;
        }

        // Send email (fail-safe, won't block response)
        sendEmail({ to: profile.email, subject, html, text }).catch(err => {
          console.error('Failed to send subscription email:', err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplier.id,
        name: supplier.namn,
      },
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
      },
      message: `Leverantör "${supplier.namn}" ${oldTier !== tier ? (tierOrder[tier as keyof typeof tierOrder] > tierOrder[oldTier as keyof typeof tierOrder] ? 'uppgraderad' : 'nedgraderad') : 'uppdaterad'} till ${tier}`,
      emailSent: true,
    });

  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: supplierId } = params;
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('supplier_id', supplierId)
      .single();

    // Get wine count
    const { count: winesCount } = await supabase
      .from('supplier_wines')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('is_active', true);

    return NextResponse.json({
      subscription: subscription || {
        tier: 'free',
        status: 'active',
      },
      usage: {
        wines_count: winesCount || 0,
      },
    });

  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
