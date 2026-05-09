import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const resend = new Resend(env.RESEND_API_KEY);
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });

const INVITE_URL = 'https://winefeed.se/invite?token=7b92c11ebd69a5deeb09f3b4d1335e474fdc0d7ce7b31d02c4d5be272f76c3f2';

const html = `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A42 100%); padding: 28px 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <div style="display: inline-block;">
      <span style="display: inline-block; width: 10px; height: 10px; background: #E8DFC4; transform: rotate(45deg); margin-right: -3px; opacity: 0.85;"></span>
      <span style="display: inline-block; width: 12px; height: 12px; background: #E8B4B8; transform: rotate(45deg); margin-right: -3px; opacity: 0.8;"></span>
      <span style="display: inline-block; width: 10px; height: 10px; background: rgba(255,255,255,0.9); transform: rotate(45deg); margin-right: 10px;"></span>
      <span style="font-size: 26px; color: #ffffff; vertical-align: middle;"><span style="font-weight: 700;">wine</span><span style="font-weight: 300;">feed</span></span>
    </div>
    <p style="color: rgba(255,255,255,0.5); margin: 5px 0 0 0; font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;">SOURCE &amp; SERVE</p>
  </div>
  <div style="height: 3px; background: linear-gradient(90deg, #E8DFC4 0%, #E8B4B8 50%, #722F37 100%);"></div>
  <div style="background: white; padding: 36px 32px; line-height: 1.55; color: #161412;">
    <p style="margin: 0 0 18px 0;">Hej Marcus,</p>
    <p style="margin: 0 0 18px 0;">Corentin på Brasri bad mig skicka över listan på äldre Bordeaux som finns att importera direkt via dem. Jag har lagt upp hela katalogen på Winefeed så du kan söka, filtrera och skicka offertförfrågan därifrån — vi är även här som stöd om något krånglar.</p>
    <p style="margin: 0 0 22px 0; font-style: italic; color: #4A1A1F; border-left: 3px solid #E8B4B8; padding-left: 14px;">331 viner, årgångar från 1955 till 2023. Tunga producenter genom hela katalogen.</p>

    <h3 style="font-family: 'Playfair Display', Georgia, serif; color: #722F37; margin: 28px 0 14px 0; font-size: 20px; font-weight: 400;">Höjdpunkter</h3>
    <ul style="margin: 0 0 22px 0; padding-left: 20px; line-height: 1.8;">
      <li><strong>Alla fem Premiers Crus Classés</strong> — Lafite (1982–2020), Margaux, Mouton, Haut-Brion, Latour</li>
      <li><strong>Petrus</strong> 1988–2008 och <strong>Le Pin</strong> 2005–2018</li>
      <li><strong>d'Yquem</strong> 2006–2023, plus djup Sauternes/Barsac — Coutet, Rieussec, Suduiraut, Climens</li>
      <li><strong>Tour-Calon ex domaine 1955–1979</strong> — regular &amp; magnum, Castillon Côtes de Bordeaux</li>
    </ul>

    <h3 style="font-family: 'Playfair Display', Georgia, serif; color: #722F37; margin: 28px 0 12px 0; font-size: 20px; font-weight: 400;">Spridning per decennium</h3>
    <table style="border-collapse: collapse; width: 100%; margin-bottom: 22px; font-size: 14px;">
      <tr style="vertical-align: top;"><td style="padding: 8px 12px 8px 0; color: #722F37; font-weight: 500; white-space: nowrap;">1950-tal · 5</td><td style="padding: 8px 0; color: #828181;">Tour-Calon ex domaine</td></tr>
      <tr style="vertical-align: top;"><td style="padding: 8px 12px 8px 0; color: #722F37; font-weight: 500; white-space: nowrap;">1960-tal · 10</td><td style="padding: 8px 0; color: #828181;">Tour-Calon — inkl. <strong style="color: #4A1A1F;">1961</strong></td></tr>
      <tr style="vertical-align: top;"><td style="padding: 8px 12px 8px 0; color: #722F37; font-weight: 500; white-space: nowrap;">1970-tal · 16</td><td style="padding: 8px 0; color: #828181;">Tour-Calon, regular &amp; magnum</td></tr>
      <tr style="vertical-align: top;"><td style="padding: 8px 12px 8px 0; color: #722F37; font-weight: 500; white-space: nowrap;">1980-tal · 21</td><td style="padding: 8px 0; color: #828181;">Lafite Rothschild 1982, Petrus 1988, Bonalgue Bel-Air, Tour-Calon</td></tr>
      <tr style="vertical-align: top;"><td style="padding: 8px 12px 8px 0; color: #722F37; font-weight: 500; white-space: nowrap;">1990-tal · 10</td><td style="padding: 8px 0; color: #828181;">Lafite Rothschild 1999, Guiraud, Clos Haut Peyraguey</td></tr>
      <tr style="vertical-align: top;"><td style="padding: 8px 12px 8px 0; color: #722F37; font-weight: 500; white-space: nowrap;">2000-tal · 50</td><td style="padding: 8px 0; color: #828181;">Latour, Lafite, Margaux, Haut-Brion, Le Pin, Petrus 2008</td></tr>
      <tr style="vertical-align: top;"><td style="padding: 8px 12px 8px 0; color: #722F37; font-weight: 500; white-space: nowrap;">2010-tal · 124</td><td style="padding: 8px 0; color: #828181;">Margaux, Mouton, Haut-Brion, La Mission, Coutet, Rieussec, Climens, d'Yquem</td></tr>
      <tr style="vertical-align: top;"><td style="padding: 8px 12px 8px 0; color: #722F37; font-weight: 500; white-space: nowrap;">2020-tal · 93</td><td style="padding: 8px 0; color: #828181;">Lafite, Mouton, Margaux, Cos d'Estournel, Lynch Bages, Pichon Comtesse, Vieux Château Certan</td></tr>
    </table>

    <p style="margin: 0 0 8px 0; font-size: 14px; color: #828181;">Mest representerade appellationer:</p>
    <p style="margin: 0 0 22px 0;">Sauternes, Castillon Côtes de Bordeaux, Pessac-Léognan, Pauillac, Pomerol, Margaux, Barsac.</p>

    <h3 style="font-family: 'Playfair Display', Georgia, serif; color: #722F37; margin: 28px 0 12px 0; font-size: 20px; font-weight: 400;">Sök själv på Winefeed</h3>
    <p style="margin: 0 0 16px 0;">Jag har skapat ett konto åt dig — logga in nedan, sätt ett eget lösenord och börja söka i hela listan. Filtrera på årgång, appellation, château eller pris. När något fångar intresset skickar du en offertförfrågan med ett klick — den går rakt till Corentin med pris, leveransvillkor och tillgänglighet på de äldre årgångarna.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${INVITE_URL}" style="display: inline-block; background: #722F37; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 500; font-size: 15px;">Logga in på Winefeed</a>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #828181;">Länken är giltig i 14 dagar och kräver ingen registrering — du sätter bara ett lösenord du själv väljer.</p>
    </div>

    <p style="margin: 22px 0 0 0;">Hör av dig om du vill ha en demo på telefon eller om du behöver något specifikt utdraget ur listan. Corentin är CC och svarar direkt på allt som rör vinerna.</p>
    <p style="margin: 22px 0 0 0;">Varmt välkommen,<br>Markus</p>
    <p style="margin: 30px 0 0 0; font-size: 13px; color: #828181; border-top: 1px solid #d8d4d3; padding-top: 18px;">Markus Nilsson<br>Winefeed — B2B-marknadsplats för vin<br>markus@winefeed.se · winefeed.se</p>
  </div>
  <div style="background: #E8DFC4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
    <p style="margin: 0; color: #722F37; font-size: 12px; font-weight: 500;">Winefeed – Din B2B-marknadsplats för vin</p>
  </div>
</div>`;

