/**
 * Skapar Mario-konto + Pontus-restaurang + skickar intro-mejl.
 *
 * Användning:
 *   MARIO_EMAIL=mario@... node scripts/send-mario-pontus-onboarding.mjs
 *
 * Vad skriptet gör:
 * 1. Skapar Supabase auth-user för Mario med user_type='restaurant'
 *    metadata (DB-trigger skapar automatiskt restaurants-rad + restaurant_users-link)
 * 2. Sätter ett temp-lösenord
 * 3. Patchar restaurants-raden med org_number, address, phone
 * 4. Skickar intro-mejl med login + temp-lösenord + förifyllt sökord
 * 5. Uppdaterar restaurant_leads med status och notes
 */
import { config } from 'dotenv';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

config({ path: '.env.local' });

const MARIO_EMAIL = process.env.MARIO_EMAIL;
if (!MARIO_EMAIL) {
  console.error('❌ Sätt MARIO_EMAIL=mario@... innan körning');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const resend = new Resend(process.env.RESEND_API_KEY);

const RESTAURANT_NAME = 'Pontus Frithiof city venues';
const ORG_NUMBER = '556600-5293';
const TEMP_PASSWORD = 'Pontus' + randomBytes(4).toString('hex') + '!';

// === Steg 1: Skapa auth user (trigger skapar restaurants + restaurant_users) ===
console.log('🔐 Skapar Supabase auth-user för', MARIO_EMAIL);

const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email: MARIO_EMAIL,
  password: TEMP_PASSWORD,
  email_confirm: true,
  user_metadata: {
    user_type: 'restaurant',
    name: RESTAURANT_NAME,
    role: 'admin',
  },
});

if (createErr) {
  console.error('❌ Auth-fel:', createErr.message);
  process.exit(1);
}

const userId = created.user.id;
console.log(`   ✓ Auth-user skapad (${userId})`);

// Vänta lite så triggern hunnit skapa restaurants-raden
await new Promise(r => setTimeout(r, 1500));

// === Steg 2: Patcha restaurants med metadata ===
console.log('🍽  Uppdaterar restaurants-raden med org/adress...');

const { error: restErr } = await supabase
  .from('restaurants')
  .update({
    org_number: ORG_NUMBER,
    address_line1: 'Box 12011',
    postal_code: '102 21',
    city: 'Stockholm',
    contact_phone: '08-23 99 50',
    cuisine_type: ['fine_dining'],
    price_segment: 'fine-dining',
    wine_preference_notes: 'Äldre fransk Bordeaux och premium-collector-flaskor. Sommelier Mario Moroni. Restaurangkedja (~7 koncept) i Stockholm.',
    onboarding_completed_at: new Date().toISOString(),
  })
  .eq('id', userId);

if (restErr) console.error('   ⚠️', restErr.message);
else console.log('   ✓ Restaurang-metadata uppdaterad');

// === Steg 3: Bygg intro-mejl ===
const LOGIN_URL = 'https://www.winefeed.se/login';
const NEW_REQUEST_URL = 'https://www.winefeed.se/dashboard/new-request';

function brandHeader() {
  return `<div style="max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#722F37 0%,#8B3A42 100%);padding:28px 20px;text-align:center;border-radius:8px 8px 0 0;"><div style="display:inline-block;"><span style="display:inline-block;width:10px;height:10px;background:#E8DFC4;transform:rotate(45deg);margin-right:-3px;opacity:0.85;"></span><span style="display:inline-block;width:12px;height:12px;background:#E8B4B8;transform:rotate(45deg);margin-right:-3px;opacity:0.8;"></span><span style="display:inline-block;width:10px;height:10px;background:rgba(255,255,255,0.9);transform:rotate(45deg);margin-right:10px;"></span><span style="font-size:26px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;vertical-align:middle;"><span style="font-weight:700;">wine</span><span style="font-weight:300;">feed</span></span></div><p style="color:rgba(255,255,255,0.5);margin:5px 0 0 0;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;">SOURCE &amp; SERVE</p></div><div style="height:3px;background:linear-gradient(90deg,#E8DFC4 0%,#E8B4B8 50%,#722F37 100%);"></div><div style="background:white;padding:30px;font-family:'Plus Jakarta Sans',sans-serif;color:#161412;line-height:1.6;font-size:15px;">`;
}
function brandFooter() {
  return `</div><div style="background:#E8DFC4;padding:20px;text-align:center;border-radius:0 0 8px 8px;"><p style="margin:0;color:#722F37;font-size:12px;font-weight:500;">Winefeed – Din B2B-marknadsplats för vin</p></div></div>`;
}

