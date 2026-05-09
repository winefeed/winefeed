// Sends a rotated invite link to Marcus Henningsson at Ett Hem.
// Token is provided via env at runtime — never hardcoded.
// Usage: INVITE_URL='https://winefeed.se/invite?token=...' node scripts/oneshots/send-marcus-rotated.mjs

import { Resend } from 'resend';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);

const INVITE_URL = process.env.INVITE_URL;
if (!INVITE_URL) throw new Error('Set INVITE_URL env var (handle the token out-of-band, never commit).');

const resend = new Resend(env.RESEND_API_KEY);

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
    <p style="margin: 0 0 18px 0;">En kort notis — vi roterade din inloggningslänk till Winefeed som rutinåtgärd. Den länk jag skickade förra veckan fungerar inte längre, här är en fräsch:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${INVITE_URL}" style="display: inline-block; background: #722F37; color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 500; font-size: 15px;">Logga in på Winefeed</a>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #828181;">Giltig i 14 dagar · ingen registrering — du sätter ett eget lösenord vid första klick.</p>
    </div>
    <p style="margin: 22px 0 8px 0;">Vi har en fantastisk Bordeaux-katalog — 331 viner från 1955 till 2023. Några exempel:</p>
    <ul style="margin: 0 0 18px 0; padding-left: 20px; line-height: 1.7;">
      <li><strong>Lafite Rothschild</strong> 1982–2020 · <strong>Petrus</strong> 1988–2008 · <strong>Le Pin</strong> 2005–2018</li>
      <li><strong>d'Yquem</strong> 2006–2023 plus djup Sauternes/Barsac — Coutet, Climens, Suduiraut, Rieussec</li>
      <li><strong>Tour-Calon ex domaine 1955–1979</strong>, regular och magnum, från Castillon</li>
      <li>Pichon Comtesse, Lynch Bages, Cos d'Estournel, Pontet Canet och Vieux Château Certan i 2020–2023</li>
    </ul>
    <p style="margin: 0 0 22px 0;">Filtrera på årgång, château eller appellation, lägg det som intresserar i en offertförfrågan.</p>
    <p style="margin: 22px 0 0 0;">Bästa hälsningar,<br>Markus</p>
    <p style="margin: 30px 0 0 0; font-size: 13px; color: #828181; border-top: 1px solid #d8d4d3; padding-top: 18px;">Markus Nilsson<br>Winefeed — B2B-marknadsplats för vin<br>markus@winefeed.se · winefeed.se</p>
  </div>
  <div style="background: #E8DFC4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
    <p style="margin: 0; color: #722F37; font-size: 12px; font-weight: 500;">Winefeed – Din B2B-marknadsplats för vin</p>
  </div>
</div>`;

const text = `Hej Marcus,

En kort notis — vi roterade din inloggningslänk till Winefeed som rutinåtgärd. Den länk jag skickade förra veckan fungerar inte längre, här är en fräsch:

${INVITE_URL}

(Giltig i 14 dagar · ingen registrering — du sätter ett eget lösenord vid första klick.)

Vi har en fantastisk Bordeaux-katalog — 331 viner från 1955 till 2023. Några exempel:
- Lafite Rothschild 1982-2020 · Petrus 1988-2008 · Le Pin 2005-2018
- d'Yquem 2006-2023 plus djup Sauternes/Barsac — Coutet, Climens, Suduiraut, Rieussec
- Tour-Calon ex domaine 1955-1979, regular och magnum, från Castillon
- Pichon Comtesse, Lynch Bages, Cos d'Estournel, Pontet Canet och Vieux Château Certan i 2020-2023

Filtrera på årgång, château eller appellation, lägg det som intresserar i en offertförfrågan.

Bästa hälsningar,
Markus

—
Markus Nilsson
Winefeed — B2B-marknadsplats för vin
markus@winefeed.se · winefeed.se`;

const { data, error } = await resend.emails.send({
  from: 'Markus på Winefeed <markus@winefeed.se>',
  to: ['marcus.henningsson@etthem.se'],
  cc: ['corentin@brasri.com'],
  bcc: ['markus@winefeed.se', 'markus_nilsson@hotmail.com'],
  replyTo: 'markus@winefeed.se',
  subject: 'Ny inloggningslänk till Winefeed (rutinrotation)',
  html, text,
});

if (error) { console.error('SEND ERR:', error); process.exit(1); }
console.log('Sent. Resend message id:', data.id);
