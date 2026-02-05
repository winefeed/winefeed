/**
 * IOR MESSAGE TEMPLATES API
 *
 * GET /api/ior/templates - Get available message templates
 *   Query params: category (optional filter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireIORContext, isGuardError, guardErrorResponse } from '@/lib/ior-route-guard';
import { getTemplates, getTemplatesGrouped } from '@/lib/ior-message-templates';

export async function GET(request: NextRequest) {
  try {
    const guard = await requireIORContext(request);
    if (isGuardError(guard)) return guardErrorResponse(guard);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const grouped = searchParams.get('grouped') === 'true';

    if (grouped) {
      const templates = getTemplatesGrouped();
      return NextResponse.json({ templates });
    }

    const templates = getTemplates(category);
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[API] GET /api/ior/templates error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
