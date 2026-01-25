/**
 * GET /api/direct-delivery-locations/:id
 *
 * Get DDL details with documents and status history
 * REQUIRES: RESTAURANT, IOR, or ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDDLService } from '@/lib/compliance/ddl-service';
import { DDLNotFoundError } from '@/lib/compliance/types';
import { actorService } from '@/lib/actor-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: ddlId } = params;

    // Get tenant + user context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });

    // Must have RESTAURANT, IOR, or ADMIN role
    if (!actorService.hasRole(actor, 'ADMIN') &&
        !actorService.hasRole(actor, 'IOR') &&
        !actorService.hasRole(actor, 'RESTAURANT')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get DDL details
    const ddlService = createDDLService();
    const result = await ddlService.getDDLDetails(ddlId, tenantId);

    // Additional ownership check for RESTAURANT users
    if (actorService.hasRole(actor, 'RESTAURANT') && !actorService.hasRole(actor, 'ADMIN')) {
      if (result.restaurant_id !== actor.restaurant_id) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Get DDL details error:', error);

    if (error instanceof DDLNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
