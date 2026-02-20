/**
 * POST /api/admin/access/wines/import
 *
 * Bulk import wines from Brasri catalog JSON.
 * Requires authenticated admin user.
 *
 * Body: { items: any[], importer_name: string, dry_run?: boolean }
 * Returns: ImportResult
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { importBrasriCatalog } from '@/lib/access-import';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Validation failed', errors: ['items must be a non-empty array'] },
        { status: 400 },
      );
    }

    if (!body.importer_name?.trim()) {
      return NextResponse.json(
        { error: 'Validation failed', errors: ['importer_name required'] },
        { status: 400 },
      );
    }

    const result = await importBrasriCatalog(
      body.items,
      body.importer_name.trim(),
      { dryRun: !!body.dry_run },
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Wine import error:', error);
    return NextResponse.json(
      { error: 'Import failed', message: error.message },
      { status: 500 },
    );
  }
}
