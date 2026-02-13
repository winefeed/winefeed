/**
 * DRAFT LIST SEND API
 *
 * POST /api/draft-list/send
 *
 * Creates a quote request from the draft list and dispatches to relevant suppliers.
 *
 * Request body:
 * {
 *   items: DraftWineItem[]
 * }
 *
 * Response:
 * {
 *   success: true,
 *   request_id: string,
 *   assignments_created: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { sendEmail, getSupplierEmail } from '@/lib/email-service';
import { newQuoteRequestEmail } from '@/lib/email-templates';
import { createRouteClients } from '@/lib/supabase/route-client';

interface DraftWineItem {
  wine_id: string;
  wine_name: string;
  producer: string;
  country: string;
  region?: string;
  vintage?: number;
  color?: string;
  supplier_id: string;
  supplier_name: string;
  quantity: number;
  moq: number;
  price_sek: number;
  stock?: number;
  lead_time_days?: number;
  // Provorder fields
  provorder?: boolean;
  provorder_fee?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    const { adminClient } = await createRouteClients();

    // Only RESTAURANT or ADMIN can send draft lists
    if (!actorService.hasRole(actor, 'RESTAURANT') && !actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const items: DraftWineItem[] = body.items;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items in draft list' }, { status: 400 });
    }

    // Get restaurant ID
    let restaurantId = actor.restaurant_id;

    if (!restaurantId) {
      if (actorService.hasRole(actor, 'ADMIN')) {
        // Admin fallback: get any restaurant
        const { data: restaurant } = await adminClient
          .from('restaurants')
          .select('id')
          .limit(1)
          .single();

        if (!restaurant) {
          return NextResponse.json(
            { error: 'Ingen restaurang finns i systemet' },
            { status: 400 }
          );
        }
        restaurantId = restaurant.id;
      } else {
        return NextResponse.json(
          { error: 'Du måste vara kopplad till en restaurang' },
          { status: 400 }
        );
      }
    }

    // Build description from items
    const totalBottles = items.reduce((sum, i) => sum + i.quantity, 0);
    const provorderItems = items.filter(i => i.provorder);
    const provorderCount = provorderItems.length;
    const totalProvorderFees = provorderItems.reduce((sum, i) => sum + (i.provorder_fee || 500), 0);

    const wineDescriptions = items.map(i => {
      let desc = `${i.quantity}x ${i.wine_name} (${i.producer})`;
      if (i.provorder) {
        desc += ` [Provorder +${i.provorder_fee || 500} kr]`;
      }
      return desc;
    }).join(', ');

    const avgPrice = Math.round(items.reduce((sum, i) => sum + i.price_sek, 0) / items.length);

    // Group by supplier
    const supplierIds = [...new Set(items.map(i => i.supplier_id))];

    // Create the request
    const { data: savedRequest, error: requestError } = await adminClient
      .from('requests')
      .insert({
        restaurant_id: restaurantId,
        fritext: `Offertförfrågan: ${wineDescriptions}`,
        budget_per_flaska: avgPrice,
        antal_flaskor: totalBottles,
        status: 'OPEN',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (requestError || !savedRequest) {
      console.error('Failed to create request:', requestError);
      return NextResponse.json(
        { error: 'Kunde inte skapa förfrågan' },
        { status: 500 }
      );
    }

    const requestId = savedRequest.id;

    // Save individual items to request_items table
    const requestItems = items.map(item => ({
      request_id: requestId,
      wine_id: item.wine_id,
      supplier_id: item.supplier_id,
      wine_name: item.wine_name,
      producer: item.producer,
      country: item.country,
      region: item.region || null,
      vintage: item.vintage || null,
      color: item.color || null,
      quantity: item.quantity,
      price_sek: item.price_sek * 100, // Convert to öre
      moq: item.moq || 0,
      provorder: item.provorder || false,
      provorder_fee: item.provorder ? (item.provorder_fee || 500) : null,
    }));

    const { error: itemsError } = await adminClient
      .from('request_items')
      .insert(requestItems);

    if (itemsError) {
      console.error('Failed to save request items:', itemsError);
      // Continue anyway - the request was created
    }

    // Create assignments for each supplier
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const assignments = supplierIds.map(supplierId => ({
      quote_request_id: requestId,
      supplier_id: supplierId,
      status: 'SENT',
      sent_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }));

    const { data: createdAssignments, error: assignmentError } = await adminClient
      .from('quote_request_assignments')
      .insert(assignments)
      .select('id');

    if (assignmentError) {
      console.error('Failed to create assignments:', assignmentError);
      // Request was created, so return partial success
      return NextResponse.json({
        success: true,
        request_id: requestId,
        assignments_created: 0,
        warning: 'Förfrågan skapad men kunde inte skicka till leverantörer'
      });
    }

    // Send email notifications to suppliers (fail-safe)
    let emailsSent = 0;
    try {
      // Get restaurant name for emails
      const { data: restaurant } = await adminClient
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .single();

      const restaurantName = restaurant?.name || 'En restaurang';

      // Get supplier details for emails
      const { data: suppliers } = await adminClient
        .from('suppliers')
        .select('id, namn, kontakt_email')
        .in('id', supplierIds);

      // Send email to each supplier
      for (const supplier of suppliers || []) {
        try {
          const supplierEmail = supplier.kontakt_email || await getSupplierEmail(supplier.id, tenantId);

          if (supplierEmail) {
            // Get items for this supplier
            const supplierItems = items.filter(i => i.supplier_id === supplier.id);
            const supplierProvorderItems = supplierItems.filter(i => i.provorder);
            const hasSupplierProvorder = supplierProvorderItems.length > 0;
            const supplierProvorderFee = supplierProvorderItems.reduce((sum, i) => sum + (i.provorder_fee || 500), 0);

            const emailContent = newQuoteRequestEmail({
              supplierName: supplier.namn || 'Leverantör',
              restaurantName,
              requestId,
              fritext: wineDescriptions,
              antalFlaskor: totalBottles,
              budgetPerFlaska: avgPrice,
              expiresAt: expiresAt.toISOString(),
              wineCount: supplierItems.length,
              hasProvorder: hasSupplierProvorder,
              provorderFeeTotal: supplierProvorderFee,
            });

            const result = await sendEmail({
              to: supplierEmail,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            });

            if (result.success) {
              emailsSent++;
              console.log(`📧 Email sent to supplier ${supplier.namn} (${supplierEmail})`);
            } else {
              console.warn(`⚠️ Failed to send email to ${supplierEmail}: ${result.error}`);
            }
          }
        } catch (emailError) {
          console.error(`Error sending email to supplier ${supplier.id}:`, emailError);
          // Continue with other suppliers
        }
      }
    } catch (emailError) {
      console.error('Error in email notification loop:', emailError);
      // Don't fail the request - emails are not critical
    }

    return NextResponse.json({
      success: true,
      request_id: requestId,
      assignments_created: createdAssignments?.length || 0,
      suppliers_notified: supplierIds.length,
      emails_sent: emailsSent,
      provorder_count: provorderCount,
      provorder_fees_total: totalProvorderFees,
    });

  } catch (error: any) {
    console.error('Error sending draft list:', error);
    return NextResponse.json(
      { error: 'Ett fel uppstod', details: error.message },
      { status: 500 }
    );
  }
}
