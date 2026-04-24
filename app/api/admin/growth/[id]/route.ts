/**
 * ADMIN GROWTH PIPELINE — individual lead
 *
 * PATCH  /api/admin/growth/[id]  — update any writable field
 * DELETE /api/admin/growth/[id]  — hard delete
 *
 * Security: ADMIN role required (actorService).
 */

import { NextRequest, NextResponse } from 'next/server';
import { actorService } from '@/lib/actor-service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const WRITABLE = [
  'name', 'city', 'restaurant_type', 'website', 'instagram',
  'contact_name', 'contact_role', 'contact_email', 'contact_phone', 'contact_linkedin',
  'wine_focus_score', 'pilot_fit_score',
  'wine_focus_notes', 'wine_match_notes', 'outreach_angle', 'outreach_draft',
  'status', 'source', 'lead_type', 'notes',
  'next_action', 'next_action_date', 'last_contact_at',
  'signal_type', 'signal_date', 'signal_context',
  'restaurant_id',
] as const;

async function requireAdmin(request: NextRequest): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const tenantId = request.headers.get('x-tenant-id');
  const userId = request.headers.get('x-user-id');
  if (!tenantId || !userId) {
    return { ok: false, response: NextResponse.json({ error: 'Missing authentication context' }, { status: 401 }) };
  }
  const actor = await actorService.resolveActor({ user_id: userId, tenant_id: tenantId });
  if (!actorService.hasRole(actor, 'ADMIN')) {
    return { ok: false, response: NextResponse.json({ error: 'Access denied: ADMIN role required' }, { status: 403 }) };
  }
  return { ok: true };
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const update: Record<string, unknown> = {};
    for (const key of WRITABLE) {
      if (key in body) update[key] = body[key]; // allow explicit null to clear
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No writable fields in body' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('restaurant_leads')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
      console.error('Failed to patch lead:', error);
      return NextResponse.json({ error: 'Update failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ lead: data });
  } catch (error: any) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { error } = await supabase
    .from('restaurant_leads')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete lead:', error);
    return NextResponse.json({ error: 'Delete failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
