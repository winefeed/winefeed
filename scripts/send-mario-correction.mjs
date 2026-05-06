/**
 * Korrigerings-mejl till Mario med smakprov + direktlänk.
 *
 * Skickar via Resend, BCC Markus, uppdaterar restaurant_leads-noten.
 *
 * NOT: detta är en historisk skript — kör inte om utan att uppdatera
 * lösenord-fälten. Klartext-lösenord borttaget från mall efter
 * incident 2026-05-06 (se feedback_credential_handling.md).
 */
import { config } from 'dotenv';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TO = 'Mario.moroni@pontusfrithiof.com';
const BCC = 'markus@winefeed.se';
const FROM = 'Markus på Winefeed <markus@winefeed.se>';
const REPLY_TO = 'markus@winefeed.se';
const SUBJECT = 'PS: smakprov från listan + enklare väg in';

const directLink = 'https://www.winefeed.se/dashboard/new-request?q=' + encodeURIComponent('äldre fransk Bordeaux från 1958 till 2005, alla prisnivåer') + '&autorun=1';

const tableRows = [
  ['Tour Calon', '1958', '750 ml', 'Bordeaux AOC', '229 kr'],
  ['Tour Calon', '1982', '750 ml', 'Bordeaux AOC', '309 kr'],
  ['Tour Calon', '1989', '1500 ml', 'Bordeaux AOC', '789 kr'],
  ['Tour Calon', '2005', '750 ml', 'Bordeaux AOC', '309 kr'],
  ['Bonalgue Bel-Air', '1989', '750 ml', 'Pomerol', '529 kr'],
  ['Bonalgue Bel-Air', '2000', '750 ml', 'Pomerol', '479 kr'],
  ['Lateyron', 'NV', '750 ml', 'Bordeaux AOC', '150 kr'],
  ['La Serenite', '2001', '750 ml', 'Pessac-Léognan', '500 kr'],
  ['Climens', '2005', '750 ml', 'Barsac', '1 200 kr'],
  ['Coutet', '2005', '750 ml', 'Barsac', '490 kr'],
  ['Gruaud Larose', '2003', '750 ml', 'Saint-Julien', '1 060 kr'],
  ['Haut Brion', '2001', '750 ml', 'Pessac-Léognan', '6 310 kr'],
  ['Cheval Blanc', '1999', '750 ml', 'Saint-Émilion GC', '7 380 kr'],
  ['Lafite Rothschild', '1982', '6000 ml (Imperial)', 'Pauillac', '473 060 kr'],
  ['Petrus', '1988', '1500 ml (Magnum)', 'Pomerol', '73 710 kr'],
  ['Petrus', '2003', '3000 ml (Jeroboam)', 'Pomerol', '436 560 kr'],
  ['Le Pin', '2005', '750 ml', 'Pomerol', '48 700 kr'],
  ['Mouton-Rothschild', '05/09/14 mixed case', '6×750 ml', 'Pauillac', '33 230 kr'],
];

function brandHeader() {
  return `<div style="max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#722F37 0%,#8B3A42 100%);padding:28px 20px;text-align:center;border-radius:8px 8px 0 0;"><div style="display:inline-block;"><span style="display:inline-block;width:10px;height:10px;background:#E8DFC4;transform:rotate(45deg);margin-right:-3px;opacity:0.85;"></span><span style="display:inline-block;width:12px;height:12px;background:#E8B4B8;transform:rotate(45deg);margin-right:-3px;opacity:0.8;"></span><span style="display:inline-block;width:10px;height:10px;background:rgba(255,255,255,0.9);transform:rotate(45deg);margin-right:10px;"></span><span style="font-size:26px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;vertical-align:middle;"><span style="font-weight:700;">wine</span><span style="font-weight:300;">feed</span></span></div><p style="color:rgba(255,255,255,0.5);margin:5px 0 0 0;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;">SOURCE &amp; SERVE</p></div><div style="height:3px;background:linear-gradient(90deg,#E8DFC4 0%,#E8B4B8 50%,#722F37 100%);"></div><div style="background:white;padding:30px;font-family:'Plus Jakarta Sans',sans-serif;color:#161412;line-height:1.6;font-size:15px;">`;
}
function brandFooter() {
  return `</div><div style="background:#E8DFC4;padding:20px;text-align:center;border-radius:0 0 8px 8px;"><p style="margin:0;color:#722F37;font-size:12px;font-weight:500;">Winefeed – Din B2B-marknadsplats för vin</p></div></div>`;
}

