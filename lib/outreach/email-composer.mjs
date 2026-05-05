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
    `<p style="margin:0 0 18px 0;">Vi startar upp Winefeed, en B2B-plattform där restauranger lägger en förfrågan ("italienskt rödvin under 90 kr, 24 flaskor") och får offert tillbaka från svenska importörer som har matchande viner. Tanken: ni slipper ringa runt eller jaga prislistor när vinlistan byggs upp.</p>`,
    `<p style="margin:0 0 18px 0;">Vi har redan ett antal importörer ombord, och <strong>fler och fler ansluter sina vinkataloger kommande veckorna</strong>, så urvalet växer snabbt. Förutom det vanliga svenska sortimentet finns även en del europeiska producenter som ni inte enkelt hittar hos vanliga distributörer, ofta med riktigt konkurrenskraftiga priser.</p>`,
  ];

  if (profileFitNote) {
    htmlParts.push(`<p style="margin:0 0 18px 0;">${profileFitNote}</p>`);
  }

  if (examplesHeading && wineBulletsHtml) {
    htmlParts.push(`<p style="margin:0 0 12px 0;">${examplesHeading}</p>`);
    htmlParts.push(wineBulletsHtml);
  }

  htmlParts.push(`<p style="margin:0 0 18px 0;"><strong>Vad det kostar er:</strong> ingenting. Plattformen är gratis att använda för restauranger, både att lista förfrågningar och att acceptera offerter. Inga månadsavgifter, inga prenumerationer.</p>`);
  htmlParts.push(`<p style="margin:0 0 18px 0;"><strong>Vid direktimport från europeiska producenter</strong> sköter vi all nödvändig pappersexercis åt er: tulldokument, alkoholskatte-anmälan, 5369, transportkoordinering. Ni bestämmer vinet, vi tar hand om logistik och dokumentation hela vägen till källaren. Det är en av sakerna vi byggt plattformen kring.</p>`);
  htmlParts.push(`<p style="margin:0 0 18px 0;">Vill ni testa? Vi kan skicka en länk så är ni igång på 10 minuter, eller boka in en kort demo på telefon om det känns bättre.</p>`);
  htmlParts.push(`<p style="margin:24px 0 4px 0;">Mvh</p><p style="margin:0;"><strong>Markus</strong></p><p style="margin:4px 0 0 0;"><a href="https://winefeed.se" style="color:#722F37;text-decoration:underline;">winefeed.se</a></p>`);
  htmlParts.push(brandFooter());

  const html = `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><title>${subject}</title></head><body style="margin:0;padding:0;background:#f9fafb;">${htmlParts.join('')}</body></html>`;

  // ---- Text ----
  const textParts = [
    greeting,
    '',
    openingHook,
    '',
    'Vi startar upp Winefeed, en B2B-plattform där restauranger lägger en förfrågan ("italienskt rödvin under 90 kr, 24 flaskor") och får offert tillbaka från svenska importörer som har matchande viner. Tanken: ni slipper ringa runt eller jaga prislistor när vinlistan byggs upp.',
    '',
    'Vi har redan ett antal importörer ombord, och fler och fler ansluter sina vinkataloger kommande veckorna, så urvalet växer snabbt. Förutom det vanliga svenska sortimentet finns även en del europeiska producenter som ni inte enkelt hittar hos vanliga distributörer, ofta med riktigt konkurrenskraftiga priser.',
  ];
  if (profileFitNote) {
    textParts.push('', profileFitNote);
  }
  if (examplesHeading && wineBullets) {
    textParts.push('', examplesHeading, '', wineBullets);
  }
  textParts.push('',
    'Vad det kostar er: ingenting. Plattformen är gratis att använda för restauranger, både att lista förfrågningar och att acceptera offerter. Inga månadsavgifter, inga prenumerationer.',
    '',
    'Vid direktimport från europeiska producenter sköter vi all nödvändig pappersexercis åt er: tulldokument, alkoholskatte-anmälan, 5369, transportkoordinering. Ni bestämmer vinet, vi tar hand om logistik och dokumentation hela vägen till källaren. Det är en av sakerna vi byggt plattformen kring.',
    '',
    'Vill ni testa? Vi kan skicka en länk så är ni igång på 10 minuter, eller boka in en kort demo på telefon om det känns bättre.',
    '',
    'Mvh',
    'Markus',
    'winefeed.se');

  const text = textParts.join('\n');

  return { subject, html, text };
}
