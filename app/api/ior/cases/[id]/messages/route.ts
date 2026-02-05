/**
 * IOR CASE MESSAGES API
 *
 * POST /api/ior/cases/[id]/messages - Add message to case
 *   Body: { content: string, template_id?: string, template_variables?: Record<string, string> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();

    // Either content or template_id is required
    if (!body.content && !body.template_id) {
      return NextResponse.json(
        { error: 'Either content or template_id is required' },
        { status: 400 }
      );
    }

    // If using template, template_variables should be provided
    if (body.template_id && !body.template_variables) {
      return NextResponse.json(
        { error: 'template_variables required when using template_id' },
        { status: 400 }
      );
    }

    const result = await iorPortfolioService.sendCaseMessage(guard.ctx, caseId, {
      content: body.content || '',
      template_id: body.template_id,
      template_variables: body.template_variables,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/ior/cases/[id]/messages error:', error);

    // Handle "Case not found" error
    if (error instanceof Error && error.message === 'Case not found') {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
