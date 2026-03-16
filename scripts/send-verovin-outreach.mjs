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

const html = `<!DOCTYPE html>
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
        Hej igen!
      </h2>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 16px 0; font-size: 15px;">
        Jag kikade p\u00e5 er meny och matchade mot viner i Winefeed fr\u00e5n tre olika import\u00f6rer. Ni har en fantastisk fransktung vinlista \u2014 det h\u00e4r \u00e4r t\u00e4nkt som komplement med producenter ni kanske inte st\u00f6ter p\u00e5 genom vanliga kanaler.
      </p>

      <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 16px 0 20px 0;">
        <p style="color: #4b5563; margin: 0 0 14px 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Till Fransk Vaktel med tryffelmousseline</strong><br>
          Misha\u2019s Cantata Pinot Noir 2020, Central Otago \u2014 via AKO Wine &amp; Spirits<br>
          <span style="color: #6b7280; font-size: 13px;">Elegant, silkeslen Pinot Noir med r\u00f6da k\u00f6rsb\u00e4r och kryddiga toner. Central Otago levererar Pinot i klass med Bourgogne men med egen identitet. Ekologiskt.</span>
        </p>
        <p style="color: #4b5563; margin: 0 0 14px 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Till R\u00e5biff med soyapicklad shitake</strong><br>
          Millton Libiamo Field Blend 2020, Gisborne \u2014 via AKO Wine &amp; Spirits<br>
          <span style="color: #6b7280; font-size: 13px;">Orange wine (Gew\u00fcrztraminer, Muscat, Chenin Blanc). Skalkontakt, ofiltrerat, biodynamiskt. Umami-v\u00e4nligt och texturerat \u2014 gjort f\u00f6r den d\u00e4r kombinationen av r\u00e5tt k\u00f6tt och soja.</span>
        </p>
        <p style="color: #4b5563; margin: 0; font-size: 14px; line-height: 1.8;">
          <strong style="color: ${WINE};">Till Nattbakad Ibericogris med plommonglaze</strong><br>
          Wildmakers Sabatico 2018, Maule \u2014 via Wena Wines<br>
          <span style="color: #6b7280; font-size: 13px;">Carignan/Garnacha-blend fr\u00e5n Chile. Rustikt och kryddigt med mogna tanniner \u2014 speglar plommonglazens s\u00f6tma och grisens fettrika karakt\u00e4r. Liten producent.</span>
        </p>
      </div>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 16px 0; font-size: 15px;">
        Det h\u00e4r \u00e4r den typ av matchning Winefeed g\u00f6r \u2014 vi utg\u00e5r fr\u00e5n er meny och hittar viner fr\u00e5n import\u00f6rer som redan finns i plattformen, redo att best\u00e4lla.
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        <strong style="color: #111827;">Vi erbjuder en komplett vinmatchning av hela er meny \u2014 helt kostnadsfritt.</strong> Ni f\u00e5r ett personligt vinf\u00f6rslag med viner fr\u00e5n flera import\u00f6rer, anpassat efter era r\u00e4tter, er stil och er prisbild. Inga f\u00f6rpliktelser.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="mailto:markus@winefeed.se?subject=Vinmatchning%20Verovin" style="display: inline-block; background: ${WINE}; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600;">Ja, vi vill testa!</a>
      </div>

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

async function main() {
  console.log('Sending Verovin outreach email...\n');

  const { data, error } = await resend.emails.send({
    from: 'Markus på Winefeed <markus@winefeed.se>',
    replyTo: 'markus@winefeed.se',
    to: 'boka@verovin.se',
    bcc: 'markus@winefeed.se',
    subject: 'Tre vinförslag till er meny — Winefeed',
    html: html,
  });

  if (error) {
    console.error('✗ ERROR:', error);
  } else {
    console.log('✓ Sent! ID:', data.id);
  }
}

main();