const credBox = `<div style="background:#f8f6f0;border:1px solid #E8DFC4;border-radius:8px;padding:16px 20px;margin:18px 0;font-size:14px;">
  <p style="margin:0 0 8px 0;"><strong>Inloggning</strong></p>
  <p style="margin:0;font-family:'SF Mono',Menlo,monospace;font-size:13px;">E-post: ${MARIO_EMAIL}<br>Lösenord: <strong>${TEMP_PASSWORD}</strong></p>
  <p style="margin:8px 0 0 0;font-size:12px;color:#828181;">Byt gärna lösenord direkt efter första inloggning. Logga in: <a href="${LOGIN_URL}" style="color:#722F37;">${LOGIN_URL}</a></p>
</div>`;

const SUBJECT = 'Äldre Bordeaux från Brasri — din lista på Winefeed';

const html = `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><title>${SUBJECT}</title></head><body style="margin:0;padding:0;background:#f9fafb;">
${brandHeader()}
<p style="margin:0 0 18px 0;">Hej Mario!</p>
<p style="margin:0 0 18px 0;">Corentin på Brasri kopplade ihop oss eftersom du var intresserad av äldre fransk Bordeaux. Jag har förberett en Winefeed-vy med precis det du frågade efter: <strong>26 producenter och 91 årgångar från 1958 till 2005</strong> — från affordable Tour-Calon (149 kr ex moms) hela vägen upp till Petrus, Lafite Imperial, Le Pin och Mouton-Rothschild.</p>
${credBox}
<p style="margin:0 0 12px 0;"><strong>Så här ser du listan:</strong></p>
<ol style="margin:0 0 18px 0;padding-left:22px;">
  <li style="margin-bottom:6px;">Logga in på <a href="${LOGIN_URL}" style="color:#722F37;">winefeed.se/login</a> med uppgifterna ovan</li>
  <li style="margin-bottom:6px;">Gå till <a href="${NEW_REQUEST_URL}" style="color:#722F37;">Sök vin</a> och klistra in: <em>äldre fransk Bordeaux från 1958 till 2005, alla prisnivåer</em></li>
  <li style="margin-bottom:6px;">Du ser hela listan med priser, lager och MOQ direkt</li>
</ol>
<p style="margin:0 0 18px 0;"><strong>Frågor om vinerna?</strong> Corentin på Brasri har riktigt bra koll på provenance och cellar conditions för de äldre årgångarna. Reachable direkt på <strong>+46 738 240 272</strong> eller <a href="mailto:corentin@brasri.com" style="color:#722F37;">corentin@brasri.com</a>. Plattformsfrågor tar du med mig.</p>
<p style="margin:0 0 18px 0;">Plattformen är gratis för restauranger. Vid direktimport sköter vi all pappersexercis åt er — tull, alkoholskatt, 5369, transportkoordinering. Ni bestämmer vinet, vi tar resten.</p>
<p style="margin:0 0 18px 0;">När du har kikat: säg till om du vill att vi tar 15 min på telefon och går igenom flödet, eller om du vill att jag ringer upp Corentin för en specifik fråga om något vin.</p>
<p style="margin:24px 0 4px 0;">Mvh</p>
<p style="margin:0;"><strong>Markus</strong></p>
<p style="margin:4px 0 0 0;"><a href="https://winefeed.se" style="color:#722F37;text-decoration:underline;">winefeed.se</a></p>
${brandFooter()}
</body></html>`;

