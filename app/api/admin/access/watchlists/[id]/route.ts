/**
 * DELETE /api/admin/access/watchlists/[id]
 *
 * Remove watchlist entry (auth + ownership check)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccessConsumerId } from '@/lib/access-auth';
import { deleteWatchlist, logAccessEvent } from '@/lib/access-service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const consumerId = await getAccessConsumerId();
    if (!consumerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await deleteWatchlist(consumerId, id);

    await logAccessEvent('WATCHLIST_DELETED', consumerId, { watchlist_id: id });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Watchlist delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete watchlist' },
      { status: 500 }
    );
  }
}
