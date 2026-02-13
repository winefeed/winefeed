/**
 * IOR PRODUCER DETAIL API
 *
 * GET /api/ior/producers/[id] - Get producer details
 * PATCH /api/ior/producers/[id] - Update producer
 * DELETE /api/ior/producers/[id] - Delete producer and all products
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';
import { createRouteClients } from '@/lib/supabase/route-client';

// Transform snake_case producer to camelCase for UI
function transformProducer(p: Record<string, unknown>) {
  return {
    id: p.id,
    name: p.name,
    legalName: p.legal_name,
    country: p.country,
    region: p.region,
    logoUrl: p.logo_url,
    websiteUrl: p.website_url,
    contactName: p.contact_name,
    contactEmail: p.contact_email,
    contactPhone: p.contact_phone,
    isActive: p.is_active,
    onboardedAt: p.onboarded_at,
    notes: p.notes,
    combiTag: p.combi_tag ?? null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: producerId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const producer = await iorPortfolioService.getProducer(guard.ctx, producerId);

    if (!producer) {
      return NextResponse.json({ error: 'Producer not found' }, { status: 404 });
    }

    // Transform to camelCase for UI
    return NextResponse.json({
      producer: transformProducer(producer as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error('[API] GET /api/ior/producers/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: producerId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();
    const producer = await iorPortfolioService.updateProducer(guard.ctx, producerId, body);

    // Transform to camelCase for UI
    return NextResponse.json({
      producer: transformProducer(producer as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error('[API] PATCH /api/ior/producers/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: producerId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const { userClient } = await createRouteClients();

    const { searchParams } = new URL(request.url);
    const productsOnly = searchParams.get('productsOnly') === 'true';

    // Verify producer belongs to this importer
    const { data: producer } = await userClient
      .from('ior_producers')
      .select('id, name')
      .eq('id', producerId)
      .eq('importer_id', guard.ctx.importerId)
      .single();

    if (!producer) {
      return NextResponse.json({ error: 'Producer not found' }, { status: 404 });
    }

    // Delete all products for this producer
    const { count: deletedProducts } = await userClient
      .from('ior_products')
      .delete({ count: 'exact' })
      .eq('producer_id', producerId);

    if (productsOnly) {
      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedProducts || 0} products from ${producer.name}`,
        deletedProducts: deletedProducts || 0,
      });
    }

    // Also delete the producer
    await userClient
      .from('ior_producers')
      .delete()
      .eq('id', producerId);

    return NextResponse.json({
      success: true,
      message: `Deleted producer ${producer.name} and ${deletedProducts || 0} products`,
      deletedProducts: deletedProducts || 0,
    });

  } catch (error) {
    console.error('[API] DELETE /api/ior/producers/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
