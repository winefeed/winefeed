import { Resend } from 'resend';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.vercel') });

const resend = new Resend(process.env.RESEND_API_KEY);

const WINE = '#722F37';
const ROSE = '#E8B4B8';
const CREME = '#E8DFC4';

const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto;">

    <!-- Header with text logo -->
    <div style="background: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <div style="display: inline-block;">
        <span style="display: inline-block; width: 12px; height: 12px; background: #E8DFC4; transform: rotate(45deg); margin-right: -4px;"></span>
        <span style="display: inline-block; width: 14px; height: 14px; background: #E8B4B8; transform: rotate(45deg); margin-right: -4px; opacity: 0.85;"></span>
        <span style="display: inline-block; width: 12px; height: 12px; background: #722F37; transform: rotate(45deg); margin-right: 12px;"></span>
        <span style="font-size: 28px; color: #722F37; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; vertical-align: middle;">
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
        Tre vinförslag till er nya säsong
      </h2>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Hej Peter,
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Jag såg att ni snart öppnar för säsongen och tänkte att det kunde vara värdefullt med lite input.
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 25px 0; font-size: 15px;">
        Vi på Winefeed kopplar kvalitetsrestauranger till intressanta importörer. Er profil — hållbart, nordiskt, hantverksmässigt — matchade direkt med flera av våra leverantörer.
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 15px 0; font-size: 15px;">
        Jag tittade på era rätter från förra säsongen och matchade tre viner:
      </p>

      <!-- Wine matches -->
      <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 0 0 25px 0;">

        <div style="margin-bottom: 18px;">
          <p style="color: ${WINE}; font-weight: 600; margin: 0 0 4px 0; font-size: 15px;">Vedette, Cinsault — 159 kr</p>
          <p style="color: #6b7280; margin: 0; font-size: 13px;">Chile/Maule · Till er tartar med stenbitsrom — lätt, saftigt röd som inte sköljer bort rommen</p>
        </div>

        <div style="margin-bottom: 18px;">
          <p style="color: ${WINE}; font-weight: 600; margin: 0 0 4px 0; font-size: 15px;">Millton Te Arai Chenin Blanc — 219 kr</p>
          <p style="color: #6b7280; margin: 0; font-size: 13px;">Nya Zeeland/Gisborne, biodynamisk · Till rökgrillad kyckling — kropp och syra som hanterar rök och ost</p>
        </div>

        <div>
          <p style="color: ${WINE}; font-weight: 600; margin: 0 0 4px 0; font-size: 15px;">Charles Frey Riesling Granite — 170 kr</p>
          <p style="color: #6b7280; margin: 0; font-size: 13px;">Alsace, biodynamisk · Till vit sparris med krusbär — klassisk match</p>
        </div>

      </div>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 25px 0; font-size: 15px;">
        Alla tre från småskaliga, biodynamiska/ekologiska producenter. Priserna är ex moms.
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 25px 0; font-size: 15px; font-weight: 500;">
        Har ni årets meny klar? Vi matchar gärna hela listan — helt utan kostnad.
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 25px 0; font-size: 15px;">
        Winefeed är gratis att använda och ger er tillgång till flera importörer på ett ställe.
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.winefeed.se?utm_source=outreach&utm_medium=email&utm_campaign=growth_pilot&utm_content=spiseriet" style="display: inline-block; background: ${WINE}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
          Läs mer om Winefeed →
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0;">
        /Markus<br>
        <a href="https://www.winefeed.se" style="color: ${WINE}; font-weight: 500;">winefeed.se</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: ${CREME}; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; color: #722F37; font-size: 12px; font-weight: 500;">Winefeed – Din B2B-marknadsplats för vin</p>
    </div>
  </div>
</body>
</html>
`;

async function main() {
  console.log('Sending Spiseriet outreach email...');
  const { data, error } = await resend.emails.send({
    from: 'Markus på Winefeed <markus@winefeed.se>',
    to: 'kontakt@spiseriet.se',
    bcc: 'markus@winefeed.se',
    replyTo: 'markus@winefeed.se',
    subject: 'Tre vinförslag till er nya säsong',
    html: html,
  });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('✅ Email skickat till Spiseriet!', data);
}

main();
