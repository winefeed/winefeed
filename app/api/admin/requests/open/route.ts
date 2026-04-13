/**
 * ADMIN — Open Broadcast Requests Review Queue
 *
 * GET  /api/admin/requests/open         — list open requests (default: PENDING_REVIEW)
 * REQUIRES: ADMIN role
 *
 * Query params:
 *   status: 'PENDING_REVIEW' | 'OPEN' | 'REJECTED' | 'all'  (default: PENDING_REVIEW)
 *   limit: number (default 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { actorService } from '@/lib/actor-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING_REVIEW';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query = supabase
      .from('requests')
      .select('id, restaurant_id, fritext, budget_per_flaska, antal_flaskor, status, open_criteria, created_at')
      .eq('request_type', 'open')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch', details: error.message }, { status: 500 });
    }

    // Join restaurant names
    const restaurantIds = [...new Set((requests || []).map(r => r.restaurant_id))];
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name, city')
      .in('id', restaurantIds);
    const rMap = new Map((restaurants || []).map(r => [r.id, r]));

    return NextResponse.json({
      requests: (requests || []).map(r => ({
        ...r,
        restaurant: rMap.get(r.restaurant_id) || null,
      })),
    });
  } catch (err: any) {
    console.error('GET /api/admin/requests/open error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
