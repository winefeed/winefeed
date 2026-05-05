/**
 * Komponerar Winefeed-outreach-mejl. Tar lead + valda viner,
 * returnerar { subject, html, text }.
 *
 * Följer mall v1.1: minimera em-dashar, vi-stil, ej säljig, ärlig
 * pilot-status osv. Se docs/OUTREACH_TEMPLATE_RESTAURANG.md.
 */
import { formatWineBullets, formatWineBulletsHtml } from './wine-picker.mjs';

function brandHeader() {
  return `<div style="max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#722F37 0%,#8B3A42 100%);padding:28px 20px;text-align:center;border-radius:8px 8px 0 0;"><div style="display:inline-block;"><span style="display:inline-block;width:10px;height:10px;background:#E8DFC4;transform:rotate(45deg);margin-right:-3px;opacity:0.85;"></span><span style="display:inline-block;width:12px;height:12px;background:#E8B4B8;transform:rotate(45deg);margin-right:-3px;opacity:0.8;"></span><span style="display:inline-block;width:10px;height:10px;background:rgba(255,255,255,0.9);transform:rotate(45deg);margin-right:10px;"></span><span style="font-size:26px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;vertical-align:middle;"><span style="font-weight:700;">wine</span><span style="font-weight:300;">feed</span></span></div><p style="color:rgba(255,255,255,0.5);margin:5px 0 0 0;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;">SOURCE &amp; SERVE</p></div><div style="height:3px;background:linear-gradient(90deg,#E8DFC4 0%,#E8B4B8 50%,#722F37 100%);"></div><div style="background:white;padding:30px;font-family:'Plus Jakarta Sans',sans-serif;color:#161412;line-height:1.6;font-size:15px;">`;
}

function brandFooter() {
  return `</div><div style="background:#E8DFC4;padding:20px;text-align:center;border-radius:0 0 8px 8px;"><p style="margin:0;color:#722F37;font-size:12px;font-weight:500;">Winefeed – Din B2B-marknadsplats för vin</p></div></div>`;
}

/**
 * Bygger en greeting från lead.contact_name.
 * "Hej Cecilia och Pär!" / "Hej Mario!" / "Hej!" om inget namn.
 */
function buildGreeting(contactName) {
  if (!contactName) return 'Hej!';
  // Strippa parenteser-info ("(sommelier)" etc.) och splitta på "&" eller "och"
  const clean = contactName.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const parts = clean.split(/\s*(?:&|och|\+)\s*/i).map(p => {
    // Ta bara förnamn
    return p.split(/\s+/)[0];
  }).filter(Boolean);
  if (parts.length === 0) return 'Hej!';
  if (parts.length === 1) return `Hej ${parts[0]}!`;
  if (parts.length === 2) return `Hej ${parts[0]} och ${parts[1]}!`;
  return `Hej ${parts.slice(0, -1).join(', ')} och ${parts[parts.length - 1]}!`;
}

/**
 * Komponerar mejlet. Personliga delar (öppningshook, ev. profil-fit-kommentar)
 * förväntas vara fri-text-input — denna funktion fyller resten.
 */
