/**
 * Skickar follow-up till Marcus Fransman / Vita Amandi (Nässjö).
 *
 * Avsiktlig produktions-outreach godkänd av Markus 2026-05-05.
 *
 * To: marcus@vitaamandi.se (personlig, inte info@)
 * BCC: markus@winefeed.se
 *
 * Personlig kontext: Marcus är vän till Markus, första kontakt via
 * Messenger 2026-02-18, registrerade konto samma dag, loggade in
 * senast 2026-04-29 (men inga requests/aktivitet). Vinkel: Chile-
 * provning förra året + äldre Bordeaux story-flaskor + 15 min hjälp
 * att lägga första förfrågan tillsammans.
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

const TO = 'marcus@vitaamandi.se';
const BCC = 'markus@winefeed.se';
const FROM = 'Markus på Winefeed <markus@winefeed.se>';
const REPLY_TO = 'markus@winefeed.se';
const SUBJECT = 'Vita Amandi + Winefeed-uppdatering';

function brandHeader() {
  return `<div style="max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#722F37 0%,#8B3A42 100%);padding:28px 20px;text-align:center;border-radius:8px 8px 0 0;"><div style="display:inline-block;"><span style="display:inline-block;width:10px;height:10px;background:#E8DFC4;transform:rotate(45deg);margin-right:-3px;opacity:0.85;"></span><span style="display:inline-block;width:12px;height:12px;background:#E8B4B8;transform:rotate(45deg);margin-right:-3px;opacity:0.8;"></span><span style="display:inline-block;width:10px;height:10px;background:rgba(255,255,255,0.9);transform:rotate(45deg);margin-right:10px;"></span><span style="font-size:26px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;vertical-align:middle;"><span style="font-weight:700;">wine</span><span style="font-weight:300;">feed</span></span></div><p style="color:rgba(255,255,255,0.5);margin:5px 0 0 0;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;">SOURCE &amp; SERVE</p></div><div style="height:3px;background:linear-gradient(90deg,#E8DFC4 0%,#E8B4B8 50%,#722F37 100%);"></div><div style="background:white;padding:30px;font-family:'Plus Jakarta Sans',sans-serif;color:#161412;line-height:1.6;font-size:15px;">`;
}
function brandFooter() {
  return `</div><div style="background:#E8DFC4;padding:20px;text-align:center;border-radius:0 0 8px 8px;"><p style="margin:0;color:#722F37;font-size:12px;font-weight:500;">Winefeed – Din B2B-marknadsplats för vin</p></div></div>`;
}

const html = `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><title>${SUBJECT}</title></head><body style="margin:0;padding:0;background:#f9fafb;">
${brandHeader()}
<p style="margin:0 0 18px 0;">Marcus!</p>
<p style="margin:0 0 18px 0;">Såg att du varit inne på plattformen senast i veckan, kul. Tänkte följa upp lite eftersom det hänt en del.</p>
<p style="margin:0 0 18px 0;">Katalogen ligger på ~615 viner nu — tyngdpunkt fransk Bordeaux (470 titlar), plus Mosel-Riesling, Nya Zeeland Pinot Noir, <strong>9 chilenska viner från Maule och Itata</strong> (passande att nämna efter Chile-provningen jag höll hos er förra året) och ekologiska sydafrikanska. <strong>Vi utökar katalogen ganska snabbt nu, så det lönar sig att hålla koll löpande.</strong></p>
<p style="margin:0 0 18px 0;">En sak som kanske är extra intressant för er: vi har <strong>äldre Bordeaux med riktigt djup</strong>. Château Tour-Calon (Castillon Côtes de Bordeaux) finns t.ex. i 32 årgångar från 1958 till 2018 — 2005 ligger på 309 kr ex moms, så det går faktiskt att servera 20-årig Bordeaux som glasvin. Plus klassisk högerstrand som Bonalgue Bel-Air (Pomerol) i flera årgångar. Story-flaskor som passar er vin-först-filosofi och 600 kr-provningar.</p>
<p style="margin:0 0 18px 0;">Er vin-först-filosofi och roterande sortiment är ungefär exakt det plattformen är byggd för. Lägg en förfrågan ("Saint-Émilion under 250 kr") och få offert tillbaka från flera importörer på ett bräde.</p>
<p style="margin:0 0 18px 0;">Helt gratis för restauranger, vi sköter all importpappersexercis vid direktimport. <strong>Säg till om du vill att vi tar 15 minuter över telefon och lägger din första förfrågan live tillsammans, så kommer du igång på riktigt.</strong></p>
<p style="margin:24px 0 4px 0;">/Markus</p>
<p style="margin:4px 0 0 0;"><a href="https://winefeed.se" style="color:#722F37;text-decoration:underline;">winefeed.se</a></p>
${brandFooter()}
</body></html>`;

const text = `Marcus!

Såg att du varit inne på plattformen senast i veckan, kul. Tänkte följa upp lite eftersom det hänt en del.

Katalogen ligger på ~615 viner nu — tyngdpunkt fransk Bordeaux (470 titlar), plus Mosel-Riesling, Nya Zeeland Pinot Noir, 9 chilenska viner från Maule och Itata (passande att nämna efter Chile-provningen jag höll hos er förra året) och ekologiska sydafrikanska. Vi utökar katalogen ganska snabbt nu, så det lönar sig att hålla koll löpande.

En sak som kanske är extra intressant för er: vi har äldre Bordeaux med riktigt djup. Château Tour-Calon (Castillon Côtes de Bordeaux) finns t.ex. i 32 årgångar från 1958 till 2018 — 2005 ligger på 309 kr ex moms, så det går faktiskt att servera 20-årig Bordeaux som glasvin. Plus klassisk högerstrand som Bonalgue Bel-Air (Pomerol) i flera årgångar. Story-flaskor som passar er vin-först-filosofi och 600 kr-provningar.

Er vin-först-filosofi och roterande sortiment är ungefär exakt det plattformen är byggd för. Lägg en förfrågan ("Saint-Émilion under 250 kr") och få offert tillbaka från flera importörer på ett bräde.

Helt gratis för restauranger, vi sköter all importpappersexercis vid direktimport. Säg till om du vill att vi tar 15 minuter över telefon och lägger din första förfrågan live tillsammans, så kommer du igång på riktigt.

/Markus
winefeed.se`;

console.log('📧 Skickar follow-up');
console.log(`   To: ${TO}`);
console.log(`   BCC: ${BCC}`);
console.log(`   Subject: ${SUBJECT}`);

const { data, error } = await resend.emails.send({ from: FROM, to: TO, bcc: BCC, reply_to: REPLY_TO, subject: SUBJECT, html, text });
if (error) { console.error('❌', error); process.exit(1); }
console.log(`✅ Skickat. Resend ID: ${data.id}`);

// Uppdatera DB
const { data: existing } = await supabase
  .from('restaurant_leads')
  .select('id, notes, contact_email')
  .ilike('name', 'Vita Amandi')
  .limit(1);

if (existing && existing.length > 0) {
  const today = new Date().toISOString().slice(0, 10);
  const followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const newNote = `[${today}] Follow-up #2 skickat till marcus@vitaamandi.se. Vinkel: katalog-uppdatering (615 viner, 9 Chile från Maule/Itata) + äldre Bordeaux story-flaskor (Tour-Calon 1958-2018) + erbjudande om 15 min telefonhjälp att lägga första förfrågan. Marcus loggade in 2026-04-29 men ingen aktivitet ännu. Resend-ID: ${data.id}`;
  const merged = existing[0].notes ? `${existing[0].notes}\n\n${newNote}` : newNote;
  const { error: updErr } = await supabase
    .from('restaurant_leads')
    .update({
      contact_email: 'marcus@vitaamandi.se',
      last_contact_at: new Date().toISOString(),
      next_action_date: followUpDate,
      next_action: 'Följ upp om inget svar (eller boka 15 min hjälp-samtal)',
      notes: merged,
    })
    .eq('id', existing[0].id);
  if (updErr) console.error('⚠️ DB-fel:', updErr.message);
  else console.log(`📋 DB uppdaterad (notes appendad, contact_email satt till marcus@, next_action ${followUpDate})`);
}
