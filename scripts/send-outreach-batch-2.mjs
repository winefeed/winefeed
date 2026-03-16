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
    to: 'info@baravinbistro.se',
    subject: 'Franska sm\u00e5producenter f\u00f6r 300 glasviner \u2014 Winefeed pilot',
    greeting: 'Hej Cecilia och P\u00e4r,',
    body: [
      'Vi bygger Winefeed \u2014 en B2B-marknadsplats d\u00e4r restauranger kan hitta och best\u00e4lla vin direkt fr\u00e5n utvalda import\u00f6rer. Just nu \u00e4r vi i pilotfas med ett f\u00e5tal import\u00f6rer och restauranger.',
      'Tv\u00e5 sommelierer som driver en vinbar med 300 viner p\u00e5 listan och vinprovningar varje l\u00f6rdag \u2014 ni \u00e4r precis den typ av st\u00e4lle vi bygger Winefeed f\u00f6r. Er franska profil matchar v\u00e5rt sortiment ovanligt bra:',
      `<div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 16px 0 20px 0;">
        <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Bourgogne</strong> \u2014 Camille &amp; Laurent Schaller, Bourgogne Blanc och Chablis 2024<br>
          <strong style="color: ${WINE};">Grower Champagne</strong> \u2014 Vincent Charlot Extra-Brut, Emilien Fresne Grande R\u00e9serve<br>
          <strong style="color: ${WINE};">Alsace</strong> \u2014 Charles Frey Riesling, Pinot Gris, skin contact<br>
          <strong style="color: ${WINE};">Beaujolais</strong> \u2014 Karim Vionnet Fleurie 2021, Beaujolais Villages Blanc<br>
          <strong style="color: ${WINE};">Languedoc</strong> \u2014 Clos Fantine Tradition, Banjo Vino (Syrah/Grenache, Pinot Noir)
        </p>
      </div>`,
      'Alla sm\u00e5 producenter med personlighet \u2014 perfekt f\u00f6r era l\u00f6rdagsprovningar eller som nya uppt\u00e4ckter p\u00e5 listan.',
      'Vi h\u00e5ller just nu p\u00e5 att bygga upp en importl\u00f6sning d\u00e4r vi sk\u00f6ter tull, logistik och dokumentation \u00e5t er \u2014 s\u00e5 att ni kan best\u00e4lla direkt fr\u00e5n producenter utan att beh\u00f6va vara egen import\u00f6r.',
      'Vill ni se sortimentet? Jag skickar g\u00e4rna en katalog eller bokar ett kort samtal.',
    ],
  },
  {
    to: 'info@butlersnorrkoping.se',
    subject: 'Bourgogne, Champagne och Alsace f\u00f6r Coravin-rotationen \u2014 Winefeed pilot',
    greeting: 'Hej Mikael,',
    body: [
      'Vi bygger Winefeed \u2014 en B2B-marknadsplats d\u00e4r restauranger kan hitta och best\u00e4lla vin direkt fr\u00e5n utvalda import\u00f6rer. Just nu \u00e4r vi i pilotfas med ett f\u00e5tal import\u00f6rer och restauranger.',
      '30 glasviner med Coravin och m\u00e5natlig rotation inneb\u00e4r att ni st\u00e4ndigt beh\u00f6ver sp\u00e4nnande nyheter. Vi har just nu sm\u00e5producenter som kan passa er klassiska profil:',
      `<div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 16px 0 20px 0;">
        <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Bourgogne</strong> \u2014 Camille &amp; Laurent Schaller, Bourgogne Blanc och Chablis 2024<br>
          <strong style="color: ${WINE};">Grower Champagne</strong> \u2014 Vincent Charlot Extra-Brut (Pinot Noir), Emilien Fresne Grande R\u00e9serve<br>
          <strong style="color: ${WINE};">Alsace</strong> \u2014 Charles Frey Riesling Granite, Pinot Gris Symbiose, Pinot Noir Harmonie<br>
          <strong style="color: ${WINE};">Rh\u00f4ne</strong> \u2014 Banjo Vino Guru (Syrah/Grenache)<br>
          <strong style="color: ${WINE};">Nya Zeeland</strong> \u2014 TWR Riesling (Marlborough), Misha\u2019s Pinot Gris (Central Otago)
        </p>
      </div>`,
      'Vi h\u00e5ller just nu p\u00e5 att bygga upp en importl\u00f6sning d\u00e4r vi sk\u00f6ter tull, logistik och dokumentation \u2014 s\u00e5 att ni kan best\u00e4lla direkt fr\u00e5n producenter utan att beh\u00f6va vara egen import\u00f6r. Intressant f\u00f6r b\u00e5de Butlers och era andra st\u00e4llen i Unika M\u00f6ten-gruppen.',
      'Intressant? Jag skickar g\u00e4rna en katalog.',
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
