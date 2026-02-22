/**
 * POST /api/admin/food-scan/recommend — Generate wine recommendation from scan
 * GET  /api/admin/food-scan/recommend — List all wine recommendations
 *
 * REQUIRES: ADMIN role
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { generateRecommendation } from '@/lib/sommelier-outreach/outreach-service';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { scan_result_id } = body;

    if (!scan_result_id) {
      return NextResponse.json({ error: 'scan_result_id is required' }, { status: 400 });
    }

    const draft = await generateRecommendation(scan_result_id);
    return NextResponse.json(draft);
  } catch (error: any) {
    console.error('[Recommend] Generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendation', message: error.message },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing authentication context' }, { status: 401 });
    }

    const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
    if (!actorService.hasRole(actor, 'ADMIN')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { data, error } = await supabase
      .from('wine_recommendations')
      .select('id, scan_result_id, restaurant_name, status, sent_at, recipient_email, dominant_styles, recommended_wines, email_subject, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({ recommendations: data || [] });
  } catch (error: any) {
    console.error('[Recommend] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list recommendations', message: error.message },
      { status: 500 },
    );
  }
}
