/**
 * WINE PROPOSAL RESPOND API
 *
 * POST /api/vinforslag/[id]/respond?s={signature}
 * Public endpoint — requires valid HMAC signature.
 * Records a restaurant's interest response for a wine proposal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { verifyProposalSignature } from '@/lib/proposal-token';
import { sendEmail, WINEFEED_FROM } from '@/lib/email-service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Ogiltigt förslags-ID' }, { status: 400 });
  }

  // Verify HMAC signature
  const sig = request.nextUrl.searchParams.get('s');
  if (!sig || !verifyProposalSignature(id, sig)) {
    return NextResponse.json({ error: 'Ogiltig länk' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 });
  }

  const { contact_name, contact_email, message, interested_wine_ids } = body;

  // Validate required fields
  if (!contact_name || typeof contact_name !== 'string' || contact_name.trim().length === 0) {
    return NextResponse.json({ error: 'Namn krävs' }, { status: 400 });
  }

  if (!contact_email || typeof contact_email !== 'string' || !EMAIL_REGEX.test(contact_email)) {
    return NextResponse.json({ error: 'Giltig e-postadress krävs' }, { status: 400 });
  }

  // Validate interested_wine_ids is array of UUIDs (if provided)
  if (interested_wine_ids !== undefined && interested_wine_ids !== null) {
    if (!Array.isArray(interested_wine_ids)) {
      return NextResponse.json({ error: 'interested_wine_ids måste vara en array' }, { status: 400 });
    }
    for (const wineId of interested_wine_ids) {
      if (!UUID_REGEX.test(wineId)) {
        return NextResponse.json({ error: 'Ogiltigt vin-ID i listan' }, { status: 400 });
      }
    }
  }

  const adminClient = getSupabaseAdmin();

  // Verify proposal exists and is not expired
  const { data: proposal, error: proposalError } = await adminClient
    .from('wine_proposals')
    .select('id, expires_at')
    .eq('id', id)
    .single();

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Förslaget hittades inte' }, { status: 404 });
  }

  if (proposal.expires_at && new Date(proposal.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Förslaget har gått ut' }, { status: 410 });
  }

  // Insert response
  const { error: insertError } = await adminClient
    .from('wine_proposal_responses')
    .insert({
      proposal_id: id,
      contact_name: contact_name.trim(),
      contact_email: contact_email.trim().toLowerCase(),
      message: message?.trim() || null,
      interested_wine_ids: interested_wine_ids?.length > 0 ? interested_wine_ids : null,
    });

  if (insertError) {
    console.error('[vinforslag] Error inserting response:', insertError);
    return NextResponse.json({ error: 'Kunde inte spara svar' }, { status: 500 });
  }

  // Send notification email to admin (fire-and-forget)
  notifyAdmin(id, contact_name.trim(), contact_email.trim(), message?.trim(), interested_wine_ids).catch(
    (err) => console.error('[vinforslag] Notification email failed:', err)
  );

  return NextResponse.json({ success: true }, { status: 201 });
}

async function notifyAdmin(
  proposalId: string,
  contactName: string,
  contactEmail: string,
  message: string | null | undefined,
  interestedWineIds: string[] | null | undefined
) {
  const supabase = getSupabaseAdmin();

  // Fetch proposal + wine names for context
  const { data: proposal } = await supabase
    .from('wine_proposals')
    .select('restaurant_name, restaurant_city')
    .eq('id', proposalId)
    .single();

  let wineNames: string[] = [];
  if (interestedWineIds?.length) {
    const { data: wines } = await supabase
      .from('supplier_wines')
      .select('name, vintage')
      .in('id', interestedWineIds);
    wineNames = wines?.map(w => `${w.name}${w.vintage ? ` ${w.vintage}` : ''}`) || [];
  }

  const restaurantLabel = proposal
    ? `${proposal.restaurant_name}${proposal.restaurant_city ? ` (${proposal.restaurant_city})` : ''}`
    : 'Okänd restaurang';

  const subject = `Vinförslag: ${contactName} från ${restaurantLabel} har svarat`;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <h2 style="color: #722F37; margin-bottom: 16px;">Nytt svar på vinförslag</h2>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <tr><td style="padding: 6px 12px 6px 0; color: #6b7280;">Restaurang</td><td style="padding: 6px 0; font-weight: 600;">${restaurantLabel}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #6b7280;">Kontakt</td><td style="padding: 6px 0;">${contactName} &lt;${contactEmail}&gt;</td></tr>
        ${wineNames.length > 0 ? `<tr><td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top;">Intresserad av</td><td style="padding: 6px 0;">${wineNames.join('<br>')}</td></tr>` : ''}
        ${message ? `<tr><td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top;">Meddelande</td><td style="padding: 6px 0;">${message}</td></tr>` : ''}
      </table>
      <p style="margin-top: 20px; font-size: 13px;">
        <a href="https://www.winefeed.se/admin/proposals" style="color: #722F37;">Visa i admin →</a>
      </p>
    </div>`;

  const text = [
    `Nytt svar på vinförslag`,
    `Restaurang: ${restaurantLabel}`,
    `Kontakt: ${contactName} <${contactEmail}>`,
    wineNames.length > 0 ? `Intresserad av: ${wineNames.join(', ')}` : '',
    message ? `Meddelande: ${message}` : '',
  ].filter(Boolean).join('\n');

  await sendEmail({
    to: 'markus@winefeed.se',
    from: WINEFEED_FROM,
    subject,
    html,
    text,
  });
}
