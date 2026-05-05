/**
 * Outreach-fabriken. Två-stegs CLI:
 *   node scripts/outreach.mjs compose <leadId> [--hook="..."] [--subject="..."] [--tags=t1,t2] [--profile-fit="..."]
 *   node scripts/outreach.mjs send <leadId>
 *
 * compose: hämtar lead, infererar tags, plockar viner, genererar mejl, sparar
 *          till /tmp/outreach-<leadId>.json + skriver ut preview.
 * send:    läser draften, skickar via Resend (BCC markus), uppdaterar CRM.
 *
 * Du kör compose, granskar preview, ev. redigerar /tmp/outreach-<id>.json
 * direkt om du vill finputsa, sedan send.
 */
import { config } from 'dotenv';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { inferTags } from '../lib/outreach/profile-tags.mjs';
import { pickWineExamples } from '../lib/outreach/wine-picker.mjs';
import { composeOutreach } from '../lib/outreach/email-composer.mjs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const args = process.argv.slice(2);
const action = args[0];
const leadId = args[1];

function getFlag(name) {
  const idx = args.findIndex(a => a.startsWith('--' + name + '='));
  if (idx < 0) return null;
  return args[idx].split('=').slice(1).join('=');
}

if (!action || !leadId) {
  console.error('Usage:');
  console.error('  node scripts/outreach.mjs compose <leadId> [--hook="..."] [--subject="..."] [--tags=t1,t2] [--profile-fit="..."]');
  console.error('  node scripts/outreach.mjs send <leadId>');
  process.exit(1);
}

const draftPath = `/tmp/outreach-${leadId}.json`;

if (action === 'compose') {
  const { data: lead, error } = await supabase.from('restaurant_leads').select('*').eq('id', leadId).single();
  if (error || !lead) { console.error('❌ Hittar inte lead:', leadId, error?.message); process.exit(1); }
  if (!lead.contact_email) { console.error('❌ Lead saknar contact_email:', lead.name); process.exit(1); }

  // Tags
  let tags = inferTags(lead);
  const tagsOverride = getFlag('tags');
  if (tagsOverride) {
    tags = new Set(tagsOverride.split(',').map(t => t.trim()).filter(Boolean));
  }
  console.log('🏷  Profil-tags:', [...tags].join(', ') || '(inga)');

  // Wine examples
  const wines = await pickWineExamples(supabase, tags, { count: 4 });
  console.log(`🍷 Plockade ${wines.length} viner ur katalogen:`);
  for (const w of wines) {
    const sek = ((w.price_ex_vat_sek || 0) / 100).toLocaleString('sv-SE');
    console.log(`   - ${w.producer || w.name} ${w.vintage > 0 ? w.vintage : ''} | ${w.region || w.country} | ${sek} kr`);
  }

  // Hook + subject
  const hook = getFlag('hook') || `Vi har följt ${lead.name} en tid och ville höra av oss.`;
  const subject = getFlag('subject') || `Sourcing till ${lead.name}?`;
  const profileFitNote = getFlag('profile-fit') || null;

  const composed = composeOutreach({ lead, wines, openingHook: hook, subject, profileFitNote });

  // Spara draft
  const draft = {
    leadId,
    leadName: lead.name,
    to: lead.contact_email,
    bcc: 'markus@winefeed.se',
    from: 'Markus på Winefeed <markus@winefeed.se>',
    reply_to: 'markus@winefeed.se',
    tags: [...tags],
    wineIds: wines.map(w => w.id),
    ...composed,
    composedAt: new Date().toISOString(),
  };
  writeFileSync(draftPath, JSON.stringify(draft, null, 2));

  console.log('\n📝 PREVIEW:');
  console.log('To:', draft.to);
  console.log('Subject:', draft.subject);
  console.log('---');
  console.log(draft.text);
  console.log('---');
  console.log(`\nDraft sparad: ${draftPath}`);
  console.log(`Skicka med: node scripts/outreach.mjs send ${leadId}`);

} else if (action === 'send') {
  if (!existsSync(draftPath)) { console.error('❌ Ingen draft för', leadId, '— kör compose först'); process.exit(1); }
  const draft = JSON.parse(readFileSync(draftPath, 'utf-8'));
  const resend = new Resend(process.env.RESEND_API_KEY);

  console.log('📧 Skickar:', draft.to);
  const { data, error } = await resend.emails.send({
    from: draft.from,
    to: draft.to,
    bcc: draft.bcc,
    reply_to: draft.reply_to,
    subject: draft.subject,
    html: draft.html,
    text: draft.text,
  });
  if (error) { console.error('❌', error); process.exit(1); }
  console.log('✅ Resend ID:', data.id);

  // Uppdatera CRM
  const today = new Date().toISOString().slice(0, 10);
  const followUp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: lead } = await supabase.from('restaurant_leads').select('notes, status').eq('id', draft.leadId).single();
  const newNote = `[${today}] Outreach skickat via outreach-fabriken. Tags: ${draft.tags.join(', ')}. Viner pitchade: ${draft.wineIds.length}. Resend-ID: ${data.id}`;
  const merged = lead?.notes ? `${lead.notes}\n\n${newNote}` : newNote;
  const newStatus = lead?.status === 'identified' || lead?.status === 'researched' ? 'contacted' : lead?.status;
  await supabase.from('restaurant_leads').update({
    last_contact_at: new Date().toISOString(),
    next_action_date: followUp,
    next_action: 'Följ upp om inget svar',
    notes: merged,
    status: newStatus,
  }).eq('id', draft.leadId);
  console.log('📋 CRM uppdaterad. Status:', newStatus, '| Next action:', followUp);

} else {
  console.error('Okänd action:', action);
  process.exit(1);
}
