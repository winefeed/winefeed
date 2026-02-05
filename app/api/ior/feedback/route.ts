/**
 * IOR FEEDBACK API
 *
 * GET /api/ior/feedback - List feedback with filters
 *   Query params: status, category, severity, producerId, q, page, pageSize
 * POST /api/ior/feedback - Create new feedback item
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';

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

export async function GET(request: NextRequest) {
  try {
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const { searchParams } = new URL(request.url);
    const supabase = getSupabaseAdmin();

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const offset = (page - 1) * pageSize;

    // Filters
    const status = searchParams.get('status') || undefined;
    const category = searchParams.get('category') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const producerId = searchParams.get('producerId') || undefined;
    const search = searchParams.get('q') || undefined;

    let query = supabase
      .from('ior_feedback_items')
      .select('*', { count: 'exact' })
      .eq('importer_id', guard.ctx.importerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (producerId) {
      query = query.eq('producer_id', producerId);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,details.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[API] GET /api/ior/feedback error:', error);
      throw new Error('Failed to fetch feedback');
    }

    return NextResponse.json({
      items: (data || []).map(f => transformFeedback(f as Record<string, unknown>)),
      page,
      pageSize,
      total: count || 0,
    });
  } catch (error) {
    console.error('[API] GET /api/ior/feedback error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // Validation
    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'Missing required field: title' }, { status: 400 });
    }
    if (!body.details || typeof body.details !== 'string') {
      return NextResponse.json({ error: 'Missing required field: details' }, { status: 400 });
    }
    if (!body.category || typeof body.category !== 'string') {
      return NextResponse.json({ error: 'Missing required field: category' }, { status: 400 });
    }
    if (!body.severity || typeof body.severity !== 'string') {
      return NextResponse.json({ error: 'Missing required field: severity' }, { status: 400 });
    }
    if (!body.pagePath || typeof body.pagePath !== 'string') {
      return NextResponse.json({ error: 'Missing required field: pagePath' }, { status: 400 });
    }

    const validCategories = ['UX', 'Bug', 'Data', 'Workflow', 'Missing feature', 'Other'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` }, { status: 400 });
    }

    const validSeverities = ['Low', 'Medium', 'High'];
    if (!validSeverities.includes(body.severity)) {
      return NextResponse.json({ error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` }, { status: 400 });
    }

    const { data: feedback, error } = await supabase
      .from('ior_feedback_items')
      .insert({
        tenant_id: guard.ctx.tenantId,
        importer_id: guard.ctx.importerId,
        page_path: body.pagePath,
        category: body.category,
        severity: body.severity,
        title: body.title.trim(),
        details: body.details.trim(),
        expected: body.expected?.trim() || null,
        producer_id: body.producerId || null,
        product_id: body.productId || null,
        case_id: body.caseId || null,
        status: 'OPEN',
      })
      .select()
      .single();

    if (error) {
      console.error('[API] POST /api/ior/feedback error:', error);
      throw new Error('Failed to create feedback');
    }

    return NextResponse.json({
      feedback: transformFeedback(feedback as Record<string, unknown>),
    }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/ior/feedback error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
