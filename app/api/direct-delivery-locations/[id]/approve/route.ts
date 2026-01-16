/**
 * POST /api/direct-delivery-locations/:id/approve
 *
 * Approve DDL (compliance admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDDLService } from '@/lib/compliance/ddl-service';
import {
  DDLNotFoundError,
  DDLValidationError,
  DDLStatusTransitionError
} from '@/lib/compliance/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: ddlId } = params;

    // Get tenant context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing tenant or user context' },
        { status: 401 }
      );
    }

    // Check role (compliance_admin only)
    if (userRole !== 'compliance_admin') {
      return NextResponse.json(
        { error: 'Forbidden: compliance_admin role required' },
        { status: 403 }
      );
    }

    // Parse optional body
    const body = await request.json().catch(() => ({}));
    const note = body.note;

    // Approve DDL
    const ddlService = createDDLService();
    const result = await ddlService.approveDDL(ddlId, tenantId, userId, note);

    return NextResponse.json(result);

  } catch (error: any) {
    return handleWorkflowError(error);
  }
}

function handleWorkflowError(error: any): NextResponse {
  console.error('Workflow error:', error);

  if (error instanceof DDLNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof DDLValidationError) {
    return NextResponse.json(
      { error: error.message, validation_errors: error.errors },
      { status: 400 }
    );
  }

  if (error instanceof DDLStatusTransitionError) {
    return NextResponse.json(
      {
        error: error.message,
        from_status: error.from_status,
        to_status: error.to_status
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: 'Internal server error', details: error.message },
    { status: 500 }
  );
}
