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

const TO = process.argv[2] || 'markus@esima.se';
const SUBJECT = 'Vos vins français trouvent leur place en Suède';

const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
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
        Salut Corentin,
      </h2>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Je voulais faire un point rapide sur votre portfolio chez Winefeed. Vous avez actuellement <strong>25 vins français</strong> référencés sur la plateforme — et les restaurateurs suédois commencent à s'y intéresser.
      </p>

      <!-- Portfolio overview box -->
      <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 25px 0;">
        <h3 style="color: ${WINE}; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">
          Votre portfolio actuel
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #4b5563;">
          <tr>
            <td style="padding: 4px 0;"><strong style="color: #111827;">Tour Calon</strong></td>
            <td style="padding: 4px 0; text-align: right;">4 vins · Bordeaux</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong style="color: #111827;">Banjo Vino</strong></td>
            <td style="padding: 4px 0; text-align: right;">4 vins · Languedoc</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong style="color: #111827;">Charles Frey</strong></td>
            <td style="padding: 4px 0; text-align: right;">4 vins · Alsace</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong style="color: #111827;">Karim Vionnet</strong></td>
            <td style="padding: 4px 0; text-align: right;">3 vins · Beaujolais</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong style="color: #111827;">G. Metz</strong></td>
            <td style="padding: 4px 0; text-align: right;">3 vins · Alsace</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong style="color: #111827;">+ 3 autres</strong></td>
            <td style="padding: 4px 0; text-align: right;">Bourgogne, Languedoc</td>
          </tr>
        </table>
      </div>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Ce qui marche bien en ce moment côté demande : les <strong>Beaujolais nature</strong> (Karim Vionnet est pile dans la tendance), les <strong>Crémants d'Alsace</strong> comme alternative aux Champagnes, et les <strong>Bordeaux accessibles</strong> type Tour Calon.
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Deux pistes pour la suite :
      </p>

      <ol style="color: #4b5563; line-height: 2; margin: 0 0 20px 0; padding-left: 18px; font-size: 15px;">
        <li style="padding-left: 8px;"><strong>Compléter le portfolio</strong> — Si vous avez de nouvelles cuvées ou des producteurs à ajouter, on peut les intégrer rapidement.</li>
        <li style="padding-left: 8px;"><strong>Vérifier les prix</strong> — Avec la saison de printemps qui approche, c'est le bon moment pour ajuster si besoin.</li>
      </ol>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 25px 0; font-size: 15px;">
        On peut se faire un appel rapide cette semaine si tu veux qu'on en parle ?
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://winefeed.se/supplier" style="display: inline-block; background: ${WINE}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
          Voir votre portfolio sur Winefeed →
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0;">
        À bientôt,<br>
        <strong style="color: #111827;">Markus</strong><br>
        <span style="color: #9ca3af;">Winefeed</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="background: ${CREME}; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; color: ${WINE}; font-size: 12px; font-weight: 500;">Winefeed – Votre marketplace B2B pour le vin en Suède</p>
    </div>
  </div>
</body>
</html>
`;

async function main() {
  const isTest = TO !== 'corentin@brasri.com';
  console.log(`${isTest ? '🧪 TEST' : '🚀 LIVE'} — Sending Brasri email to ${TO}...`);

  const { data, error } = await resend.emails.send({
    from: 'Markus på Winefeed <markus@winefeed.se>',
    replyTo: 'markus@winefeed.se',
    cc: isTest ? undefined : 'markus@winefeed.se',
    to: TO,
    subject: SUBJECT,
    html: html,
  });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('✅ Email skickat!', data);
  console.log(`Resend ID: ${data.id}`);
  if (isTest) {
    console.log(`\n📧 Skicka skarpt: node scripts/send-brasri-email.mjs corentin@brasri.com`);
  }
}

main();
