/**
 * DELETE /api/admin/food-scan/recommend/[id]
 *
 * Delete a wine recommendation draft.
 * REQUIRES: ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('wine_recommendations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Recommend] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete recommendation', message: error.message },
      { status: 500 },
    );
  }
}
