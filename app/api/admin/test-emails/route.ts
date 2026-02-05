/**
 * TEST EMAILS ENDPOINT
 *
 * POST /api/admin/test-emails
 * Sends all email templates to a test address for review
 *
 * Body: { email: "test@example.com" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-service';
import {
  offerCreatedEmail,
  offerAcceptedEmail,
  userInviteEmail,
  orderStatusUpdatedEmail,
  newQuoteRequestEmail,
  orderConfirmationEmail,
} from '@/lib/email-templates';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const results: Array<{ template: string; success: boolean; error?: string }> = [];

    // 1. Offer Created
    const offerCreated = offerCreatedEmail({
      restaurantName: 'Restaurang Testkrogen',
      requestTitle: 'Söker eleganta Bourgogneviner till vinkort',
      requestId: 'req-123-test',
      offerId: 'offer-456-test',
      offerTitle: 'Premium Burgundy Selection',
      supplierName: 'Vinimportören AB',
      linesCount: 8,
    });
    const r1 = await sendEmail({ to: email, ...offerCreated });
    results.push({ template: 'offer_created', ...r1 });

    // 2. Offer Accepted
    const offerAccepted = offerAcceptedEmail({
      supplierName: 'Vinimportören AB',
      restaurantName: 'Restaurang Testkrogen',
      offerId: 'offer-456-test',
      requestId: 'req-123-test',
      offerTitle: 'Premium Burgundy Selection',
      acceptedAt: new Date().toISOString(),
    });
    const r2 = await sendEmail({ to: email, ...offerAccepted });
    results.push({ template: 'offer_accepted', ...r2 });

    // 3. User Invite (Restaurant)
    const inviteRestaurant = userInviteEmail({
      recipientEmail: email,
      role: 'RESTAURANT',
      entityName: 'Restaurang Testkrogen',
      inviteToken: 'test-token-abc123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const r3 = await sendEmail({ to: email, ...inviteRestaurant });
    results.push({ template: 'invite_restaurant', ...r3 });

    // 4. User Invite (Supplier)
    const inviteSupplier = userInviteEmail({
      recipientEmail: email,
      role: 'SUPPLIER',
      entityName: 'Vinimportören AB',
      inviteToken: 'test-token-xyz789',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const r4 = await sendEmail({ to: email, ...inviteSupplier });
    results.push({ template: 'invite_supplier', ...r4 });

    // 5. Order Status - Confirmed
    const statusConfirmed = orderStatusUpdatedEmail({
      restaurantName: 'Restaurang Testkrogen',
      orderId: 'ord-789-test-abcdef123456',
      newStatus: 'CONFIRMED',
    });
    const r5 = await sendEmail({ to: email, ...statusConfirmed });
    results.push({ template: 'order_status_confirmed', ...r5 });

    // 6. Order Status - Shipped
    const statusShipped = orderStatusUpdatedEmail({
      restaurantName: 'Restaurang Testkrogen',
      orderId: 'ord-789-test-abcdef123456',
      newStatus: 'SHIPPED',
    });
    const r6 = await sendEmail({ to: email, ...statusShipped });
    results.push({ template: 'order_status_shipped', ...r6 });

    // 7. Order Status - Delivered
    const statusDelivered = orderStatusUpdatedEmail({
      restaurantName: 'Restaurang Testkrogen',
      orderId: 'ord-789-test-abcdef123456',
      newStatus: 'DELIVERED',
    });
    const r7 = await sendEmail({ to: email, ...statusDelivered });
    results.push({ template: 'order_status_delivered', ...r7 });

    // 8. New Quote Request
    const quoteRequest = newQuoteRequestEmail({
      supplierName: 'Vinimportören AB',
      restaurantName: 'Restaurang Testkrogen',
      requestId: 'req-999-test',
      fritext: 'Vi söker 3-4 eleganta Bourgogneviner till vårt nya vinkort. Fokus på Côte de Beaune, gärna både röda och vita.',
      antalFlaskor: 120,
      budgetPerFlaska: 350,
      leveransOrt: 'Stockholm',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      wineCount: 4,
      hasProvorder: true,
      provorderFeeTotal: 500,
    });
    const r8 = await sendEmail({ to: email, ...quoteRequest });
    results.push({ template: 'new_quote_request', ...r8 });

    // 9. Order Confirmation
    const orderConfirmation = orderConfirmationEmail({
      recipientName: 'Anna Andersson',
      orderId: 'ord-confirmation-test123',
      restaurantName: 'Restaurang Testkrogen',
      supplierName: 'Vinimportören AB',
      totalBottles: 48,
      totalValueSek: 16800,
      deliveryAddress: 'Storgatan 1, 111 23 Stockholm',
      expectedDelivery: 'Vecka 7 (12-14 februari)',
      items: [
        { wineName: 'Meursault 1er Cru "Les Charmes" 2021', quantity: 12, priceSek: 450 },
        { wineName: 'Volnay 1er Cru "Les Caillerets" 2020', quantity: 12, priceSek: 380 },
        { wineName: 'Bourgogne Chardonnay 2022', quantity: 24, priceSek: 180, provorder: true, provorderFee: 500 },
      ],
    });
    const r9 = await sendEmail({ to: email, ...orderConfirmation });
    results.push({ template: 'order_confirmation', ...r9 });

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      message: `Sent ${successCount}/${results.length} test emails to ${email}`,
      results,
    });

  } catch (error) {
    console.error('Test emails error:', error);
    return NextResponse.json(
      { error: 'Failed to send test emails' },
      { status: 500 }
    );
  }
}
