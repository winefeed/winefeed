/**
 * GET /api/admin/access/wines
 *
 * Public wine search. Params: q, type, country, region, grape, page, limit
 * Returns paginated wines with producer name + lot count.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchWines, getWineFilters } from '@/lib/access-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const params = {
      q: searchParams.get('q') || undefined,
      type: searchParams.get('type') || undefined,
      country: searchParams.get('country') || undefined,
      region: searchParams.get('region') || undefined,
      grape: searchParams.get('grape') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '20'), 50),
    };

    const [result, filters] = await Promise.all([
      searchWines(params),
      getWineFilters(),
    ]);

    return NextResponse.json({ ...result, filters });
  } catch (error: any) {
    console.error('Wine search error:', error);
    return NextResponse.json(
      { error: 'Failed to search wines', message: error.message },
      { status: 500 }
    );
  }
}