const text = `Hej Mario!

Corentin på Brasri kopplade ihop oss eftersom du var intresserad av äldre fransk Bordeaux. Jag har förberett en Winefeed-vy med precis det du frågade efter: 26 producenter och 91 årgångar från 1958 till 2005 — från affordable Tour-Calon (149 kr ex moms) hela vägen upp till Petrus, Lafite Imperial, Le Pin och Mouton-Rothschild.

INLOGGNING
E-post: ${MARIO_EMAIL}
Lösenord: ${TEMP_PASSWORD}
Byt gärna lösenord efter första inloggning. Logga in: ${LOGIN_URL}

Så här ser du listan:
1. Logga in på ${LOGIN_URL} med uppgifterna ovan
2. Gå till ${NEW_REQUEST_URL} och klistra in: "äldre fransk Bordeaux från 1958 till 2005, alla prisnivåer"
3. Du ser hela listan med priser, lager och MOQ direkt

Frågor om vinerna? Corentin på Brasri har riktigt bra koll på provenance och cellar conditions för de äldre årgångarna. Reachable direkt på +46 738 240 272 eller corentin@brasri.com. Plattformsfrågor tar du med mig.

Plattformen är gratis för restauranger. Vid direktimport sköter vi all pappersexercis åt er — tull, alkoholskatt, 5369, transportkoordinering. Ni bestämmer vinet, vi tar resten.

När du har kikat: säg till om du vill att vi tar 15 min på telefon och går igenom flödet, eller om du vill att jag ringer upp Corentin för en specifik fråga om något vin.

Mvh
Markus
winefeed.se`;

console.log('\n📧 Skickar intro-mejl till', MARIO_EMAIL);

const { data: emailResult, error: emailErr } = await resend.emails.send({
  from: 'Markus på Winefeed <markus@winefeed.se>',
  to: MARIO_EMAIL,
  bcc: 'markus@winefeed.se',
  reply_to: 'markus@winefeed.se',
  subject: SUBJECT,
  html,
  text,
});

if (emailErr) {
  console.error('❌ Email-fel:', emailErr);
  console.error('Konto skapat men mejl ej skickat. Du kan skicka manuellt med credentials:');
  console.error(`   E-post: ${MARIO_EMAIL}`);
  console.error(`   Lösenord: ${TEMP_PASSWORD}`);
  process.exit(1);
}

console.log(`   ✅ Resend ID: ${emailResult.id}`);

// === Steg 4: Uppdatera restaurant_leads ===
const { data: lead } = await supabase
  .from('restaurant_leads')
  .select('id, notes')
  .ilike('name', RESTAURANT_NAME)
  .limit(1);

if (lead?.[0]) {
  const today = new Date().toISOString().slice(0, 10);
  const newNote = `[${today}] Mario-konto skapat (${MARIO_EMAIL}, user-id ${userId}). Intro-mejl skickat med temp-lösenord + förifyllt sökord. Resend-ID: ${emailResult.id}`;
  const merged = lead[0].notes ? `${lead[0].notes}\n\n${newNote}` : newNote;
  const followUp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await supabase
    .from('restaurant_leads')
    .update({
      contact_email: MARIO_EMAIL,
      status: 'contacted',
      last_contact_at: new Date().toISOString(),
      next_action_date: followUp,
      next_action: 'Följ upp om inget svar / inloggning',
      notes: merged,
    })
    .eq('id', lead[0].id);

  console.log('   📋 restaurant_leads uppdaterad');
}

console.log('\n✅ Klart. Pontus + Mario fully onboarded. Pipeline visar status: contacted.');
console.log(`\nLogin-credentials att dela vid behov:`);
console.log(`   E-post: ${MARIO_EMAIL}`);
console.log(`   Lösenord: ${TEMP_PASSWORD}`);
