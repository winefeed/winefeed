/**
 * IOR FEEDBACK DETAIL API
 *
 * GET /api/ior/feedback/[id] - Get single feedback item
 * PATCH /api/ior/feedback/[id] - Update feedback (status, title, details)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { createRouteClients } from '@/lib/supabase/route-client';

// Transform snake_case to camelCase for UI
function transformFeedback(f: Record<string, unknown>) {
  return {
    id: f.id,
    pagePath: f.page_path,
    category: f.category,
    severity: f.severity,
    title: f.title,
    details: f.details,
    expected: f.expected,
    status: f.status,
    producerId: f.producer_id,
    productId: f.product_id,
    caseId: f.case_id,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: feedbackId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const { userClient } = await createRouteClients();

    const { data: feedback, error } = await userClient
      .from('ior_feedback_items')
      .select('*')
      .eq('id', feedbackId)
      .eq('importer_id', guard.ctx.importerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
      }
      throw new Error('Failed to fetch feedback');
    }

    return NextResponse.json({
      feedback: transformFeedback(feedback as Record<string, unknown>),
    });
  } catch (error) {
    console.error('[API] GET /api/ior/feedback/[id] error:', error);
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
    const { id: feedbackId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();
    const { userClient } = await createRouteClients();

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const validStatuses = ['OPEN', 'ACKNOWLEDGED', 'DONE', 'WONTFIX'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      }
      updateData.status = body.status;
    }

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      }
      updateData.title = body.title.trim();
    }

    if (body.details !== undefined) {
      if (typeof body.details !== 'string' || !body.details.trim()) {
        return NextResponse.json({ error: 'Details cannot be empty' }, { status: 400 });
      }
      updateData.details = body.details.trim();
    }

    if (body.expected !== undefined) {
      updateData.expected = body.expected?.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: feedback, error } = await userClient
      .from('ior_feedback_items')
      .update(updateData)
      .eq('id', feedbackId)
      .eq('importer_id', guard.ctx.importerId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
      }
      console.error('[API] PATCH /api/ior/feedback/[id] error:', error);
      throw new Error('Failed to update feedback');
    }

    return NextResponse.json({
      feedback: transformFeedback(feedback as Record<string, unknown>),
    });
  } catch (error) {
    console.error('[API] PATCH /api/ior/feedback/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