const tableHtml = `<table style="border-collapse:collapse;width:100%;font-size:13px;margin:8px 0 18px 0;">
<thead><tr style="background:#f4f0e8;">
<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Producent</th>
<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Årgång</th>
<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Format</th>
<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Region</th>
<th style="text-align:right;padding:8px 10px;border-bottom:1px solid #d8d4d3;">Pris ex moms</th>
</tr></thead><tbody>${tableRows.map(r => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r[0]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r[1]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r[2]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r[3]}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums;">${r[4]}</td></tr>`).join('')}</tbody></table>`;

const html = `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><title>${SUBJECT}</title></head><body style="margin:0;padding:0;background:#f9fafb;">
${brandHeader()}
<p style="margin:0 0 18px 0;">Hej Mario!</p>
<p style="margin:0 0 18px 0;">Liten kompletterande info: i förra mejlet bad jag dig klistra in en sökning manuellt. Här är ett <strong>smakprov direkt</strong> så du ser bredden, plus en direktlänk där allt redan är förinställt när du loggar in.</p>
<p style="margin:0 0 8px 0;"><strong>Smakprov</strong> (utdrag — full lista är 91 årgångar från 26 producenter):</p>
${tableHtml}
<p style="margin:0 0 18px 0;">Listan spannar från affordable Tour-Calon (149–309 kr — story-flaskor för menyn) hela vägen upp till Petrus, Lafite Imperial, Le Pin och Mouton-Rothschild för källaren / fine-dining-glasvin.</p>
<p style="margin:0 0 12px 0;"><strong>Direktlänk till hela listan i plattformen</strong> (efter inlogg laddas sökningen automatiskt):</p>
<p style="margin:0 0 18px 0;"><a href="${directLink}" style="color:#722F37;word-break:break-all;">${directLink}</a></p>
<p style="margin:0 0 8px 0;"><strong>Inloggning</strong> (samma som förra mejlet):</p>
<ul style="margin:0 0 18px 0;padding-left:22px;">
  <li>E-post: Mario.moroni@pontusfrithiof.com</li>
  <li>Lösenord: (temp-lösenord från första mejlet)</li>
</ul>
<p style="margin:0 0 18px 0;">Corentin på Brasri (+46 738 240 272 / corentin@brasri.com) sitter på all expertis kring vinerna. Jag hjälper gärna med allt annat — plattformen, vad det än är. Säg till om du vill att vi tar 15 min på telefon.</p>
<p style="margin:24px 0 4px 0;">Mvh</p>
<p style="margin:0;"><strong>Markus</strong></p>
<p style="margin:4px 0 0 0;"><a href="https://winefeed.se" style="color:#722F37;text-decoration:underline;">winefeed.se</a></p>
${brandFooter()}
</body></html>`;

const text = `Hej Mario!

Liten kompletterande info: i förra mejlet bad jag dig klistra in en sökning manuellt. Här är ett smakprov direkt så du ser bredden, plus en direktlänk där allt redan är förinställt när du loggar in.

Smakprov (utdrag — full lista är 91 årgångar från 26 producenter):

${tableRows.map(r => `- ${r[0]} ${r[1]} ${r[2]} ${r[3]} — ${r[4]} ex moms`).join('\n')}

Listan spannar från affordable Tour-Calon (149–309 kr — story-flaskor för menyn) hela vägen upp till Petrus, Lafite Imperial, Le Pin och Mouton-Rothschild för källaren / fine-dining-glasvin.

Direktlänk till hela listan i plattformen (efter inlogg laddas sökningen automatiskt):
${directLink}

Inloggning (samma som förra mejlet):
- E-post: Mario.moroni@pontusfrithiof.com
- Lösenord: (temp-lösenord från första mejlet)

Corentin på Brasri (+46 738 240 272 / corentin@brasri.com) sitter på all expertis kring vinerna. Jag hjälper gärna med allt annat — plattformen, vad det än är. Säg till om du vill att vi tar 15 min på telefon.

Mvh
Markus
winefeed.se`;

console.log('📧 Skickar korrigerings-mejl');
console.log(`   To: ${TO}`);
console.log(`   BCC: ${BCC}`);
console.log(`   Subject: ${SUBJECT}`);

const { data, error } = await resend.emails.send({ from: FROM, to: TO, bcc: BCC, reply_to: REPLY_TO, subject: SUBJECT, html, text });
if (error) { console.error('❌', error); process.exit(1); }
console.log(`✅ Skickat. Resend ID: ${data.id}`);

// Uppdatera CRM
const { data: lead } = await supabase
  .from('restaurant_leads')
  .select('id, notes')
  .ilike('name', 'Pontus Frithiof%')
  .limit(1);

if (lead?.[0]) {
  const today = new Date().toISOString().slice(0, 10);
  const newNote = `[${today}] Korrigerings-mejl skickat till Mario med smakprov-tabell (18 viner) + direktlänk till pre-fillad sökning. URL-param-stöd lagt till i FreeTextEntry-komponenten (commit 3263240). Resend-ID: ${data.id}`;
  const merged = lead[0].notes ? `${lead[0].notes}\n\n${newNote}` : newNote;
  await supabase.from('restaurant_leads').update({
    last_contact_at: new Date().toISOString(),
    notes: merged,
  }).eq('id', lead[0].id);
  console.log('   📋 CRM uppdaterad med korrigerings-not');
}

console.log(`\n✅ Klart. Resend-ID för monitoring: ${data.id}`);
