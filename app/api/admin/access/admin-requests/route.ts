/**
 * /api/admin/access/admin-requests
 *
 * GET: list all requests for admin cockpit (requires Supabase auth)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestsForAdmin } from '@/lib/access-service';

export async function GET() {
  try {
    // Admin auth: check Supabase session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await getRequestsForAdmin();
    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('Admin requests fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
