/**
 * IOR CASE DETAIL API
 *
 * GET /api/ior/cases/[id] - Get case with messages and thread token
 * PATCH /api/ior/cases/[id] - Update case (status, priority)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { iorPortfolioService } from '@/lib/ior-portfolio-service';

// Transform snake_case case to camelCase for UI
function transformCase(c: Record<string, unknown>, threadToken?: string) {
  const producer = c.producer as Record<string, unknown> | undefined;
  return {
    id: c.id,
    subject: c.subject,
    category: c.category,
    status: c.status,
    priority: c.priority,
    producerId: c.producer_id,
    producerName: producer?.name || '',
    producerEmail: producer?.contact_email,
    dueAt: c.due_at,
    isOverdue: c.is_overdue,
    createdAt: c.created_at,
    threadToken,
  };
}

// Transform snake_case message to camelCase for UI
function transformMessage(m: Record<string, unknown>) {
  return {
    id: m.id,
    content: m.content,
    contentHtml: m.content_html,
    direction: m.direction,
    senderType: m.sender_type,
    senderName: m.sender_name,
    senderEmail: m.sender_email,
    templateId: m.template_id,
    attachments: m.attachments,
    createdAt: m.created_at,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const result = await iorPortfolioService.getCase(guard.ctx, caseId);

    if (!result) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Transform to camelCase for UI
    const caseData = transformCase(result.case as unknown as Record<string, unknown>, result.threadToken);
    const messages = result.messages.map(m => transformMessage(m as unknown as Record<string, unknown>));

    return NextResponse.json({
      ...caseData,
      messages,
    });
  } catch (error) {
    console.error('[API] GET /api/ior/cases/[id] error:', error);
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
    const { id: caseId } = await params;
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();

    // Only allow updating status for now
    if (!body.status) {
      return NextResponse.json({ error: 'Missing field: status' }, { status: 400 });
    }

    const validStatuses = ['OPEN', 'WAITING_PRODUCER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const caseData = await iorPortfolioService.updateCaseStatus(guard.ctx, caseId, body.status);

    return NextResponse.json({ case: caseData });
  } catch (error) {
    console.error('[API] PATCH /api/ior/cases/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
