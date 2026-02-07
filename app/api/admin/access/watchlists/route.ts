/**
 * /api/admin/access/watchlists
 *
 * GET: list consumer's watchlists (auth required)
 * POST: create watchlist (auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccessConsumerId } from '@/lib/access-auth';
import { getWatchlistsByConsumer, createWatchlist, logAccessEvent } from '@/lib/access-service';

export async function GET() {
  try {
    const consumerId = await getAccessConsumerId();
    if (!consumerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const watchlists = await getWatchlistsByConsumer(consumerId);
    return NextResponse.json(watchlists);
  } catch (error: any) {
    console.error('Watchlist fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchlists' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const consumerId = await getAccessConsumerId();
    if (!consumerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_type, target_id, query_json, note } = body;

    if (!target_type) {
      return NextResponse.json({ error: 'target_type krävs' }, { status: 400 });
    }

    const watchlist = await createWatchlist(consumerId, {
      target_type,
      target_id,
      query_json,
      note,
    });

    await logAccessEvent('WATCHLIST_CREATED', consumerId, {
      watchlist_id: watchlist.id,
      target_type,
    });

    return NextResponse.json(watchlist, { status: 201 });
  } catch (error: any) {
    console.error('Watchlist create error:', error);
    return NextResponse.json(
      { error: 'Failed to create watchlist' },
      { status: 500 }
    );
  }
}
