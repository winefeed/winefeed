/**
 * READINESS PACKS API - Single Pack Operations
 *
 * GET /api/admin/readiness-packs/[id] - Get pack with events
 * PATCH /api/admin/readiness-packs/[id] - Update pack
 *
 * Feature flag: FEATURE_PRODUCER_READINESS_PACKS (default: false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { readinessPackService } from '@/lib/readiness-pack-service';
import {
  isReadinessPacksEnabled,
  updateReadinessPackSchema,
} from '@/lib/readiness-pack-types';
import { verifyAuthToken } from '@/lib/access-auth';

// ============================================
// GET - Get pack with events
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Feature flag check
  if (!isReadinessPacksEnabled()) {
    return NextResponse.json(
      { error: 'Readiness packs feature is not enabled' },
      { status: 404 }
    );
  }

  try {
    const { id } = await params;

    // Auth check
    const authHeader = request.cookies.get('access_admin_token')?.value;
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyAuthToken(authHeader);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get pack with request info
    const pack = await readinessPackService.getPack(id);
    if (!pack) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    }

    // Get events
    const events = await readinessPackService.getPackEvents(id);

    return NextResponse.json({ pack, events });
  } catch (error) {
    console.error('[API] GET /api/admin/readiness-packs/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update pack
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Feature flag check
  if (!isReadinessPacksEnabled()) {
    return NextResponse.json(
      { error: 'Readiness packs feature is not enabled' },
      { status: 404 }
    );
  }

  try {
    const { id } = await params;

    // Auth check
    const authHeader = request.cookies.get('access_admin_token')?.value;
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyAuthToken(authHeader);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse and validate body
    const body = await request.json();

    const parseResult = updateReadinessPackSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Update pack
    const pack = await readinessPackService.updatePack(
      {
        userId: auth.userId,
        userName: auth.email,
      },
      id,
      parseResult.data
    );

    return NextResponse.json({ pack });
  } catch (error) {
    console.error('[API] PATCH /api/admin/readiness-packs/[id] error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
