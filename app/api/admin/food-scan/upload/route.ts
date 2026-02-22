/**
 * POST /api/admin/food-scan/upload
 *
 * Upload a PDF menu file for AI extraction + pairing analysis.
 * Accepts multipart/form-data with `file` (PDF) + `restaurant_name` (text).
 * REQUIRES: ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { parsePdfMenu } from '@/lib/food-scan/pdf-menu-parser';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const restaurantName = (formData.get('restaurant_name') as string) || '';
    const restaurantId = (formData.get('restaurant_id') as string) || undefined;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Ingen PDF-fil bifogad.' }, { status: 400 });
    }

    if (!restaurantName.trim()) {
      return NextResponse.json({ error: 'Restaurangnamn krävs.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Filen är för stor (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.` },
        { status: 400 },
      );
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Bara PDF-filer stöds.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parsePdfMenu(buffer, restaurantName.trim(), restaurantId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[FoodScan] PDF upload error:', error);
    return NextResponse.json(
      { error: 'PDF-analys misslyckades', message: error.message },
      { status: 500 },
    );
  }
}
