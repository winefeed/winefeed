/**
 * POST /api/me/restaurant/license
 *
 * Upload serving license file (PDF/image) to Supabase Storage.
 * Returns the public URL, which is then saved on the restaurant record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createRouteClients } from '@/lib/supabase/route-client';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const BUCKET = 'serving-licenses';

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const actor = await actorService.resolveActor({
      user_id: userId,
      tenant_id: tenantId,
    });

    if (!actor.restaurant_id) {
      return NextResponse.json(
        { error: 'User is not associated with a restaurant' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Filtyp stöds inte. Använd PDF, JPG, PNG eller WebP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Filen är för stor (max 10 MB)' },
        { status: 400 }
      );
    }

    const { adminClient } = await createRouteClients();

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop() || 'pdf';
    const filePath = `${actor.restaurant_id}/license.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Kunde inte ladda upp filen' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    // Update restaurant record
    await adminClient
      .from('restaurants')
      .update({ serving_license_file_url: fileUrl })
      .eq('id', actor.restaurant_id);

    return NextResponse.json({
      url: fileUrl,
    });
  } catch (error: any) {
    console.error('License upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
