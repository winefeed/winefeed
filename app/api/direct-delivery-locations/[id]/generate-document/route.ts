/**
 * POST /api/direct-delivery-locations/:id/generate-document
 *
 * Generate PDF application document for DDL
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDDLService } from '@/lib/compliance/ddl-service';
import {
  DDLNotFoundError,
  DDLValidationError,
  DDLDocumentGenerationError
} from '@/lib/compliance/types';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id: ddlId } = params;

    // Get tenant context
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing tenant or user context' },
        { status: 401 }
      );
    }

    // Generate document
    const ddlService = createDDLService();
    const result = await ddlService.generateDocument(ddlId, tenantId, userId);

    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    console.error('Generate document error:', error);

    if (error instanceof DDLNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    if (error instanceof DDLValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          validation_errors: error.errors
        },
        { status: 400 }
      );
    }

    if (error instanceof DDLDocumentGenerationError) {
      return NextResponse.json(
        { error: 'Document generation failed', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
