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

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Hej Fredrik!
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Markus h&auml;r &mdash; vi har haft kontakt tidigare (jag driver bland annat Vinkoll och jobbar med Munsk&auml;nkarna).
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Jag h&ouml;r av mig f&ouml;r att vi bygger Winefeed, en B2B-plattform d&auml;r restauranger s&ouml;ker och best&auml;ller vin direkt fr&aring;n import&ouml;rer. Just nu pilotar vi med ett par svenska import&ouml;rer och er profil &mdash; sm&aring;skaliga producenter med karakt&auml;r &mdash; &auml;r precis vad restaurangerna efterfr&aring;gar.
      </p>

      <!-- Steps box -->
      <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 25px 0;">
        <h3 style="color: ${WINE}; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">
          S&aring; h&auml;r funkar det
        </h3>
        <ol style="color: #4b5563; margin: 0; padding-left: 18px; line-height: 2;">
          <li style="padding-left: 8px;">Ni laddar upp ert sortiment (tar ca 10 min)</li>
          <li style="padding-left: 8px;">Restauranger hittar era viner via s&ouml;kning och matchning mot sin meny</li>
          <li style="padding-left: 8px;">Ni f&aring;r f&ouml;rfr&aring;gningar och skickar offert direkt i plattformen</li>
          <li style="padding-left: 8px;">Helt gratis under piloten (t.o.m. 30 juni 2026)</li>
        </ol>
      </div>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 25px 0; font-size: 15px;">
        Vill ni testa? Jag kan skicka en inbjudan s&aring; &auml;r ni ig&aring;ng p&aring; en kvart.
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.winefeed.se/leverantorer?utm_source=outreach&utm_medium=email&utm_campaign=growth_pilot&utm_content=vinagenterna" style="display: inline-block; background: ${WINE}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
          L&auml;s mer om Winefeed &rarr;
        </a>
      </div>

      <p style="color: #4b5563; line-height: 1.7; margin: 25px 0 0 0; font-size: 15px;">
        /Markus
      </p>
      <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0 0;">
        <a href="https://www.winefeed.se" style="color: ${WINE}; font-weight: 500;">winefeed.se</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: ${CREME}; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; color: #722F37; font-size: 12px; font-weight: 500;">Winefeed &ndash; Din B2B-marknadsplats f&ouml;r vin</p>
    </div>
  </div>
</body>
</html>
`;

async function main() {
  console.log('Sending onboarding email to Vinagenterna (Fredrik Edsberg)...');
  console.log('To: info@vinagenterna.se');
  console.log('CC: markus@winefeed.se');

  const { data, error } = await resend.emails.send({
    from: 'Markus på Winefeed <markus@winefeed.se>',
    to: 'info@vinagenterna.se',
    cc: 'markus@winefeed.se',
    replyTo: 'markus@winefeed.se',
    subject: 'Winefeed — plattform för era viner mot restauranger',
    html: html,
  });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('✅ Email skickat!', data);
}

main();
