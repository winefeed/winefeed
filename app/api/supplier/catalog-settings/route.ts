/**
 * SUPPLIER CATALOG SETTINGS API
 *
 * GET /api/supplier/catalog-settings - Get catalog sharing status
 * PATCH /api/supplier/catalog-settings - Toggle catalog sharing on/off
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';
import { actorService } from '@/lib/actor-service';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!actor.supplier_id) {
      return NextResponse.json({ error: 'No supplier associated' }, { status: 404 });
    }

    const { adminClient } = await createRouteClients();

    const { data: supplier, error } = await adminClient
      .from('suppliers')
      .select('catalog_shared, catalog_token')
      .eq('id', actor.supplier_id)
      .single();

    if (error || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.winefeed.se';
    const catalogUrl = supplier.catalog_token
      ? `${baseUrl}/catalog/${supplier.catalog_token}`
      : null;

    return NextResponse.json({
      catalogShared: supplier.catalog_shared || false,
      catalogToken: supplier.catalog_token,
      catalogUrl,
    });
  } catch (error: any) {
    console.error('Error fetching catalog settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN') && !actorService.hasRole(actor, 'SELLER')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!actor.supplier_id) {
      return NextResponse.json({ error: 'No supplier associated' }, { status: 404 });
    }

    const body = await request.json();

    if (typeof body.catalogShared !== 'boolean') {
      return NextResponse.json({ error: 'catalogShared must be a boolean' }, { status: 400 });
    }

    const { adminClient } = await createRouteClients();

    const updates: Record<string, any> = {
      catalog_shared: body.catalogShared,
    };

    // If enabling and no token exists, generate one
    if (body.catalogShared) {
      const { data: current } = await adminClient
        .from('suppliers')
        .select('catalog_token')
        .eq('id', actor.supplier_id)
        .single();

      if (!current?.catalog_token) {
        updates.catalog_token = crypto.randomUUID();
      }
    }

    const { data: supplier, error } = await adminClient
      .from('suppliers')
      .update(updates)
      .eq('id', actor.supplier_id)
      .select('catalog_shared, catalog_token')
      .single();

    if (error) {
      console.error('Error updating catalog settings:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.winefeed.se';
    const catalogUrl = supplier.catalog_token
      ? `${baseUrl}/catalog/${supplier.catalog_token}`
      : null;

    return NextResponse.json({
      catalogShared: supplier.catalog_shared || false,
      catalogToken: supplier.catalog_token,
      catalogUrl,
    });
  } catch (error: any) {
    console.error('Error updating catalog settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
