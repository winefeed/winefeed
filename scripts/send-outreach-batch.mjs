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
    if (p.startsWith('<')) return p; // already HTML
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
        Vänliga hälsningar,<br>
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
    to: 'info@gemlavinbar.se',
    subject: 'Hantverksviner från tre kontinenter — Winefeed pilot',
    greeting: 'Hej Anna,',
    body: [
      'Vi bygger Winefeed \u2014 en B2B-marknadsplats där restauranger kan hitta och beställa vin direkt från utvalda importörer. Just nu är vi i pilotfas med ett fåtal importörer och restauranger.',
      'Gemla Vinbar fastnade direkt hos oss. Ert fokus på hantverksviner matchar exakt det sortiment vi har inne just nu:',
      `<div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 16px 0 20px 0;">
        <p style="color: #4b5563; margin: 0 0 10px 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Fransk naturvin</strong> \u2014 Karim Vionnet (Fleurie, Pet Nat), Charles Frey (Alsace skin contact, orange), Banjo Vino (Languedoc)<br>
          <strong style="color: ${WINE};">Chilenskt l\u00e5ginterventionsvin</strong> \u2014 Pa\u00eds, Cinsault och Carignan fr\u00e5n sm\u00e5 familjeg\u00e5rdar i Itata och Maule<br>
          <strong style="color: ${WINE};">Biodynamiskt Nya Zeeland</strong> \u2014 Black Estate (Waipara), Millton (Gisborne, Chenin Blanc, Field Blend)
        </p>
      </div>`,
      'Vi håller just nu på att bygga upp en importlösning där vi sköter tull, logistik och dokumentation åt er \u2014 så att ni kan beställa direkt från europeiska och internationella producenter utan att behöva vara egen importör.',
      'Vill ni se sortimentet? Jag skickar gärna en katalog eller bokar ett kort samtal.',
    ],
  },
  {
    to: 'info@sundnergarden.se',
    subject: 'Glasviner för roterande listor — Winefeed pilot',
    greeting: 'Hej Johan och Niklas,',
    body: [
      'Vi bygger Winefeed \u2014 en B2B-marknadsplats för vin, där restauranger kan beställa från utvalda importörer. Vi är i pilotfas med ett fåtal importörer och restauranger, och letar efter ställen som verkligen bryr sig om vad som hamnar i glaset.',
      'Med 70+ glasviner och en filosofi kring ekologiska familjeproducenter känns Sund Nergården som en perfekt match. Några stilar från vårt nuvarande sortiment som kan passa er rotation:',
      `<div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 16px 0 20px 0;">
        <p style="color: #4b5563; margin: 0 0 10px 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Lätta röda per glas</strong> \u2014 Karim Vionnet Fleurie 2021, Cinsault fr\u00e5n Chile (159\u2013210 kr ex moms)<br>
          <strong style="color: ${WINE};">Aromatiska vita</strong> \u2014 Charles Frey Riesling Granite, Misha\u2019s Pinot Gris Central Otago (159\u2013170 kr ex moms)<br>
          <strong style="color: ${WINE};">Spännande samtalsämnen</strong> \u2014 G. Metz Orange Wine (Gewürztraminer), Black Estate Chenin Blanc fr\u00e5n Waipara (180\u2013249 kr ex moms)
        </p>
      </div>`,
      'Vi håller dessutom på att bygga upp en importlösning där vi sköter tull, logistik och dokumentation \u2014 så att ni kan beställa direkt från producenter utan att behöva vara egen importör.',
      'Kan jag skicka en komplett katalog?',
    ],
  },
  {
    to: 'info@klostergatan.se',
    subject: 'Bourgogne, Alsace, Champagne — via Winefeed',
    greeting: 'Hej Calle,',
    body: [
      'Vi bygger Winefeed \u2014 en B2B-marknadsplats där restauranger kan beställa vin direkt från utvalda importörer. Just nu pilotfas, ett fåtal importörer och restauranger.',
      'Klostergatans franska profil matchar vårt sortiment ovanligt bra. Några exempel:',
      `<div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 16px 0 20px 0;">
        <p style="color: #4b5563; margin: 0 0 10px 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Bourgogne</strong> \u2014 Camille &amp; Laurent Schaller, Bourgogne Blanc och Chablis 2024 (170/190 kr ex moms)<br>
          <strong style="color: ${WINE};">Grower Champagne</strong> \u2014 Vincent Charlot Extra-Brut, Emilien Fresne Grande R\u00e9serve (275\u2013390 kr ex moms)<br>
          <strong style="color: ${WINE};">Alsace</strong> \u2014 Charles Frey Riesling, Pinot Gris, skin contact (170\u2013220 kr ex moms)<br>
          <strong style="color: ${WINE};">Beaujolais</strong> \u2014 Karim Vionnet Fleurie 2021, Beaujolais Villages Blanc (180\u2013210 kr ex moms)
        </p>
      </div>`,
      'Vi bygger just nu en importlösning där vi sköter tull, logistik och dokumentation \u2014 så att ni kan beställa direkt från producenter utan att behöva vara egen importör.',
      'Vill du se hela katalogen?',
    ],
  },
  {
    to: 'hej@enoteket.se',
    subject: 'Glasviner utanför Italien — Winefeed pilot',
    greeting: 'Hej Jerney,',
    body: [
      'Vi bygger Winefeed \u2014 en B2B-marknadsplats för vin. Just nu i pilotfas med ett fåtal utvalda importörer och restauranger.',
      '32 Enomatic-automater och regelbundna Winemaker Dinners innebär att ni har ett ständigt behov av intressanta glasviner. Vi har stilar som kan komplettera er italienska kärna:',
      `<div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 16px 0 20px 0;">
        <p style="color: #4b5563; margin: 0 0 10px 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Franska naturviner</strong> \u2014 Fleurie, Rh\u00f4ne-blends, Bourgogne Blanc, Grower Champagne<br>
          <strong style="color: ${WINE};">Sydamerikanskt l\u00e5ginterventionsvin</strong> \u2014 Pa\u00eds, Cinsault, Carignan fr\u00e5n Chile<br>
          <strong style="color: ${WINE};">Nya Zeeland</strong> \u2014 TWR Riesling, Black Estate Pinot Noir, Misha\u2019s Central Otago
        </p>
      </div>`,
      'Perfekt för en Winemaker Dinner utanför Italien \u2014 eller som komplement i automaterna.',
      'Vi håller dessutom på att bygga en importlösning där vi sköter tull, logistik och dokumentation \u2014 så att ni kan beställa direkt från producenter utan att behöva vara egen importör.',
      'Intressant? Jag skickar gärna katalogen.',
    ],
  },
];

async function main() {
  console.log(`Sending ${emails.length} outreach emails...\n`);

  for (const email of emails) {
    const html = buildHtml(email.greeting, email.body);

    console.log(`→ ${email.to} — "${email.subject}"`);

    const { data, error } = await resend.emails.send({
      from: 'Winefeed <hej@winefeed.se>',
      replyTo: 'markus@winefeed.se',
      to: email.to,
      bcc: 'markus@winefeed.se',
      subject: email.subject,
      html: html,
    });

    if (error) {
      console.error(`  ✗ ERROR:`, error);
    } else {
      console.log(`  ✓ Sent! ID: ${data.id}`);
    }

    // Small delay between sends
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\nDone!');
}

main();
