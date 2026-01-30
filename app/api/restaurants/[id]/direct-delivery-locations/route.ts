/**
 * POST /api/restaurants/:id/direct-delivery-locations
 *
 * Create a new Direct Delivery Location (DDL) for a restaurant
 * REQUIRES: RESTAURANT role and ownership of the restaurant
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDDLService } from '@/lib/compliance/ddl-service';
import { CreateDDLRequest, DDLValidationError } from '@/lib/compliance/types';
import { actorService } from '@/lib/actor-service';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: restaurantId } = params;

    // Get tenant context (from auth/session)
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing tenant or user context' },
        { status: 401 }
      );
    }

    // Verify user owns this restaurant
    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    if (!actorService.hasRole(actor, 'ADMIN') &&
        (!actorService.hasRole(actor, 'RESTAURANT') || actor.restaurant_id !== restaurantId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: Omit<CreateDDLRequest, 'restaurant_id'> = await request.json();

    // Validate request
    if (!body.importer_id) {
      return NextResponse.json(
        { error: 'importer_id required' },
        { status: 400 }
      );
    }

    if (!body.consent_given) {
      return NextResponse.json(
        { error: 'Consent required (consent_given must be true)' },
        { status: 400 }
      );
    }

    // Create DDL request with restaurant_id
    const createRequest: CreateDDLRequest = {
      ...body,
      restaurant_id: restaurantId
    };

    // Create DDL
    const ddlService = createDDLService();
    const result = await ddlService.createDDL(tenantId, createRequest, userId);

    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    console.error('Create DDL error:', error);

    if (error instanceof DDLValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          validation_errors: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
