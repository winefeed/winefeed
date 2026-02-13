/**
 * DOCUMENT TYPES API
 *
 * GET /api/document-types
 *
 * Returns all available import document types.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteClients } from '@/lib/supabase/route-client';

export async function GET(request: NextRequest) {
  try {
    const { userClient } = await createRouteClients();

    const { data, error } = await userClient
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
