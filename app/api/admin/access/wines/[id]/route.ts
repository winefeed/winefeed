/**
 * GET /api/admin/access/wines/[id]
 *
 * Wine detail with available lots + importer info.
 * No note_private exposed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWineById } from '@/lib/access-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wine = await getWineById(id);

    if (!wine) {
      return NextResponse.json(
        { error: 'Wine not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(wine);
  } catch (error: any) {
    console.error('Wine detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wine', message: error.message },
      { status: 500 }
    );
  }
}