const text = `Hej Marcus,

Corentin på Brasri bad mig skicka över listan på äldre Bordeaux som finns att importera direkt via dem. Jag har lagt upp hela katalogen på Winefeed så du kan söka, filtrera och skicka offertförfrågan därifrån — vi är även här som stöd om något krånglar.

331 viner, årgångar från 1955 till 2023. Tunga producenter genom hela katalogen.

HÖJDPUNKTER
- Alla fem Premiers Crus Classés — Lafite (1982–2020), Margaux, Mouton, Haut-Brion, Latour
- Petrus 1988–2008 och Le Pin 2005–2018
- d'Yquem 2006–2023, plus djup Sauternes/Barsac — Coutet, Rieussec, Suduiraut, Climens
- Tour-Calon ex domaine 1955–1979 — regular & magnum, Castillon Côtes de Bordeaux

SPRIDNING PER DECENNIUM
1950-tal · 5    Tour-Calon ex domaine
1960-tal · 10   Tour-Calon — inkl. 1961
1970-tal · 16   Tour-Calon, regular & magnum
1980-tal · 21   Lafite Rothschild 1982, Petrus 1988, Bonalgue Bel-Air, Tour-Calon
1990-tal · 10   Lafite Rothschild 1999, Guiraud, Clos Haut Peyraguey
2000-tal · 50   Latour, Lafite, Margaux, Haut-Brion, Le Pin, Petrus 2008
2010-tal · 124  Margaux, Mouton, Haut-Brion, La Mission, Coutet, Rieussec, Climens, d'Yquem
2020-tal · 93   Lafite, Mouton, Margaux, Cos d'Estournel, Lynch Bages, Pichon Comtesse, Vieux Château Certan

Mest representerade appellationer: Sauternes, Castillon Côtes de Bordeaux, Pessac-Léognan, Pauillac, Pomerol, Margaux, Barsac.

SÖK SJÄLV PÅ WINEFEED
Jag har skapat ett konto åt dig — logga in nedan, sätt ett eget lösenord och börja söka i hela listan.

${INVITE_URL}

(Länken är giltig i 14 dagar och kräver ingen registrering.)

Hör av dig om du vill ha en demo på telefon eller om du behöver något specifikt utdraget ur listan. Corentin är CC och svarar direkt på allt som rör vinerna.

Varmt välkommen,
Markus

—
Markus Nilsson
Winefeed — B2B-marknadsplats för vin
markus@winefeed.se · winefeed.se`;

