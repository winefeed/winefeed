/**
 * READINESS PACKS API - List & Create
 *
 * GET /api/admin/readiness-packs - List all packs
 * POST /api/admin/readiness-packs - Create new pack
 *
 * Feature flag: FEATURE_PRODUCER_READINESS_PACKS (default: false)
 *
 * POLICY:
 * - Only IOR/admin can access
 * - Packs can ONLY be created for ACCEPTED requests
 * - This is a SERVICE, not priority/access
 */

import { NextRequest, NextResponse } from 'next/server';
import { readinessPackService } from '@/lib/readiness-pack-service';
import {
  isReadinessPacksEnabled,
  createReadinessPackSchema,
} from '@/lib/readiness-pack-types';
import { verifyAuthToken } from '@/lib/access-auth';

// ============================================
// GET - List packs
// ============================================

export async function GET(request: NextRequest) {
  // Feature flag check
  if (!isReadinessPacksEnabled()) {
    return NextResponse.json(
      { error: 'Readiness packs feature is not enabled' },
      { status: 404 }
    );
  }

  try {
    // Auth check (reuse Vinkoll Access auth)
    const authHeader = request.cookies.get('access_admin_token')?.value;
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await verifyAuthToken(authHeader);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { packs, total } = await readinessPackService.listPacks({
      status,
      limit,
      offset,
    });

    return NextResponse.json({ packs, total });
  } catch (error) {
    console.error('[API] GET /api/admin/readiness-packs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create pack
// ============================================

export async function POST(request: NextRequest) {
  // Feature flag check
  if (!isReadinessPacksEnabled()) {
    return NextResponse.json(
      { error: 'Readiness packs feature is not enabled' },
      { status: 404 }
    );
  }

  try {
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

    const parseResult = createReadinessPackSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Create pack
    // POLICY: Service will verify access_request is in ACCEPTED state
    const pack = await readinessPackService.createPack(
      {
        userId: auth.userId,
        userName: auth.email,
      },
      parseResult.data
    );

    return NextResponse.json({ pack }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/admin/readiness-packs error:', error);

    // Handle specific policy errors
    if (error instanceof Error) {
      if (error.message.includes('ACCEPTED')) {
        return NextResponse.json(
          {
            error: 'Policy violation',
            details: error.message,
            code: 'NOT_ACCEPTED',
          },
          { status: 403 }
        );
      }
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          {
            error: 'Duplicate pack',
            details: error.message,
            code: 'DUPLICATE',
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
