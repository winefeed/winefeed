/**
 * Skickar outreach-mejl till Bryggargatan (Skellefteå).
 * Mall: docs/OUTREACH_TEMPLATE_RESTAURANG.md (v1.1)
 *
 * Avsiktlig produktions-outreach godkänd av Markus 2026-05-05.
 *
 * To: info@bryggargatan.se
 * BCC: markus@winefeed.se
 * From: Markus på Winefeed <markus@winefeed.se>
 *
 * Anpassningar: tre konkreta producent-exempel som direkt mappar mot
 * tre av deras 17 fredag-tema-provningar 2026 (Pinot Noir, Sydafrika,
 * Riesling).
 */
import { config } from 'dotenv';
import { Resend } from 'resend';

config({ path: '.env.local' });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY saknas i .env.local');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

const TO = 'info@bryggargatan.se';
const BCC = 'markus@winefeed.se';
const FROM = 'Markus på Winefeed <markus@winefeed.se>';
const REPLY_TO = 'markus@winefeed.se';
const SUBJECT = 'En sourcing-idé inför era 17 tema-fredagar?';

function brandHeader() {
  return `
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A42 100%); padding: 28px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <div style="display: inline-block;">
        <span style="display: inline-block; width: 10px; height: 10px; background: #E8DFC4; transform: rotate(45deg); margin-right: -3px; opacity: 0.85;"></span>
        <span style="display: inline-block; width: 12px; height: 12px; background: #E8B4B8; transform: rotate(45deg); margin-right: -3px; opacity: 0.8;"></span>
        <span style="display: inline-block; width: 10px; height: 10px; background: rgba(255,255,255,0.9); transform: rotate(45deg); margin-right: 10px;"></span>
        <span style="font-size: 26px; color: #ffffff; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; vertical-align: middle;">
          <span style="font-weight: 700;">wine</span><span style="font-weight: 300;">feed</span>
        </span>
      </div>
      <p style="color: rgba(255,255,255,0.5); margin: 5px 0 0 0; font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;">SOURCE &amp; SERVE</p>
    </div>
    <div style="height: 3px; background: linear-gradient(90deg, #E8DFC4 0%, #E8B4B8 50%, #722F37 100%);"></div>
    <div style="background: white; padding: 30px; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #161412; line-height: 1.6; font-size: 15px;">`;
}
function brandFooter() {
  return `
    </div>
    <div style="background: #E8DFC4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; color: #722F37; font-size: 12px; font-weight: 500;">Winefeed – Din B2B-marknadsplats för vin</p>
    </div>
  </div>`;
}

const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SUBJECT}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb;">
  ${brandHeader()}

  <p style="margin: 0 0 18px 0;">Hej!</p>

  <p style="margin: 0 0 18px 0;">Vi har följt Bryggargatan en tid. Time Magazine "50 mest intressanta platser" och en kalender med 17 tema-fredagar 2026 (Nebbiolo, Jura, Sydafrika, Pinot Noir, Priorat, Alvarinho m.fl.) är ovanligt brett för en restaurang i Norrland. Det krävs en sommelier som hittar nya viner till varje fredag.</p>

  <p style="margin: 0 0 18px 0;">Vi startar upp Winefeed, en B2B-plattform där restauranger lägger en förfrågan ("Sydafrika under 90 kr, 18 flaskor") och får offert tillbaka från svenska importörer som har matchande viner. Tanken passar exakt en kalender som er: <strong>lägg en förfrågan per tema, jämför offerter sida vid sida, beställ den som passar bäst</strong>.</p>

  <p style="margin: 0 0 18px 0;">Vi har redan ett antal importörer ombord, och <strong>fler och fler ansluter sina vinkataloger kommande veckorna</strong>, så urvalet växer snabbt. Förutom det vanliga svenska sortimentet finns även en del europeiska producenter som ni inte enkelt hittar hos vanliga distributörer, ofta med riktigt konkurrenskraftiga priser.</p>

  <p style="margin: 0 0 12px 0;">Tre konkreta exempel som direkt matchar tre av era kommande teman:</p>
  <ul style="margin: 0 0 18px 0; padding-left: 20px;">
    <li style="margin-bottom: 8px;"><strong>Misha's Pinot Noir</strong> (Central Otago, Nya Zeeland). Passar Pinot Noir-fredagen</li>
    <li style="margin-bottom: 8px;"><strong>Småskaliga Pinot Noir från Hemel-en-Aarde</strong>, Sydafrika. Passar både Pinot Noir-fredagen och Sydafrika-fredagen</li>
    <li style="margin-bottom: 8px;"><strong>Frey Riesling</strong>. Passar Riesling-fredagen</li>
  </ul>

  <p style="margin: 0 0 18px 0;"><strong>Vad det kostar er:</strong> ingenting. Plattformen är gratis att använda för restauranger, både att lista förfrågningar och att acceptera offerter. Inga månadsavgifter, inga prenumerationer.</p>

  <p style="margin: 0 0 18px 0;"><strong>Vid direktimport från europeiska producenter</strong> sköter vi all nödvändig pappersexercis åt er: tulldokument, alkoholskatte-anmälan, 5369, transportkoordinering. Ni bestämmer vinet, vi tar hand om logistik och dokumentation hela vägen till källaren. Det är en av sakerna vi byggt plattformen kring.</p>

  <p style="margin: 0 0 18px 0;">Vill ni testa? Vi kan skicka en länk så är ni igång på 10 minuter, eller boka in en kort demo på telefon om det känns bättre.</p>

  <p style="margin: 24px 0 4px 0;">Med vänlig hälsning,</p>
  <p style="margin: 0;"><strong>Markus</strong></p>
  <p style="margin: 4px 0 0 0;"><a href="https://winefeed.se" style="color: #722F37; text-decoration: underline;">winefeed.se</a></p>

  ${brandFooter()}