const { data, error } = await resend.emails.send({
  from: 'Markus på Winefeed <markus@winefeed.se>',
  to: ['marcus.henningsson@etthem.se'],
  cc: ['corentin@brasri.com'],
  replyTo: 'markus@winefeed.se',
  subject: 'Bordeaux från 50-talet och uppåt — och en inloggning till Winefeed',
  html, text,
});
if (error) { console.error('SEND ERR:', error); process.exit(1); }
console.log('✅ Sent. Resend message id:', data.id);

// Update pipeline: add Ett Hem as restaurant lead with status=contacted
const { data: existing } = await s.from('restaurant_leads').select('id, status').ilike('name', '%ett hem%').maybeSingle();
if (existing) {
  const { error: ue } = await s.from('restaurant_leads').update({
    status: 'contacted',
    contact_name: 'Marcus Henningsson',
    contact_role: 'Sommelier',
    contact_email: 'marcus.henningsson@etthem.se',
    last_contact_at: new Date().toISOString(),
    next_action: 'Vänta på inlogg + första offertförfrågan',
    notes: 'Onboarded 2026-05-07 via Corentin/Brasri intro. Bordeaux IOR-katalog skickad. Restaurang skapad i system.',
    restaurant_id: '2e7c76a8-bb87-41b9-a852-5f19658079a9',
    updated_at: new Date().toISOString(),
  }).eq('id', existing.id);
  if (ue) console.error('lead update err:', ue);
  else console.log('✅ Pipeline lead updated:', existing.id);
} else {
  const { data: newLead, error: ie } = await s.from('restaurant_leads').insert({
    name: 'Ett Hem',
    city: 'Stockholm',
    restaurant_type: 'Hotell/restaurang',
    contact_name: 'Marcus Henningsson',
    contact_role: 'Sommelier',
    contact_email: 'marcus.henningsson@etthem.se',
    wine_focus_score: 9,
    pilot_fit_score: 9,
    status: 'contacted',
    source: 'referral',
    last_contact_at: new Date().toISOString(),
    next_action: 'Vänta på inlogg + första offertförfrågan',
    wine_focus_notes: 'Fine-dining hotell på Östermalm. Sommelier Marcus Henningsson.',
    notes: 'Onboarded 2026-05-07 via Corentin/Brasri intro. Bordeaux IOR-katalog skickad. Restaurang skapad i system.',
    lead_type: 'restaurant',
    restaurant_id: '2e7c76a8-bb87-41b9-a852-5f19658079a9',
  }).select('id').single();
  if (ie) console.error('lead insert err:', ie);
  else console.log('✅ Pipeline lead created:', newLead.id);
}
