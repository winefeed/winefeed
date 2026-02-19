/**
 * PATCH /api/admin/food-scan/suggestions/[id]
 *
 * Approve or reject a food pairing suggestion.
 * Body: { action: 'approve'|'reject', approved_colors?, approved_regions?, approved_grapes? }
 * REQUIRES: ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { approveSuggestion, rejectSuggestion } from '@/lib/food-scan/food-scan-service';
import { invalidatePairingCache } from '@/lib/food-scan/pairing-loader';

export async function PATCH(
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
    const body = await request.json();
    const { action, approved_colors, approved_regions, approved_grapes } = body;

    if (action === 'approve') {
      if (!approved_colors?.length && !approved_regions?.length && !approved_grapes?.length) {
        return NextResponse.json(
          { error: 'At least one of approved_colors, approved_regions, or approved_grapes required' },
          { status: 400 },
        );
      }

      await approveSuggestion(
        id,
        approved_colors || [],
        approved_regions || [],
        approved_grapes || [],
        userId,
      );

      // Invalidate cache so approved pairing is immediately available
      invalidatePairingCache();

      return NextResponse.json({ success: true, action: 'approved' });
    }

    if (action === 'reject') {
      await rejectSuggestion(id, userId);
      return NextResponse.json({ success: true, action: 'rejected' });
    }

    return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject"' }, { status: 400 });
  } catch (error: any) {
    console.error('[FoodScan] Suggestion update error:', error);
    return NextResponse.json({ error: 'Update failed', message: error.message }, { status: 500 });
  }
}