export function composeOutreach({ lead, wines, openingHook, subject, profileFitNote = null }) {
  const greeting = buildGreeting(lead.contact_name);
  const wineBullets = wines.length > 0 ? formatWineBullets(wines) : '';
  const wineBulletsHtml = wines.length > 0 ? formatWineBulletsHtml(wines) : '';
  const examplesHeading = wines.length > 0 ? 'Ett par exempel ur katalogen som kan passa er profil:' : null;

  // ---- HTML ----
  const htmlParts = [
    brandHeader(),
    `<p style="margin:0 0 18px 0;">${greeting}</p>`,
    `<p style="margin:0 0 18px 0;">${openingHook}</p>`,
    `<p style="margin:0 0 18px 0;"><strong>Så funkar Winefeed:</strong> lägg en förfrågan, få offert tillbaka från flera källor i samma vy. Både <strong>svenska importörer</strong> som redan har vinet på lager och <strong>europeiska producenter</strong> där vi tar in det direkt åt er. För direktimport-spåret sköter vi all pappersexercis: tulldokument, alkoholskatt, 5369, transportkoordinering. Ni bestämmer vinet, vi sköter resten.</p>`,
    `<p style="margin:0 0 18px 0;">Vi har redan ett antal importörer ombord, och <strong>fler ansluter sina vinkataloger kommande veckorna</strong>, så urvalet växer snabbt.</p>`,
  ];

  if (profileFitNote) {
    htmlParts.push(`<p style="margin:0 0 18px 0;">${profileFitNote}</p>`);
  }

  if (examplesHeading && wineBulletsHtml) {
    htmlParts.push(`<p style="margin:0 0 12px 0;">${examplesHeading}</p>`);
    htmlParts.push(wineBulletsHtml);
  }

  htmlParts.push(`<p style="margin:0 0 18px 0;"><strong>Vad det kostar er:</strong> ingenting. Plattformen är gratis för restauranger, både att lista förfrågningar och att acceptera offerter. Inga månadsavgifter, inga prenumerationer.</p>`);
  htmlParts.push(`<p style="margin:0 0 12px 0;"><strong>Vill ni testa? Tre vägar:</strong></p>`);
  htmlParts.push(`<ol style="margin:0 0 18px 0;padding-left:22px;"><li style="margin-bottom:6px;">Registrera direkt på <a href="https://www.winefeed.se/signup" style="color:#722F37;">winefeed.se/signup</a> (tar 5 minuter, ni är igång samma kväll)</li><li style="margin-bottom:6px;">Svara på det här mejlet med orgnr + kontaktperson, så skapar vi inloggningen åt er och skickar tillbaka</li><li style="margin-bottom:6px;">15 min på telefon om ni vill se plattformen live först</li></ol>`);
  htmlParts.push(`<p style="margin:24px 0 4px 0;">Mvh</p><p style="margin:0;"><strong>Markus</strong></p><p style="margin:4px 0 0 0;"><a href="https://winefeed.se" style="color:#722F37;text-decoration:underline;">winefeed.se</a></p>`);
  htmlParts.push(brandFooter());

  const html = `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><title>${subject}</title></head><body style="margin:0;padding:0;background:#f9fafb;">${htmlParts.join('')}</body></html>`;

  // ---- Text ----
  const textParts = [
    greeting,
    '',
    openingHook,
    '',
    'Så funkar Winefeed: lägg en förfrågan, få offert tillbaka från flera källor i samma vy. Både svenska importörer som redan har vinet på lager och europeiska producenter där vi tar in det direkt åt er. För direktimport-spåret sköter vi all pappersexercis: tulldokument, alkoholskatt, 5369, transportkoordinering. Ni bestämmer vinet, vi sköter resten.',
    '',
    'Vi har redan ett antal importörer ombord, och fler ansluter sina vinkataloger kommande veckorna, så urvalet växer snabbt.',
  ];
  if (profileFitNote) {
    textParts.push('', profileFitNote);
  }
  if (examplesHeading && wineBullets) {
    textParts.push('', examplesHeading, '', wineBullets);
  }
  textParts.push('',
    'Vad det kostar er: ingenting. Plattformen är gratis för restauranger, både att lista förfrågningar och att acceptera offerter. Inga månadsavgifter, inga prenumerationer.',
    '',
    'Vill ni testa? Tre vägar:',
    '1. Registrera direkt på winefeed.se/signup (tar 5 minuter, ni är igång samma kväll)',
    '2. Svara på det här mejlet med orgnr + kontaktperson, så skapar vi inloggningen åt er och skickar tillbaka',
    '3. 15 min på telefon om ni vill se plattformen live först',
    '',
    'Mvh',
    'Markus',
    'winefeed.se');

  const text = textParts.join('\n');

  return { subject, html, text };
}
