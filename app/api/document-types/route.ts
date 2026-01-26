/**
 * DOCUMENT TYPES API
 *
 * GET /api/document-types
 *
 * Returns all available import document types.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('import_document_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching document types:', error);
      return NextResponse.json(
        { error: 'Failed to fetch document types', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documentTypes: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('Error in document types API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
