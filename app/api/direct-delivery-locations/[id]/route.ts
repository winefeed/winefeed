/**
 * GET /api/direct-delivery-locations/:id
 *
 * Get DDL details with documents and status history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDDLService } from '@/lib/compliance/ddl-service';
import { DDLNotFoundError } from '@/lib/compliance/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: ddlId } = params;

    // Get tenant context
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context' },
        { status: 401 }
      );
    }

    // Get DDL details
    const ddlService = createDDLService();
    const result = await ddlService.getDDLDetails(ddlId, tenantId);

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
