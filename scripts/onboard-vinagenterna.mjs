import { createClient } from '@supabase/supabase-js';
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

// --- Config ---
const SUPPLIER_NAME = 'Vinagenterna';
const CONTACT_EMAIL = 'info@vinagenterna.se';
const LOGIN_EMAIL = 'info@vinagenterna.se';
const LOGIN_PASSWORD = 'Winefeed2026!';
const PHONE = '+46 766 335 126';
const WEBSITE = 'www.vinagenterna.se';
const RECIPIENT_NAME = 'Fredrik';

const LOGIN_URL = 'https://winefeed.se/supplier/login';
const SUPPLIER_DASHBOARD_URL = 'https://winefeed.se/supplier';

const WINE = '#722F37';
const ROSE = '#E8B4B8';
const CREME = '#E8DFC4';

// --- Step 1: Create supplier in Supabase ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

console.log('1. Skapar supplier-rad...');
const { data: supplier, error: supplierError } = await supabase
  .from('suppliers')
  .insert({
    namn: SUPPLIER_NAME,
    kontakt_email: CONTACT_EMAIL,
    telefon: PHONE,
    hemsida: WEBSITE,
    normalleveranstid_dagar: 3,
    type: 'SWEDISH_IMPORTER',
    license_verified: false,
    is_active: true,
  })
  .select()
  .single();

if (supplierError) {
  console.error('❌ Supplier-skapande misslyckades:', supplierError);
  process.exit(1);
}
console.log(`✅ Supplier skapad: ${supplier.id} (${supplier.namn})`);

console.log('2. Skapar auth-user...');
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: LOGIN_EMAIL,
  password: LOGIN_PASSWORD,
  email_confirm: true,
  user_metadata: {
    user_type: 'supplier',
    supplier_id: supplier.id,
    supplier_name: SUPPLIER_NAME,
    role: 'admin',
  },
});

if (authError) {
  console.error('❌ Auth-user misslyckades:', authError);
  // Rollback supplier
  await supabase.from('suppliers').delete().eq('id', supplier.id);
  console.log('↩️  Supplier raderad (rollback)');
  process.exit(1);
}
console.log(`✅ Auth-user skapad: ${authData.user.id} (${authData.user.email})`);

console.log('3. Skapar supplier_users-koppling...');
const { error: linkError } = await supabase
  .from('supplier_users')
  .insert({
    id: authData.user.id,
    supplier_id: supplier.id,
    role: 'admin',
    is_active: true,
  });

if (linkError && !linkError.message.includes('duplicate')) {
  console.warn('⚠️  supplier_users-koppling:', linkError.message);
}
console.log('✅ Koppling klar');

// --- Step 2: Send onboarding email ---
console.log('4. Skickar onboarding-mail...');
const resend = new Resend(process.env.RESEND_API_KEY);

const subject = `Välkommen till Winefeed, ${RECIPIENT_NAME}!`;

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
        Hej ${RECIPIENT_NAME}!
      </h2>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 16px 0; font-size: 15px;">
        Vad kul att ni vill testa Winefeed! Här kommer era inloggningsuppgifter. Vi är i <strong>pilotfas</strong> just nu, vilket innebär att allt är <strong>helt gratis</strong> — inga avgifter, inga bindningstider.
      </p>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 20px 0; font-size: 15px;">
        Det enda vi ber om i gengäld är er feedback — vad funkar bra, vad saknas, vad kan bli bättre.
      </p>

      <!-- Login credentials box -->
      <div style="background: #f8f9fa; border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 25px 0;">
        <h3 style="color: ${WINE}; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">
          Era inloggningsuppgifter
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
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Lösenord:</td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; font-family: monospace; letter-spacing: 0.5px;">${LOGIN_PASSWORD}</td>
          </tr>
        </table>
      </div>

      <!-- Steps for suppliers -->
      <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid ${ROSE}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 25px 0;">
        <h3 style="color: ${WINE}; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">
          Kom igång på 10 minuter
        </h3>
        <ol style="color: #4b5563; margin: 0; padding-left: 18px; line-height: 2.2; font-size: 14px;">
          <li style="padding-left: 8px;">Logga in med uppgifterna ovan</li>
          <li style="padding-left: 8px;">Ladda upp ert sortiment (CSV eller manuellt)</li>
          <li style="padding-left: 8px;">Restauranger hittar era viner via sökning och matchning</li>
          <li style="padding-left: 8px;">Ni får en notis när en förfrågan kommer in — svara med offert direkt i plattformen</li>
        </ol>
      </div>

      <!-- Pilot info box -->
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 25px 0;">
        <p style="color: #166534; margin: 0; font-size: 14px; line-height: 1.6;">
          <strong>Pilot = gratis + nära dialog.</strong> Vi bygger Winefeed tillsammans med er som importörer. Allt är gratis under piloten och vi finns tillgängliga om ni har frågor eller idéer.
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${LOGIN_URL}" style="display: inline-block; background: ${WINE}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
          Logga in och ladda upp sortiment →
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

const { data: emailData, error: emailError } = await resend.emails.send({
  from: 'Markus på Winefeed <markus@winefeed.se>',
  replyTo: 'markus@winefeed.se',
  to: CONTACT_EMAIL,
  cc: 'markus@winefeed.se',
  subject: subject,
  html: html,
});

if (emailError) {
  console.error('❌ Email misslyckades:', emailError);
  process.exit(1);
}

console.log(`✅ Onboarding-mail skickat till ${CONTACT_EMAIL}!`, emailData);
console.log('\n--- SAMMANFATTNING ---');
console.log(`Supplier: ${SUPPLIER_NAME} (${supplier.id})`);
console.log(`Login: ${LOGIN_EMAIL} / ${LOGIN_PASSWORD}`);
console.log(`Auth user: ${authData.user.id}`);
console.log(`Email: skickat till ${CONTACT_EMAIL}`);
