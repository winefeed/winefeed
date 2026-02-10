import { Resend } from 'resend';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.vercel') });

const resend = new Resend(process.env.RESEND_API_KEY);

const WINE = '#7A1B2D';
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
        <span style="display: inline-block; width: 12px; height: 12px; background: #7A1B2D; transform: rotate(45deg); margin-right: 12px;"></span>
        <span style="font-size: 28px; color: #7A1B2D; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; vertical-align: middle;">
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
        Välkommen, Restaurang Victoria!
      </h2>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 25px 0; font-size: 15px;">
        Ditt konto är nu aktiverat. Du kan börja hitta viner direkt genom att beskriva vad du söker – vi matchar dig med rätt leverantörer.
      </p>

      <!-- Steps box with rosé accent -->
      <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 25px 0;">
        <h3 style="color: ${WINE}; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">
          Så här fungerar det
        </h3>
        <ol style="color: #4b5563; margin: 0; padding-left: 18px; line-height: 2;">
          <li style="padding-left: 8px;">Beskriv vilken typ av vin du letar efter</li>
          <li style="padding-left: 8px;">Få matchade förslag och offerter från leverantörer</li>
          <li style="padding-left: 8px;">Jämför och acceptera – vi sköter resten</li>
        </ol>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://winefeed.se/dashboard/new-request" style="display: inline-block; background: ${WINE}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
          Skapa din första förfrågan →
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0; text-align: center;">
        Frågor? Kontakta oss på <a href="mailto:hej@winefeed.se" style="color: ${WINE}; font-weight: 500;">hej@winefeed.se</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: ${CREME}; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; color: #7A1B2D; font-size: 12px; font-weight: 500;">Winefeed – Din B2B-marknadsplats för vin</p>
    </div>
  </div>
</body>
</html>
`;

async function main() {
  console.log('Sending test email v8 (text logo with diamonds)...');
  const { data, error } = await resend.emails.send({
    from: 'Winefeed <noreply@vinkoll.se>',
    to: 'markus@vinkoll.se',
    subject: '🍷 TEST v8: Välkommen till Winefeed',
    html: html,
  });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('✅ Email skickat!', data);
}

main();
