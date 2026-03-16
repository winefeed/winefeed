/**
 * /api/admin/proposals
 *
 * GET  — List all proposals (with response counts)
 * POST — Create a new proposal with wine items
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { signProposalId, buildProposalUrl } from '@/lib/proposal-token';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: proposals, error } = await supabase
    .from('wine_proposals')
    .select(`
      *,
      wine_proposal_items(id, supplier_wine_id, reason, sort_order,
        supplier_wines(id, name, vintage, supplier:suppliers(namn))
      ),
      wine_proposal_responses(id, contact_name, contact_email, interested_wine_ids, created_at)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add shareable link info
  const enriched = proposals?.map(p => ({
    ...p,
    share_url: buildProposalUrl(p.id),
    response_count: p.wine_proposal_responses?.length || 0,
    wine_count: p.wine_proposal_items?.length || 0,
    is_expired: p.expires_at ? new Date(p.expires_at) < new Date() : false,
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { restaurant_name, restaurant_city, message, expires_at, wine_ids } = body;

    if (!restaurant_name) {
      return NextResponse.json({ error: 'restaurant_name krävs' }, { status: 400 });
    }

    if (!wine_ids || !Array.isArray(wine_ids) || wine_ids.length === 0) {
      return NextResponse.json({ error: 'Minst ett vin måste väljas' }, { status: 400 });
    }

    // Create proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('wine_proposals')
      .insert({
        restaurant_name,
        restaurant_city: restaurant_city || null,
        message: message || null,
        expires_at: expires_at || null,
      })
      .select()
      .single();

    if (proposalError) {
      return NextResponse.json({ error: proposalError.message }, { status: 500 });
    }

    // Add wine items
    const items = wine_ids.map((wineId: string, index: number) => ({
      proposal_id: proposal.id,
      supplier_wine_id: wineId,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from('wine_proposal_items')
      .insert(items);

    if (itemsError) {
      // Rollback proposal
      await supabase.from('wine_proposals').delete().eq('id', proposal.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const shareUrl = buildProposalUrl(proposal.id);

    return NextResponse.json({
      ...proposal,
      share_url: shareUrl,
      full_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.winefeed.se'}${shareUrl}`,
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