</body>
</html>
`;

const text = `Hej!

Vi har följt Bryggargatan en tid. Time Magazine "50 mest intressanta platser" och en kalender med 17 tema-fredagar 2026 (Nebbiolo, Jura, Sydafrika, Pinot Noir, Priorat, Alvarinho m.fl.) är ovanligt brett för en restaurang i Norrland. Det krävs en sommelier som hittar nya viner till varje fredag.

Vi startar upp Winefeed, en B2B-plattform där restauranger lägger en förfrågan ("Sydafrika under 90 kr, 18 flaskor") och får offert tillbaka från svenska importörer som har matchande viner. Tanken passar exakt en kalender som er: lägg en förfrågan per tema, jämför offerter sida vid sida, beställ den som passar bäst.

Vi har redan ett antal importörer ombord, och fler och fler ansluter sina vinkataloger kommande veckorna, så urvalet växer snabbt. Förutom det vanliga svenska sortimentet finns även en del europeiska producenter som ni inte enkelt hittar hos vanliga distributörer, ofta med riktigt konkurrenskraftiga priser.

Tre konkreta exempel som direkt matchar tre av era kommande teman:
- Misha's Pinot Noir (Central Otago, Nya Zeeland). Passar Pinot Noir-fredagen
- Småskaliga Pinot Noir från Hemel-en-Aarde, Sydafrika. Passar både Pinot Noir-fredagen och Sydafrika-fredagen
- Frey Riesling. Passar Riesling-fredagen

Vad det kostar er: ingenting. Plattformen är gratis att använda för restauranger, både att lista förfrågningar och att acceptera offerter. Inga månadsavgifter, inga prenumerationer.

Vid direktimport från europeiska producenter sköter vi all nödvändig pappersexercis åt er: tulldokument, alkoholskatte-anmälan, 5369, transportkoordinering. Ni bestämmer vinet, vi tar hand om logistik och dokumentation hela vägen till källaren. Det är en av sakerna vi byggt plattformen kring.

Vill ni testa? Vi kan skicka en länk så är ni igång på 10 minuter, eller boka in en kort demo på telefon om det känns bättre.

Med vänlig hälsning,
Markus
winefeed.se`;

console.log('📧 Skickar outreach-mejl');
console.log(`   To: ${TO}`);
console.log(`   BCC: ${BCC}`);
console.log(`   From: ${FROM}`);
console.log(`   Subject: ${SUBJECT}`);

const { data, error } = await resend.emails.send({
  from: FROM,
  to: TO,
  bcc: BCC,
  reply_to: REPLY_TO,
  subject: SUBJECT,
  html,
  text,
});

if (error) {
  console.error('❌ Resend-fel:', error);
  process.exit(1);
}

console.log(`✅ Skickat. Resend ID: ${data?.id}`);
