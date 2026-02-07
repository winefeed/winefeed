/**
 * MOQ HELPER API - Add Item
 *
 * POST /api/access/requests/[id]/moq/add
 *
 * Adds an item to an ACCEPTED request to help meet importer MOQ.
 * Feature flag: FEATURE_MOQ_HELPER (default: false)
 *
 * POLICY ENFORCEMENT:
 * 1. Feature flag enabled
 * 2. Request exists and is ACCEPTED
 * 3. Request owned by authenticated user
 * 4. Item is from SAME importer (enforced here + DB trigger)
 * 5. Quantity within limits (max 24 per item)
 *
 * NO CART, NO CHECKOUT, NO PAYMENT:
 * - This is adding items to an RFQ, not a shopping cart
 * - No payment processing
 * - No order totals
 */

import { NextRequest, NextResponse } from 'next/server';
import { moqHelperService } from '@/lib/moq-helper-service';
import { isMOQHelperEnabled, addMOQItemSchema } from '@/lib/moq-helper-types';
import { verifyAuthToken } from '@/lib/access-auth';

// ============================================
// POST - Add Item
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Feature flag check
  if (!isMOQHelperEnabled()) {
    return NextResponse.json(
      { error: 'MOQ Helper feature is not enabled' },
      { status: 404 }
    );
  }

  try {
    const { id: requestId } = await params;

    // Auth check
    const authToken = request.cookies.get('access_consumer_token')?.value
      || request.cookies.get('access_admin_token')?.value;

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyAuthToken(authToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = addMOQItemSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Add item
    const item = await moqHelperService.addItem(
      { userId: auth.subjectId },
      requestId,
      parseResult.data
    );

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/access/requests/[id]/moq/add error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Not found', details: error.message },
          { status: 404 }
        );
      }
      if (error.message.includes('ACCEPTED') || error.message.includes('same importer')) {
        return NextResponse.json(
          { error: 'Policy violation', details: error.message },
          { status: 403 }
        );
      }
      if (error.message.includes('available')) {
        return NextResponse.json(
          { error: 'Item not available', details: error.message },
          { status: 410 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove Item
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Feature flag check
  if (!isMOQHelperEnabled()) {
    return NextResponse.json(
      { error: 'MOQ Helper feature is not enabled' },
      { status: 404 }
    );
  }

  try {
    const { id: requestId } = await params;

    // Auth check
    const authToken = request.cookies.get('access_consumer_token')?.value
      || request.cookies.get('access_admin_token')?.value;

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyAuthToken(authToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get item_id from query or body
    const url = new URL(request.url);
    const itemId = url.searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json(
        { error: 'item_id query parameter required' },
        { status: 400 }
      );
    }

    // Remove item
    await moqHelperService.removeItem(
      { userId: auth.subjectId },
      requestId,
      itemId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE /api/access/requests/[id]/moq/add error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
