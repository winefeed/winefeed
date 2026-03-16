import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) process.env[match[1]] = match[2];
}

const resend = new Resend(process.env.RESEND_API_KEY);

const WINE = '#722F37';
const ROSE = '#E8B4B8';
const CREME = '#E8DFC4';

function buildHtml(greeting, bodyParagraphs) {
  const bodyHtml = bodyParagraphs.map(p => {
    if (p.startsWith('<')) return p;
    return `<p style="color: #4b5563; line-height: 1.7; margin: 0 0 16px 0; font-size: 15px;">${p}</p>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto;">

    <!-- Header with text logo -->
    <div style="background: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <div style="display: inline-block;">
        <span style="display: inline-block; width: 12px; height: 12px; background: ${CREME}; transform: rotate(45deg); margin-right: -4px;"></span>
        <span style="display: inline-block; width: 14px; height: 14px; background: ${ROSE}; transform: rotate(45deg); margin-right: -4px; opacity: 0.85;"></span>
        <span style="display: inline-block; width: 12px; height: 12px; background: ${WINE}; transform: rotate(45deg); margin-right: 12px;"></span>
        <span style="font-size: 28px; color: ${WINE}; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; vertical-align: middle;">
          <span style="font-weight: 700;">wine</span><span style="font-weight: 300;">feed</span>
        </span>
      </div>
      <p style="color: #b89a9e; margin: 6px 0 0 0; font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;">SOURCE &amp; SERVE</p>
    </div>

    <!-- Accent line -->
    <div style="height: 4px; background: linear-gradient(90deg, ${CREME} 0%, ${ROSE} 50%, ${WINE} 100%);"></div>

    <!-- Main Content -->
    <div style="background: white; padding: 30px;">
      <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">
        ${greeting}
      </h2>

      ${bodyHtml}

      <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0;">
        V\u00e4nliga h\u00e4lsningar,<br>
        <strong style="color: #111827;">Markus Nilsson</strong><br>
        <span style="color: ${WINE};">Winefeed</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: ${CREME}; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; color: #722F37; font-size: 12px; font-weight: 500;">Winefeed \u2013 Din B2B-marknadsplats f\u00f6r vin</p>
    </div>
  </div>
</body>
</html>`;
}

const emails = [
  {
    to: 'mattias@br-olssons.se',
    subject: 'Ekologiska sm\u00e5producenter f\u00f6r V\u00e4rmlands enda Star Wine List \u2014 Winefeed pilot',
    greeting: 'Hej Mattias,',
    body: [
      'Ekologiska sm\u00e5producenter \u00e4r sv\u00e5ra att hitta \u2014 och \u00e4nnu sv\u00e5rare att importera utan att bli egen import\u00f6r. Det \u00e4r precis det Winefeed l\u00f6ser.',
      'Vi bygger en B2B-marknadsplats d\u00e4r restauranger kan best\u00e4lla vin direkt fr\u00e5n utvalda import\u00f6rer. Vi sk\u00f6ter tull, logistik och dokumentation \u2014 ni best\u00e4ller bara.',
      'N\u00e4r vi tittade p\u00e5 er vinlista och ert fokus p\u00e5 terroir och ekologiskt odlat k\u00e4ndes det som en uppenbar match. N\u00e5gra stilar fr\u00e5n v\u00e5rt sortiment:',
      `<div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 16px 0 20px 0;">
        <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Ekologisk Alsace</strong> \u2014 Charles Frey Riesling Granite, Pinot Noir Harmonie, Pinot Gris Symbiose (170 kr ex moms)<br>
          <strong style="color: ${WINE};">Naturvin Beaujolais</strong> \u2014 Karim Vionnet Fleurie 2021, Beaujolais Villages Blanc (180\u2013210 kr ex moms)<br>
          <strong style="color: ${WINE};">Bourgogne</strong> \u2014 Camille &amp; Laurent Schaller, Bourgogne Blanc och Chablis 2024 (170/190 kr ex moms)<br>
          <strong style="color: ${WINE};">Biodynamiskt Nya Zeeland</strong> \u2014 Millton Chenin Blanc, Black Estate Pinot Noir, TWR Riesling (219\u2013249 kr ex moms)<br>
          <strong style="color: ${WINE};">H\u00e5llbart Chile</strong> \u2014 Cinsault och Pa\u00eds fr\u00e5n Itata, Carignan fr\u00e5n Maule (140\u2013180 kr ex moms)
        </p>
      </div>`,
      'Vi \u00e4r just nu i pilotfas och letar efter r\u00e4tt st\u00e4llen att bygga med. Om du vill kan jag s\u00e4tta upp ett inlogg s\u00e5 att du f\u00e5r kika runt i plattformen sj\u00e4lv \u2014 och g\u00e4rna h\u00f6ra vad du tycker.',
      'S\u00e4g bara till s\u00e5 fixar jag det.',
    ],
  },
  {
    to: 'hello@vinotek1.se',
    subject: 'Nya uppt\u00e4ckter f\u00f6r 47 l\u00e4nder och veckovis glasrotation \u2014 Winefeed pilot',
    greeting: 'Hej Patric,',
    body: [
      'En glaslista som byts varje vecka kr\u00e4ver ett konstant fl\u00f6de av sp\u00e4nnande nyheter \u2014 och det \u00e4r sv\u00e5rt att h\u00e5lla ig\u00e5ng utan r\u00e4tt kontakter. Det \u00e4r precis det Winefeed l\u00f6ser.',
      'Vi bygger en B2B-marknadsplats d\u00e4r restauranger kan best\u00e4lla vin direkt fr\u00e5n utvalda import\u00f6rer. Vi sk\u00f6ter tull, logistik och dokumentation \u2014 ni best\u00e4ller bara.',
      'N\u00e4r vi tittade p\u00e5 er profil med 47 l\u00e4nder och veckovis rotation k\u00e4ndes det som en uppenbar match. N\u00e5gra stilar fr\u00e5n v\u00e5rt sortiment:',
      `<div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 16px 0 20px 0;">
        <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Alsace naturvin</strong> \u2014 Charles Frey Riesling Granite, Pinot Gris Symbiose, Mac\u00e9ration skin contact, Frankenstein-blend (170\u2013220 kr ex moms)<br>
          <strong style="color: ${WINE};">Beaujolais</strong> \u2014 Karim Vionnet Fleurie 2021, Pet Nat, Beaujolais Villages Blanc (170\u2013210 kr ex moms)<br>
          <strong style="color: ${WINE};">Grower Champagne</strong> \u2014 Vincent Charlot Extra-Brut, Emilien Fresne Grande R\u00e9serve (275\u2013390 kr ex moms)<br>
          <strong style="color: ${WINE};">Chile, l\u00e5gintervention</strong> \u2014 Pa\u00eds och Cinsault fr\u00e5n Itata, Carignan fr\u00e5n Maule, Garnacha fr\u00e5n Huasco (140\u2013240 kr ex moms)<br>
          <strong style="color: ${WINE};">Nya Zeeland, biodynamiskt</strong> \u2014 Millton Chenin Blanc och Field Blend, Black Estate Pinot Noir och Cabernet Franc (219\u2013249 kr ex moms)
        </p>
      </div>`,
      'Vi \u00e4r i pilotfas och letar efter r\u00e4tt st\u00e4llen att bygga med. Jag kan s\u00e4tta upp ett inlogg s\u00e5 att du f\u00e5r kika runt i plattformen sj\u00e4lv \u2014 och g\u00e4rna h\u00f6ra vad du tycker.',
      'S\u00e4g bara till s\u00e5 fixar jag det.',
    ],
  },
];

async function main() {
  console.log(`Sending ${emails.length} outreach emails...\n`);

  for (const email of emails) {
    const html = buildHtml(email.greeting, email.body);

    console.log(`\u2192 ${email.to} \u2014 "${email.subject}"`);

    const { data, error } = await resend.emails.send({
      from: 'Winefeed <hej@winefeed.se>',
      replyTo: 'markus@winefeed.se',
      to: email.to,
      bcc: 'markus@winefeed.se',
      subject: email.subject,
      html: html,
    });

    if (error) {
      console.error(`  \u2717 ERROR:`, error);
    } else {
      console.log(`  \u2713 Sent! ID: ${data.id}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\nDone!');
}

main();
