/**
 * Skickar 5 follow-up-mejl till mars-leads utan svar.
 * Mall-anpassning: kortare än första-mejlet, refererar mars-kontakten,
 * lyfter konkret katalogmatch.
 *
 * Avsiktlig produktions-outreach godkänd av Markus 2026-05-05.
 *
 * Efter varje send: uppdaterar restaurant_leads (last_contact_at, notes
 * appendas så historik bevaras, next_action_date +7 dagar).
 */
import { config } from 'dotenv';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) { console.error('❌ RESEND_API_KEY saknas'); process.exit(1); }

const resend = new Resend(RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BCC = 'markus@winefeed.se';
const FROM = 'Markus på Winefeed <markus@winefeed.se>';
const REPLY_TO = 'markus@winefeed.se';

function brandHeader() {
  return `<div style="max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#722F37 0%,#8B3A42 100%);padding:28px 20px;text-align:center;border-radius:8px 8px 0 0;"><div style="display:inline-block;"><span style="display:inline-block;width:10px;height:10px;background:#E8DFC4;transform:rotate(45deg);margin-right:-3px;opacity:0.85;"></span><span style="display:inline-block;width:12px;height:12px;background:#E8B4B8;transform:rotate(45deg);margin-right:-3px;opacity:0.8;"></span><span style="display:inline-block;width:10px;height:10px;background:rgba(255,255,255,0.9);transform:rotate(45deg);margin-right:10px;"></span><span style="font-size:26px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;vertical-align:middle;"><span style="font-weight:700;">wine</span><span style="font-weight:300;">feed</span></span></div><p style="color:rgba(255,255,255,0.5);margin:5px 0 0 0;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;">SOURCE &amp; SERVE</p></div><div style="height:3px;background:linear-gradient(90deg,#E8DFC4 0%,#E8B4B8 50%,#722F37 100%);"></div><div style="background:white;padding:30px;font-family:'Plus Jakarta Sans',sans-serif;color:#161412;line-height:1.6;font-size:15px;">`;
}
function brandFooter() {
  return `</div><div style="background:#E8DFC4;padding:20px;text-align:center;border-radius:0 0 8px 8px;"><p style="margin:0;color:#722F37;font-size:12px;font-weight:500;">Winefeed – Din B2B-marknadsplats för vin</p></div></div>`;
}

function wrap(bodyHtml, subject) {
  return `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><title>${subject}</title></head><body style="margin:0;padding:0;background:#f9fafb;">${brandHeader()}${bodyHtml}<p style="margin:24px 0 4px 0;">Mvh</p><p style="margin:0;"><strong>Markus</strong></p><p style="margin:4px 0 0 0;"><a href="https://winefeed.se" style="color:#722F37;text-decoration:underline;">winefeed.se</a></p>${brandFooter()}</body></html>`;
}

const emails = [
  {
    leadName: 'Butlers Bistro & Winebar',
    to: 'info@butlersnorrkoping.se',
    subject: 'Bordeaux + Mosel för Coravin-rotationen?',
    bodyHtml: `<p style="margin:0 0 18px 0;">Hej Mikael!</p><p style="margin:0 0 18px 0;">I mars hörde vi av oss om Winefeed (B2B-plattformen som matchar restauranger med svenska importörer). Hörde tyvärr inget tillbaka, så vi följer upp med konkret info som kan vara mer matnyttig.</p><p style="margin:0 0 18px 0;">Vi har just nu <strong>runt 470 Bordeaux-titlar i katalogen</strong> — Saint-Émilion Grand Cru (95), Pomerol (27), Pauillac (44), Saint-Estèphe (36), Pessac-Léognan (51), Margaux (22) m.fl. — plus några tyska Mosel-Riesling. Det borde klä er Coravin-rotation bra.</p><p style="margin:0 0 18px 0;">Plattformen är gratis för restauranger och vi sköter all importpappersexercis åt er (tull, alkoholskatt, 5369). Vill ni prova att lägga in en testförfrågan? Tar 5 minuter och förbinder er till ingenting.</p>`,
    bodyText: `Hej Mikael!\n\nI mars hörde vi av oss om Winefeed (B2B-plattformen som matchar restauranger med svenska importörer). Hörde tyvärr inget tillbaka, så vi följer upp med konkret info som kan vara mer matnyttig.\n\nVi har just nu runt 470 Bordeaux-titlar i katalogen — Saint-Émilion Grand Cru (95), Pomerol (27), Pauillac (44), Saint-Estèphe (36), Pessac-Léognan (51), Margaux (22) m.fl. — plus några tyska Mosel-Riesling. Det borde klä er Coravin-rotation bra.\n\nPlattformen är gratis för restauranger och vi sköter all importpappersexercis åt er (tull, alkoholskatt, 5369). Vill ni prova att lägga in en testförfrågan? Tar 5 minuter och förbinder er till ingenting.\n\nMvh\nMarkus\nwinefeed.se`,
    notesAppend: 'Follow-up #2 skickat 2026-05-05. Vinkel: 470 Bordeaux + Mosel för Coravin-rotation.',
  },
  {
    leadName: 'Klostergatan Vin & Delikatess',
    to: 'info@klostergatan.se',
    subject: 'Bordeaux och Loire till Klostergatans vinlista?',
    bodyHtml: `<p style="margin:0 0 18px 0;">Hej Calle!</p><p style="margin:0 0 18px 0;">I mars hörde vi av oss om Winefeed. Hörde inget tillbaka, så vi följer upp med konkret katalog-info.</p><p style="margin:0 0 18px 0;">Vår styrka just nu är <strong>fransk klassik från Bordeaux</strong> (~470 titlar över Saint-Émilion, Pomerol, Pauillac, Saint-Estèphe, Margaux, Pessac-Léognan), plus mindre men noga utvalda <strong>Loire och Alsace</strong>. Bourgogne har vi begränsat med, där täcker era befintliga importörer förmodligen bättre — men för Bordeaux-djup och Loire-vita kan vi vara intressanta.</p><p style="margin:0 0 18px 0;">Plattformen är gratis för restauranger och vi sköter importpappersexercisen åt er. Lägg en testförfrågan på 5 minuter om ni vill se vad som dyker upp.</p>`,
    bodyText: `Hej Calle!\n\nI mars hörde vi av oss om Winefeed. Hörde inget tillbaka, så vi följer upp med konkret katalog-info.\n\nVår styrka just nu är fransk klassik från Bordeaux (~470 titlar över Saint-Émilion, Pomerol, Pauillac, Saint-Estèphe, Margaux, Pessac-Léognan), plus mindre men noga utvalda Loire och Alsace. Bourgogne har vi begränsat med, där täcker era befintliga importörer förmodligen bättre — men för Bordeaux-djup och Loire-vita kan vi vara intressanta.\n\nPlattformen är gratis för restauranger och vi sköter importpappersexercisen åt er. Lägg en testförfrågan på 5 minuter om ni vill se vad som dyker upp.\n\nMvh\nMarkus\nwinefeed.se`,
    notesAppend: 'Follow-up #2 skickat 2026-05-05. Vinkel: Bordeaux-djup + Loire/Alsace, ärligt om begränsad Bourgogne.',
  },
  {
    leadName: 'Bara Vin & Bistro',
    to: 'info@baravinbistro.se',
    subject: 'Lördagsprovningar med olika teman varje vecka?',
    bodyHtml: `<p style="margin:0 0 18px 0;">Hej Cecilia och Pär!</p><p style="margin:0 0 18px 0;">I mars hörde vi av oss om Winefeed. Hörde inget tillbaka, så vi följer upp.</p><p style="margin:0 0 18px 0;">Era veckovisa lördagsprovningar med olika teman är just den typen av rutin som plattformen är byggd för. <strong>Lägg en förfrågan per tema</strong> ("Pessac-Léognan under 250 kr", "Mosel Kabinett under 180 kr") och få offert tillbaka från flera importörer på ett ställe — istället för att jaga prislistor varje vecka.</p><p style="margin:0 0 18px 0;">Just nu har vi tyngdpunkt i Frankrike (~560 titlar) plus Mosel, Nya Zeeland och Sydafrika. Plattformen är gratis för restauranger, och vi sköter importpappersexercisen åt er när det blir direktimport.</p><p style="margin:0 0 18px 0;">Lägg en testförfrågan på 5 minuter om ni vill se hur det fungerar.</p>`,
    bodyText: `Hej Cecilia och Pär!\n\nI mars hörde vi av oss om Winefeed. Hörde inget tillbaka, så vi följer upp.\n\nEra veckovisa lördagsprovningar med olika teman är just den typen av rutin som plattformen är byggd för. Lägg en förfrågan per tema ("Pessac-Léognan under 250 kr", "Mosel Kabinett under 180 kr") och få offert tillbaka från flera importörer på ett ställe — istället för att jaga prislistor varje vecka.\n\nJust nu har vi tyngdpunkt i Frankrike (~560 titlar) plus Mosel, Nya Zeeland och Sydafrika. Plattformen är gratis för restauranger, och vi sköter importpappersexercisen åt er när det blir direktimport.\n\nLägg en testförfrågan på 5 minuter om ni vill se hur det fungerar.\n\nMvh\nMarkus\nwinefeed.se`,
    notesAppend: 'Follow-up #2 skickat 2026-05-05. Vinkel: lördagsprovningar = broadcast-funktion (1 förfrågan per tema).',
  },
  {
    leadName: 'Enoteket',
    to: 'hej@enoteket.se',
    subject: 'Glasviner utanför Italien för Enomatic-rotationen?',
    bodyHtml: `<p style="margin:0 0 18px 0;">Hej Jerney!</p><p style="margin:0 0 18px 0;">I mars hörde vi av oss om Winefeed. Hörde inget tillbaka, så vi följer upp.</p><p style="margin:0 0 18px 0;">Eftersom ni redan har starkt italienskt djup men öppnar gärna för <strong>glasviner utanför Italien</strong> har vi möjligen något att tillföra: 470+ <strong>fransk Bordeaux</strong> (Saint-Émilion, Pomerol, Pauillac, Margaux), 5 <strong>Mosel-Riesling</strong>, 25 <strong>Nya Zeeland Pinot Noir/Sauvignon Blanc</strong> (Marlborough, Central Otago) och 15 <strong>Sydafrika</strong> (Stellenbosch). Italienskt har vi däremot noll av — där täcker era nuvarande importörer.</p><p style="margin:0 0 18px 0;">Plattformen är gratis för restauranger och vi sköter importpappersexercisen vid direktimport. Testförfrågan tar 5 minuter och förbinder er till ingenting.</p>`,
    bodyText: `Hej Jerney!\n\nI mars hörde vi av oss om Winefeed. Hörde inget tillbaka, så vi följer upp.\n\nEftersom ni redan har starkt italienskt djup men öppnar gärna för glasviner utanför Italien har vi möjligen något att tillföra: 470+ fransk Bordeaux (Saint-Émilion, Pomerol, Pauillac, Margaux), 5 Mosel-Riesling, 25 Nya Zeeland Pinot Noir/Sauvignon Blanc (Marlborough, Central Otago) och 15 Sydafrika (Stellenbosch). Italienskt har vi däremot noll av — där täcker era nuvarande importörer.\n\nPlattformen är gratis för restauranger och vi sköter importpappersexercisen vid direktimport. Testförfrågan tar 5 minuter och förbinder er till ingenting.\n\nMvh\nMarkus\nwinefeed.se`,
    notesAppend: 'Follow-up #2 skickat 2026-05-05. Vinkel: glasviner utanför Italien (Bordeaux/Mosel/NZ/SA), italienskt täcks av befintliga importörer.',
  },
  {
    leadName: 'Sund Nergården',
    to: 'info@sundnergarden.se',
    subject: 'Ekologiska familje-Bordeaux för glaslistan?',
    bodyHtml: `<p style="margin:0 0 18px 0;">Hej Johan och Niklas!</p><p style="margin:0 0 18px 0;">I mars hörde vi av oss om Winefeed (kul att vi möttes på Munskänkarnas Piemonte-mässa innan dess). Hörde inget tillbaka efter det, så vi följer upp.</p><p style="margin:0 0 18px 0;">Eftersom er vinfilosofi är <strong>ekologiska/biodynamiska familjeproducenter</strong> kan det vara värt att veta att vi har ett <strong>fyrtiotal ekologiskt certifierade Bordeaux</strong> i katalogen — alla från små familjedrivna châteaux i Castillon, Pomerol, Saint-Émilion m.fl., direktimport till bra priser. Det kunde rotera in i era 70+ glasviner.</p><p style="margin:0 0 18px 0;">Plattformen är gratis för restauranger, vi sköter importpappersexercisen åt er. Testförfrågan tar 5 minuter.</p>`,
    bodyText: `Hej Johan och Niklas!\n\nI mars hörde vi av oss om Winefeed (kul att vi möttes på Munskänkarnas Piemonte-mässa innan dess). Hörde inget tillbaka efter det, så vi följer upp.\n\nEftersom er vinfilosofi är ekologiska/biodynamiska familjeproducenter kan det vara värt att veta att vi har ett fyrtiotal ekologiskt certifierade Bordeaux i katalogen — alla från små familjedrivna châteaux i Castillon, Pomerol, Saint-Émilion m.fl., direktimport till bra priser. Det kunde rotera in i era 70+ glasviner.\n\nPlattformen är gratis för restauranger, vi sköter importpappersexercisen åt er. Testförfrågan tar 5 minuter.\n\nMvh\nMarkus\nwinefeed.se`,
    notesAppend: 'Follow-up #2 skickat 2026-05-05. Vinkel: 48 ekologiska Bordeaux från familje-châteaux för deras eko/biodynamiska 70+ glaslista.',
  },
];

const today = new Date().toISOString().slice(0, 10);
const followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

for (const e of emails) {
  console.log(`\n📧 ${e.leadName} → ${e.to}`);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: e.to,
    bcc: BCC,
    reply_to: REPLY_TO,
    subject: e.subject,
    html: wrap(e.bodyHtml, e.subject),
    text: e.bodyText,
  });

  if (error) {
    console.error(`   ❌ ${error.message || JSON.stringify(error)}`);
    continue;
  }

  console.log(`   ✅ Resend ID: ${data.id}`);

  // Uppdatera DB: append notes, sätt last_contact_at + next_action_date
  const { data: existing } = await supabase
    .from('restaurant_leads')
    .select('id, notes')
    .ilike('name', e.leadName)
    .limit(1);

  if (existing && existing.length > 0) {
    const oldNotes = existing[0].notes || '';
    const newNoteLine = `[${today}] ${e.notesAppend} Resend-ID: ${data.id}`;
    const mergedNotes = oldNotes ? `${oldNotes}\n\n${newNoteLine}` : newNoteLine;

    const { error: updErr } = await supabase
      .from('restaurant_leads')
      .update({
        last_contact_at: new Date().toISOString(),
        next_action_date: followUpDate,
        next_action: 'Följ upp om inget svar',
        notes: mergedNotes,
      })
      .eq('id', existing[0].id);

    if (updErr) {
      console.error(`   ⚠️  DB-update fel: ${updErr.message}`);
    } else {
      console.log(`   📋 DB uppdaterad (notes appendad, next_action ${followUpDate})`);
    }
  } else {
    console.error(`   ⚠️  Hittade inte ${e.leadName} i DB:n`);
  }

  // Liten paus så vi inte triggar Resend rate-limit
  await new Promise(r => setTimeout(r, 500));
}

console.log('\n📊 Klart.');
