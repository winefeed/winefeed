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

const TO = process.argv[2] || 'markus@winefeed.se';
const RESTAURANT = 'Vita Amandi';
const LOGIN_EMAIL = 'marcus@vitaamandi.se';
const LOGIN_PASSWORD = 'Winefeed2026';
const LOGIN_URL = 'https://winefeed.se/login';
const DASHBOARD_URL = 'https://winefeed.se/dashboard/new-request';

const WINE = '#722F37';
const ROSE = '#E8B4B8';
const CREME = '#E8DFC4';

const subject = `Dina inloggningsuppgifter till Winefeed`;

const html = `
<!DOCTYPE html>
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
        Hej Marcus!
      </h2>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Här kommer dina inloggningsuppgifter till Winefeed. Logga in och testa att skapa din första vinförfrågan.
      </p>

      <!-- Login credentials box -->
      <div style="background: #f8f9fa; border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 25px 0;">
        <h3 style="color: ${WINE}; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">
          Dina inloggningsuppgifter
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Webbplats:</td>
            <td style="padding: 8px 0; font-size: 14px;">
              <a href="${LOGIN_URL}" style="color: ${WINE}; font-weight: 600; text-decoration: none;">${LOGIN_URL}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">E-post:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${LOGIN_EMAIL}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Losenord:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; font-family: monospace; letter-spacing: 0.5px;">${LOGIN_PASSWORD}</td>
          </tr>
        </table>
      </div>

      <!-- Steps -->
      <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 25px 0;">
        <h3 style="color: ${WINE}; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">
          Kom igång på 2 minuter
        </h3>
        <ol style="color: #4b5563; margin: 0; padding-left: 18px; line-height: 2.2; font-size: 14px;">
          <li style="padding-left: 8px;">Logga in med uppgifterna ovan</li>
          <li style="padding-left: 8px;">Klicka <strong>"Ny förfrågan"</strong></li>
          <li style="padding-left: 8px;">Beskriv fritt vad du letar efter, t.ex. <em>"Franskt rött till kött, runt 100-150 kr"</em></li>
          <li style="padding-left: 8px;">Vänta på offerter — du får en notis när de kommer</li>
        </ol>
      </div>

      <!-- Reassurance -->
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 25px 0;">
        <p style="color: #166534; margin: 0; font-size: 14px; line-height: 1.6;">
          <strong>Du kan inte göra fel.</strong> Vinerna och importörerna är riktiga, men under piloten har vi tät kontakt — så det är bara att testa fritt. Om något ser konstigt ut, hör av dig.
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${LOGIN_URL}" style="display: inline-block; background: ${WINE}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
          Logga in och testa →
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0; text-align: center;">
        Frågor? Svara på detta mail eller skriv till <a href="mailto:markus@winefeed.se" style="color: ${WINE}; font-weight: 500;">markus@winefeed.se</a>
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

console.log(`Skickar onboarding-mail till: ${TO}`);
console.log(`Ämne: ${subject}\n`);

const { data, error } = await resend.emails.send({
  from: 'Markus på Winefeed <markus@winefeed.se>',
  replyTo: 'markus@winefeed.se',
  to: TO,
  subject: subject,
  html: html,
});

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('✅ Skickat!', data);
