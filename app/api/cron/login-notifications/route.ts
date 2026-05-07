/**
 * /api/cron/login-notifications
 *
 * Vercel Cron (daily 08:00 UTC) — notifies Markus on first login of pilot
 * restaurants and suppliers.
 *
 * Flow:
 * 1. Find all restaurant_leads with status='contacted' AND restaurant_id IS NOT NULL
 * 2. Look up the linked auth user — if last_sign_in_at is set, the invitee
 *    has accepted and signed in for the first time
 * 3. Send Markus a notification, flip lead status to 'onboarded' (idempotent —
 *    the status flip prevents re-notification on subsequent runs)
 *
 * Same flow runs for suppliers via their pipeline rows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const maxDuration = 60;

type LoginEvent = {
  kind: 'restaurant' | 'supplier';
  entityName: string;
  contactName: string | null;
  contactEmail: string;
  signedInAt: string;
  leadId: string;
};

async function findRestaurantLogins(s: any): Promise<LoginEvent[]> {
  const events: LoginEvent[] = [];
  const { data: leads } = await s
    .from('restaurant_leads')
    .select('id, name, contact_name, contact_email, restaurant_id')
    .eq('status', 'contacted')
    .eq('lead_type', 'restaurant')
    .not('restaurant_id', 'is', null);

  for (const lead of leads || []) {
    const { data } = await s.auth.admin.getUserById(lead.restaurant_id);
    const lastSignIn = data?.user?.last_sign_in_at;
    if (lastSignIn) {
      events.push({
        kind: 'restaurant',
        entityName: lead.name,
        contactName: lead.contact_name,
        contactEmail: lead.contact_email || data.user.email || '',
        signedInAt: lastSignIn,
        leadId: lead.id,
      });
    }
  }
  return events;
}

async function findSupplierLogins(s: any): Promise<LoginEvent[]> {
  const events: LoginEvent[] = [];
  const { data: leads } = await s
    .from('restaurant_leads')
    .select('id, name, contact_name, contact_email')
    .eq('status', 'contacted')
    .eq('lead_type', 'importer');

  for (const lead of leads || []) {
    if (!lead.contact_email) continue;
    let userId: string | null = null;
    let p = 1;
    while (p <= 5) {
      const { data } = await s.auth.admin.listUsers({ page: p, perPage: 100 });
      const found = data?.users?.find((u: any) => u.email?.toLowerCase() === lead.contact_email.toLowerCase());
      if (found) { userId = found.id; break; }
      if (!data?.users || data.users.length < 100) break;
      p++;
    }
    if (!userId) continue;
    const { data } = await s.auth.admin.getUserById(userId);
    const lastSignIn = data?.user?.last_sign_in_at;
    if (lastSignIn) {
      events.push({
        kind: 'supplier',
        entityName: lead.name,
        contactName: lead.contact_name,
        contactEmail: lead.contact_email,
        signedInAt: lastSignIn,
        leadId: lead.id,
      });
    }
  }
  return events;
}

function renderNotification(events: LoginEvent[]): { subject: string; html: string; text: string } {
  const count = events.length;
  const subject = count === 1
    ? `${events[0].entityName} loggade in på Winefeed`
    : `${count} pilots loggade in på Winefeed`;

  const rows = events.map(e => {
    const t = new Date(e.signedInAt);
    const tStr = t.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'medium', timeStyle: 'short' });
    return `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f1e9e6; vertical-align: top;">
          <div style="font-weight: 600; color: #161412;">${e.entityName}</div>
          <div style="font-size: 13px; color: #828181;">${e.contactName || ''} · ${e.contactEmail}</div>
          <div style="font-size: 13px; color: #828181;">Loggade in: ${tStr}</div>
          <div style="font-size: 12px; color: #828181; margin-top: 4px;">Typ: ${e.kind === 'restaurant' ? 'Restaurang' : 'Importör'}</div>
        </td>
      </tr>`;
  }).join('');

  const html = `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, sans-serif;">
    <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A42 100%); padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <div style="font-size: 22px; color: white;"><span style="font-weight: 700;">wine</span><span style="font-weight: 300;">feed</span></div>
      <p style="color: rgba(255,255,255,0.6); margin: 5px 0 0 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;">Pilot login</p>
    </div>
    <div style="background: white; padding: 28px 28px; line-height: 1.55;">
      <p style="margin: 0 0 16px 0; font-size: 15px;">${count === 1 ? 'En pilot' : `${count} pilots`} loggade in för första gången sedan senaste körningen:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 0 0 16px 0;">${rows}</table>
      <p style="margin: 22px 0 0 0; font-size: 13px; color: #828181;">Status uppdaterad i pipeline (contacted → onboarded). Cron körs dagligen 08:00 UTC.</p>
    </div>
  </div>`;

  const text = `${count === 1 ? 'En pilot' : `${count} pilots`} loggade in för första gången:\n\n` +
    events.map(e => {
      const t = new Date(e.signedInAt).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' });
      return `${e.entityName} (${e.kind})\n${e.contactName || ''} · ${e.contactEmail}\nLoggade in: ${t}\n`;
    }).join('\n') +
    `\nStatus uppdaterad i pipeline (contacted → onboarded).`;

  return { subject, html, text };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const [restaurantEvents, supplierEvents] = await Promise.all([
      findRestaurantLogins(supabase),
      findSupplierLogins(supabase),
    ]);
    const events = [...restaurantEvents, ...supplierEvents];

    if (events.length === 0) {
      return NextResponse.json({ ok: true, notified: 0, message: 'No new logins' });
    }

    const { subject, html, text } = renderNotification(events);
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const { error: sendErr } = await resend.emails.send({
      from: 'Winefeed Pilot Tracker <noreply@winefeed.se>',
      to: ['markus@winefeed.se'],
      bcc: ['markus_nilsson@hotmail.com'],
      subject,
      html,
      text,
    });
    if (sendErr) {
      console.error('Notification mail failed:', sendErr);
      return NextResponse.json({ error: 'Mail send failed', details: sendErr }, { status: 500 });
    }

    const leadIds = events.map(e => e.leadId);
    const { error: updErr } = await supabase
      .from('restaurant_leads')
      .update({ status: 'onboarded', updated_at: new Date().toISOString() })
      .in('id', leadIds);
    if (updErr) console.error('Pipeline update failed:', updErr);

    return NextResponse.json({
      ok: true,
      notified: events.length,
      events: events.map(e => ({ name: e.entityName, signedInAt: e.signedInAt, kind: e.kind })),
    });
  } catch (err: any) {
    console.error('login-notifications cron error:', err);
    return NextResponse.json({ error: 'Internal error', details: err.message }, { status: 500 });
  }
}
