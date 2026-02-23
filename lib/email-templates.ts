/**
 * EMAIL TEMPLATES - Pilot Loop 1.0
 *
 * Simple HTML + text templates for transactional emails
 * Language: Swedish
 * Brand: Neutral (minimal branding)
 *
 * Security: NO PRICE DATA in emails (keeps it simple, avoids WS-price leakage)
 */

import { getAppUrl } from './email-service';

// ============================================================================
// Shared Winefeed email header & footer (v8 — diamonds + text logo)
// Reference: scripts/send-test-email.mjs
// ============================================================================

function winefeedEmailHeader(): string {
  return `
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
    <div style="height: 4px; background: linear-gradient(90deg, #E8DFC4 0%, #E8B4B8 50%, #7A1B2D 100%);"></div>
    <!-- Body -->
    <div style="background: white; padding: 30px;">`;
}

function winefeedEmailFooter(): string {
  return `
    </div>
    <!-- Footer -->
    <div style="background: #E8DFC4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; color: #7A1B2D; font-size: 12px; font-weight: 500;">Winefeed – Din B2B-marknadsplats för vin</p>
    </div>
  </div>`;
}

export interface OfferCreatedEmailParams {
  restaurantName: string;
  requestTitle: string;
  requestId: string;
  offerId: string;
  offerTitle: string;
  supplierName: string;
  linesCount: number;
}

export interface OfferAcceptedEmailParams {
  supplierName: string;
  restaurantName: string;
  offerId: string;
  requestId: string | null;
  offerTitle: string;
  acceptedAt: string;
}

export interface InviteEmailParams {
  recipientEmail: string;
  role: 'RESTAURANT' | 'SUPPLIER';
  entityName: string;  // Restaurant or Supplier name
  inviteToken: string;  // Plain token (not hash)
  expiresAt: string;
}

export interface OrderStatusUpdatedEmailParams {
  restaurantName?: string;
  orderId: string;
  newStatus: string;
  appUrl?: string;
  deepLink?: string;
}

export interface NewQuoteRequestEmailParams {
  supplierName: string;
  restaurantName: string;
  requestId: string;
  fritext: string;
  antalFlaskor?: number;
  budgetPerFlaska?: number;
  leveransOrt?: string;
  expiresAt?: string;
  wineCount?: number;
  hasProvorder?: boolean;
  provorderFeeTotal?: number;
}

export interface OrderConfirmationEmailParams {
  recipientName: string;
  orderId: string;
  restaurantName: string;
  supplierName: string;
  totalBottles: number;
  totalValueSek?: number;
  deliveryAddress?: string;
  expectedDelivery?: string;
  items: Array<{
    wineName: string;
    quantity: number;
    priceSek?: number;
    provorder?: boolean;
    provorderFee?: number;
  }>;
}

export interface OfferDeclinedEmailParams {
  supplierName: string;
  restaurantName: string;
  offerId: string;
  requestTitle: string;
  declinedAt: string;
  reason?: string;
}

export interface OfferPendingReminderEmailParams {
  restaurantName: string;
  offerId: string;
  offerTitle: string;
  supplierName: string;
  hoursWaiting: number;
  linesCount: number;
}

export interface WelcomeEmailParams {
  restaurantName: string;
  email: string;
  city?: string;
}

/**
 * Template: Offer Created (sent to restaurant)
 */
export function offerCreatedEmail(params: OfferCreatedEmailParams): { subject: string; html: string; text: string } {
  const {
    restaurantName,
    requestTitle,
    requestId,
    offerId,
    offerTitle,
    supplierName,
    linesCount
  } = params;

  const requestUrl = getAppUrl(`/dashboard/requests/${requestId}`);
  const offerUrl = getAppUrl(`/offers/${offerId}`);

  const subject = '📬 Ny offert på din förfrågan';

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${winefeedEmailHeader()}

    <h2 style="color: #7A1B2D; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Ny offert mottagen!</h2>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Hej ${restaurantName},</p>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Du har fått en ny offert från <strong>${supplierName}</strong> på din förfrågan:</p>

    <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid #E8B4B8; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Förfrågan:</strong> ${requestTitle || 'Din förfrågan'}</p>
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Offert:</strong> ${offerTitle || 'Offert från ' + supplierName}</p>
      <p style="margin: 0; color: #4b5563;"><strong>Antal rader:</strong> ${linesCount} ${linesCount === 1 ? 'rad' : 'rader'}</p>
    </div>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Granska offerten och acceptera om den passar era behov.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${offerUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Visa offert
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Se alla offerter: <a href="${requestUrl}" style="color: #7A1B2D;">${requestUrl}</a>
    </p>

  ${winefeedEmailFooter()}
</body>
</html>
  `;

  const text = `
Ny offert på din förfrågan

Hej ${restaurantName},

Du har fått en ny offert från ${supplierName} på din förfrågan:

Förfrågan: ${requestTitle || 'Din förfrågan'}
Offert: ${offerTitle || 'Offert från ' + supplierName}
Antal rader: ${linesCount} ${linesCount === 1 ? 'rad' : 'rader'}

Granska offerten och acceptera om den passar era behov.

Visa offert: ${offerUrl}

Se alla offerter för din förfrågan: ${requestUrl}

---
Winefeed - Din B2B-marknadsplats för vin
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Welcome Email (sent to restaurant on signup)
 */
export function welcomeEmail(params: WelcomeEmailParams): { subject: string; html: string; text: string } {
  const { restaurantName, email, city } = params;

  const dashboardUrl = getAppUrl('/dashboard/new-request');
  const helpUrl = getAppUrl('/dashboard/help');

  const subject = `🍷 Välkommen till Winefeed, ${restaurantName}!`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
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

    <!-- Accent line (grafisk profil) -->
    <div style="height: 4px; background: linear-gradient(90deg, #E8DFC4 0%, #E8B4B8 50%, #7A1B2D 100%);"></div>

    <!-- Main Content -->
    <div style="background: white; padding: 30px;">
      <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">
        Välkommen, ${restaurantName}!
      </h2>

      <p style="color: #4b5563; line-height: 1.7; margin: 0 0 25px 0; font-size: 15px;">
        Ditt konto är nu aktiverat. Du kan börja hitta viner direkt genom att beskriva vad du söker – vi matchar dig med rätt leverantörer.
      </p>

      <!-- Steps box with rosé accent -->
      <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid #E8B4B8; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 25px 0;">
        <h3 style="color: #7A1B2D; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">
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
        <a href="${dashboardUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
          Skapa din första förfrågan →
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin: 25px 0 0 0; text-align: center;">
        Frågor? Kontakta oss på <a href="mailto:hej@winefeed.se" style="color: #7A1B2D; font-weight: 500;">hej@winefeed.se</a>
      </p>
    </div>

    <!-- Footer with crème background -->
    <div style="background: #E8DFC4; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="margin: 0; color: #7A1B2D; font-size: 12px; font-weight: 500;">Winefeed – Din B2B-marknadsplats för vin</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Välkommen till Winefeed, ${restaurantName}!

Ditt konto är nu aktiverat. Du kan börja hitta viner direkt genom att beskriva vad du söker – vi matchar dig med rätt leverantörer.

Så här fungerar det:
1. Beskriv vilken typ av vin du letar efter
2. Få matchade förslag och offerter från leverantörer
3. Jämför och acceptera – vi sköter resten

Kom igång: ${dashboardUrl}

Frågor? Kontakta oss på hej@winefeed.se

---
Winefeed - Din B2B-marknadsplats för vin
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Offer Accepted (sent to supplier)
 */
export function offerAcceptedEmail(params: OfferAcceptedEmailParams): { subject: string; html: string; text: string } {
  const {
    supplierName,
    restaurantName,
    offerId,
    requestId,
    offerTitle,
    acceptedAt
  } = params;

  const offerUrl = getAppUrl(`/offers/${offerId}`);
  const requestUrl = requestId ? getAppUrl(`/dashboard/requests/${requestId}`) : null;

  const acceptedDate = new Date(acceptedAt).toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const subject = '✅ Offert accepterad!';

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${winefeedEmailHeader()}

    <h2 style="color: #7A1B2D; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Offert accepterad!</h2>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Hej ${supplierName},</p>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;"><strong>${restaurantName}</strong> har accepterat din offert!</p>

    <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid #E8B4B8; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Offert:</strong> ${offerTitle || offerId.substring(0, 8)}</p>
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Restaurang:</strong> ${restaurantName}</p>
      <p style="margin: 0; color: #4b5563;"><strong>Accepterad:</strong> ${acceptedDate}</p>
    </div>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Offerten är nu låst och du kan inte längre redigera den. Kontakta restaurangen för att koordinera leverans.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${offerUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Visa accepterad offert
      </a>
    </div>

    ${requestUrl ? `
    <p style="font-size: 13px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Se original förfrågan:<br>
      <a href="${requestUrl}" style="color: #7A1B2D;">${requestUrl}</a>
    </p>
    ` : ''}

  ${winefeedEmailFooter()}
</body>
</html>
  `;

  const text = `
Offert accepterad!

Hej ${supplierName},

${restaurantName} har accepterat din offert!

Offert: ${offerTitle || offerId.substring(0, 8)}
Restaurang: ${restaurantName}
Accepterad: ${acceptedDate}

Offerten är nu låst och du kan inte längre redigera den. Kontakta restaurangen för att koordinera leverans.

Visa accepterad offert: ${offerUrl}

${requestUrl ? `Se original förfrågan: ${requestUrl}` : ''}

---
Winefeed - Din B2B-marknadsplats för vin
  `.trim();

  return { subject, html, text };
}

/**
 * Template: User Invite (sent to new restaurant/supplier user)
 */
export function userInviteEmail(params: InviteEmailParams): { subject: string; html: string; text: string } {
  const {
    recipientEmail,
    role,
    entityName,
    inviteToken,
    expiresAt
  } = params;

  const inviteUrl = getAppUrl(`/invite?token=${inviteToken}`);

  const expiryDate = new Date(expiresAt).toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const roleText = role === 'RESTAURANT' ? 'restaurang' : 'leverantör';
  const roleIcon = role === 'RESTAURANT' ? '🍽️' : '🚚';

  const subject = `${roleIcon} Välkommen till Winefeed - Din inbjudan`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${winefeedEmailHeader()}

    <h2 style="color: #7A1B2D; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Välkommen!</h2>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Hej,</p>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Du har blivit inbjuden att gå med i Winefeed som <strong>${roleText}</strong> för <strong>${entityName}</strong>.</p>

    <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid #E8B4B8; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Email:</strong> ${recipientEmail}</p>
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Roll:</strong> ${roleText === 'restaurang' ? 'Restaurang' : 'Leverantör'}</p>
      <p style="margin: 0; color: #4b5563;"><strong>Organisation:</strong> ${entityName}</p>
    </div>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Klicka på knappen nedan för att acceptera inbjudan och skapa ditt konto:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Acceptera inbjudan
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <strong>Viktigt:</strong> Denna inbjudan är giltig till <strong>${expiryDate}</strong>.<br>
      Om du inte accepterar inbjudan innan dess måste du be om en ny.
    </p>

    <p style="font-size: 13px; color: #6b7280;">
      Länken fungerar endast en gång. Om du har problem, kontakta den som bjöd in dig.
    </p>

  ${winefeedEmailFooter()}
</body>
</html>
  `;

  const text = `
Välkommen till Winefeed!

Hej,

Du har blivit inbjuden att gå med i Winefeed som ${roleText} för ${entityName}.

Email: ${recipientEmail}
Roll: ${roleText === 'restaurang' ? 'Restaurang' : 'Leverantör'}
Organisation: ${entityName}

Acceptera inbjudan genom att klicka på länken nedan:
${inviteUrl}

VIKTIGT: Denna inbjudan är giltig till ${expiryDate}.
Länken fungerar endast en gång.

---
Winefeed - Din B2B-marknadsplats för vin

Om du inte förväntade dig detta mejl, ignorera det bara.
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Order Status Updated (sent to restaurant)
 *
 * NO PRICE DATA - Only status updates for transparency
 */
export function orderStatusUpdatedEmail(params: OrderStatusUpdatedEmailParams): { subject: string; html: string; text: string } {
  const {
    restaurantName,
    orderId,
    newStatus,
    appUrl,
    deepLink
  } = params;

  // Use provided URL or construct from orderId
  const orderUrl = deepLink || appUrl || getAppUrl(`/orders/${orderId}`);

  // Map status to Swedish labels
  const statusLabels: Record<string, { label: string; color: string; icon: string }> = {
    'CONFIRMED': { label: 'Bekräftad', color: '#3b82f6', icon: '✓' },
    'IN_FULFILLMENT': { label: 'I leverans', color: '#f59e0b', icon: '📦' },
    'SHIPPED': { label: 'Skickad', color: '#8b5cf6', icon: '🚚' },
    'DELIVERED': { label: 'Levererad', color: '#10b981', icon: '✅' },
    'CANCELLED': { label: 'Avbruten', color: '#ef4444', icon: '❌' }
  };

  const statusInfo = statusLabels[newStatus] || { label: newStatus, color: '#6b7280', icon: '📋' };

  const subject = `${statusInfo.icon} Din order har uppdaterats: ${statusInfo.label}`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${winefeedEmailHeader()}

    <h2 style="color: #7A1B2D; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Orderstatus uppdaterad</h2>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Hej ${restaurantName || 'där'},</p>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Din order har uppdaterats till ny status:</p>

    <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid #E8B4B8; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Order ID:</strong> <span style="font-family: monospace; font-size: 12px;">${orderId.substring(0, 16)}...</span></p>
      <p style="margin: 0; color: #4b5563;"><strong>Ny status:</strong> <span style="color: #7A1B2D; font-weight: 600;">${statusInfo.icon} ${statusInfo.label}</span></p>
    </div>

    ${newStatus === 'DELIVERED' ? `
    <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 6px;">
      <p style="margin: 0; color: #065f46;"><strong>Leveransen är slutförd!</strong></p>
      <p style="margin: 10px 0 0 0; color: #065f46; font-size: 14px;">Vänligen verifiera att du mottagit varorna i gott skick.</p>
    </div>
    ` : ''}

    ${newStatus === 'SHIPPED' ? `
    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Din order är nu på väg! Du kommer få ett nytt meddelande när leveransen är slutförd.</p>
    ` : ''}

    ${newStatus === 'IN_FULFILLMENT' ? `
    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Din order bearbetas nu för leverans. Du kommer få ett meddelande när ordern skickas.</p>
    ` : ''}

    ${newStatus === 'CANCELLED' ? `
    <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin: 20px 0; border-radius: 6px;">
      <p style="margin: 0; color: #991b1b;"><strong>Ordern har avbrutits</strong></p>
      <p style="margin: 10px 0 0 0; color: #991b1b; font-size: 14px;">Kontakta leverantören om du har frågor.</p>
    </div>
    ` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${orderUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Visa order
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Se fullständig orderhistorik och detaljer:<br>
      <a href="${orderUrl}" style="color: #7A1B2D; word-break: break-all;">${orderUrl}</a>
    </p>

  ${winefeedEmailFooter()}
</body>
</html>
  `;

  const text = `
${statusInfo.icon} Din order har uppdaterats: ${statusInfo.label}

Hej ${restaurantName || 'där'},

Din order har uppdaterats till ny status:

Order ID: ${orderId.substring(0, 16)}...
Ny status: ${statusInfo.icon} ${statusInfo.label}

${newStatus === 'DELIVERED' ? '✅ Leveransen är slutförd! Vänligen verifiera att du mottagit varorna i gott skick.\n' : ''}
${newStatus === 'SHIPPED' ? 'Din order är nu på väg! Du kommer få ett nytt meddelande när leveransen är slutförd.\n' : ''}
${newStatus === 'IN_FULFILLMENT' ? 'Din order bearbetas nu för leverans. Du kommer få ett meddelande när ordern skickas.\n' : ''}
${newStatus === 'CANCELLED' ? '❌ Ordern har avbrutits. Kontakta leverantören om du har frågor.\n' : ''}

Visa order: ${orderUrl}

---
Winefeed - Din B2B-marknadsplats för vin
  `.trim();

  return { subject, html, text };
}

/**
 * Template: New Quote Request (sent to supplier)
 */
export function newQuoteRequestEmail(params: NewQuoteRequestEmailParams): { subject: string; html: string; text: string } {
  const {
    supplierName,
    restaurantName,
    requestId,
    fritext,
    antalFlaskor,
    budgetPerFlaska,
    leveransOrt,
    expiresAt,
    wineCount,
    hasProvorder,
    provorderFeeTotal
  } = params;

  const requestUrl = getAppUrl(`/supplier/requests/${requestId}`);

  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : null;

  const subject = `📬 Ny förfrågan från ${restaurantName}`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${winefeedEmailHeader()}

    <h2 style="color: #7A1B2D; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Ny förfrågan!</h2>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Hej ${supplierName},</p>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;"><strong>${restaurantName}</strong> har skickat en förfrågan som matchar din katalog.</p>

    <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid #E8B4B8; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Förfrågan:</strong> ${fritext}</p>
      ${wineCount ? `<p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Antal viner:</strong> ${wineCount} st</p>` : ''}
      ${antalFlaskor ? `<p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Antal flaskor:</strong> ${antalFlaskor}</p>` : ''}
      ${budgetPerFlaska ? `<p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Budget:</strong> ${budgetPerFlaska} kr/flaska</p>` : ''}
      ${leveransOrt ? `<p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Leveransort:</strong> ${leveransOrt}</p>` : ''}
    </div>

    ${hasProvorder ? `
    <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 6px;">
      <p style="margin: 0; color: #065f46;"><strong>Provorder accepterad</strong></p>
      <p style="margin: 10px 0 0 0; color: #065f46; font-size: 14px;">Kunden godkänner extra avgift på ${provorderFeeTotal} kr för småorder.</p>
    </div>
    ` : ''}

    ${expiryDate ? `
    <p style="color: #7A1B2D; font-weight: 500;">Svara senast: ${expiryDate}</p>
    ` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${requestUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Visa förfrågan & skicka offert
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Gå direkt till din leverantörsportal:<br>
      <a href="${getAppUrl('/supplier/requests')}" style="color: #7A1B2D;">Se alla förfrågningar</a>
    </p>

  ${winefeedEmailFooter()}
</body>
</html>
  `;

  const text = `
Ny förfrågan från ${restaurantName}

Hej ${supplierName}!

${restaurantName} har skickat en förfrågan som matchar din katalog.

Förfrågan: ${fritext}
${wineCount ? `Antal viner: ${wineCount} st` : ''}
${antalFlaskor ? `Antal flaskor: ${antalFlaskor}` : ''}
${budgetPerFlaska ? `Budget: ${budgetPerFlaska} kr/flaska` : ''}
${leveransOrt ? `Leveransort: ${leveransOrt}` : ''}

${hasProvorder ? `✅ PROVORDER ACCEPTERAD - Kunden godkänner extra avgift på ${provorderFeeTotal} kr för småorder.\n` : ''}
${expiryDate ? `⏰ Svara senast: ${expiryDate}` : ''}

Visa förfrågan och skicka offert: ${requestUrl}

---
Winefeed - Din B2B-marknadsplats för vin
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Order Confirmation (sent to both restaurant and supplier)
 */
/**
 * Template: Access Magic Link (sent to consumer for login)
 */
export interface AccessMagicLinkEmailParams {
  name: string | null;
  loginUrl: string;
}

export function accessMagicLinkEmail(params: AccessMagicLinkEmailParams): { subject: string; html: string; text: string } {
  const { name, loginUrl } = params;
  const greeting = name ? `Hej ${name}` : 'Hej';

  const subject = 'Din inloggningslänk till Vinkoll Access';

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A44 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Vinkoll Access</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Hitta ditt drömvin via Vinkoll</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${greeting},</p>

    <p>Klicka på knappen nedan för att logga in på Vinkoll Access. Länken är giltig i 30 minuter.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" style="display: inline-block; background: #722F37; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Logga in
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Om du inte begärde denna länk, ignorera detta mail.<br>
      Länken fungerar bara en gång.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Vinkoll Access - Hitta ditt nästa favoritvin</p>
  </div>
</body>
</html>
  `;

  const text = `
${greeting},

Klicka på länken nedan för att logga in på Vinkoll Access.
Länken är giltig i 30 minuter och fungerar bara en gång.

Logga in: ${loginUrl}

Om du inte begärde denna länk, ignorera detta mail.

---
Vinkoll Access - Hitta ditt nästa favoritvin
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Access Request Confirmation (sent to consumer after request)
 */
export interface AccessRequestConfirmationEmailParams {
  name: string | null;
  wineName: string;
  importerName: string;
  quantity: number;
}

export function accessRequestConfirmationEmail(params: AccessRequestConfirmationEmailParams): { subject: string; html: string; text: string } {
  const { name, wineName, importerName, quantity } = params;
  const greeting = name ? `Hej ${name}` : 'Hej';

  const subject = 'Din förfrågan har skickats';

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A44 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Vinkoll Access</h1>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${greeting},</p>

    <p>Din förfrågan har registrerats! Importören kommer att kontakta dig.</p>

    <div style="background: #f9fafb; border-left: 4px solid #722F37; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Vin:</strong> ${wineName}</p>
      <p style="margin: 0 0 10px 0;"><strong>Importör:</strong> ${importerName}</p>
      <p style="margin: 0;"><strong>Antal:</strong> ${quantity} flaskor</p>
    </div>

    <p style="font-size: 14px; color: #6b7280;">
      Förfrågan är giltig i 14 dagar. Du kan se status under Mina sidor.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Vinkoll Access - Hitta ditt nästa favoritvin</p>
  </div>
</body>
</html>
  `;

  const text = `
${greeting},

Din förfrågan har registrerats! Importören kommer att kontakta dig.

Vin: ${wineName}
Importör: ${importerName}
Antal: ${quantity} flaskor

Förfrågan är giltig i 14 dagar. Du kan se status under Mina sidor.

---
Vinkoll Access - Hitta ditt nästa favoritvin
  `.trim();

  return { subject, html, text };
}

// ============================================================================
// VINKOLL ACCESS — Importer Order Confirmation Email
// ============================================================================

export interface ImporterConfirmEmailParams {
  importerContactName: string | null;
  wineName: string;
  vintage: number | null;
  referenceCode: string;
  quantity: number;
  priceSek: number | null;
  consumerMessage: string | null;
  confirmUrl: string;
}

export function renderImporterConfirmEmail(params: ImporterConfirmEmailParams): { subject: string; html: string; text: string } {
  const {
    importerContactName,
    wineName,
    vintage,
    referenceCode,
    quantity,
    priceSek,
    consumerMessage,
    confirmUrl,
  } = params;

  const greeting = importerContactName ? `Hej ${importerContactName}` : 'Hej';
  const vintageStr = vintage ? ` ${vintage}` : '';
  const subject = `Bekräfta mottagen beställning \u2014 ${referenceCode}`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A44 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 2px;">VINKOLL</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Bekräfta mottagen beställning</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${greeting},</p>

    <p>En kund har gått vidare med sin beställning via Vinkoll. Vi ber er bekräfta att ni har mottagit beställningen.</p>

    <div style="background: #f9fafb; border-left: 4px solid #722F37; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Referenskod:</strong> ${referenceCode}</p>
      <p style="margin: 0 0 8px 0;"><strong>Vin:</strong> ${wineName}${vintageStr}</p>
      <p style="margin: 0 0 8px 0;"><strong>Antal:</strong> ${quantity} flaskor</p>
      ${priceSek ? `<p style="margin: 0 0 8px 0;"><strong>Pris:</strong> ${priceSek} kr/fl</p>` : ''}
      ${consumerMessage ? `<p style="margin: 8px 0 0 0; padding-top: 8px; border-top: 1px solid #e5e7eb;"><strong>Kundmeddelande:</strong> ${consumerMessage}</p>` : ''}
    </div>

    <p>Klicka på knappen nedan för att bekräfta att ni mottagit beställningen.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${confirmUrl}" style="display: inline-block; background: #722F37; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Bekräfta beställning
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Länken är giltig i 7 dagar. Om ni har frågor, kontakta oss på hej@vinkoll.se.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Vinkoll - Hitta ditt nästa favoritvin</p>
  </div>
</body>
</html>
  `;

  const text = `
${greeting},

En kund har gått vidare med sin beställning via Vinkoll. Vi ber er bekräfta att ni har mottagit beställningen.

Referenskod: ${referenceCode}
Vin: ${wineName}${vintageStr}
Antal: ${quantity} flaskor
${priceSek ? `Pris: ${priceSek} kr/fl` : ''}
${consumerMessage ? `Kundmeddelande: ${consumerMessage}` : ''}

Bekräfta beställning: ${confirmUrl}

Länken är giltig i 7 dagar.

---
Vinkoll - Hitta ditt nästa favoritvin
  `.trim();

  return { subject, html, text };
}

// ============================================================================
// VINKOLL ACCESS — Consumer Order Confirmed Email (handoff)
// ============================================================================

export interface ConsumerOrderConfirmedEmailParams {
  consumerName: string | null;
  wineName: string;
  vintage: number | null;
  referenceCode: string;
  quantity: number;
  priceSek: number | null;
}

export function renderConsumerOrderConfirmedEmail(params: ConsumerOrderConfirmedEmailParams): { subject: string; html: string; text: string } {
  const { consumerName, wineName, vintage, referenceCode, quantity, priceSek } = params;
  const greeting = consumerName ? `Hej ${consumerName}` : 'Hej';
  const vintageStr = vintage && !wineName.includes(String(vintage)) ? ` ${vintage}` : '';
  const subject = `Beställning bekräftad — ${referenceCode}`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A44 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 2px;">VINKOLL</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 20px; font-weight: 500;">Beställningen är bekräftad!</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${greeting},</p>

    <p>Importören har bekräftat att de mottagit din beställning av <strong>${wineName}${vintageStr}</strong> med referenskod <strong>${referenceCode}</strong>.</p>

    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Vin:</strong> ${wineName}${vintageStr}</p>
      <p style="margin: 0 0 8px 0;"><strong>Antal:</strong> ${quantity} flaskor</p>
      ${priceSek ? `<p style="margin: 0 0 8px 0;"><strong>Pris:</strong> ${priceSek} kr/fl</p>` : ''}
      <p style="margin: 0;"><strong>Referenskod:</strong> ${referenceCode}</p>
    </div>

    <h3 style="color: #722F37; margin-top: 25px; font-size: 16px;">Vad händer nu?</h3>
    <p style="color: #4b5563; font-size: 14px;">
      Från och med nu hanteras din beställning av <strong>Systembolaget</strong> och importören. Vinkoll är inte längre inblandad i processen och hanterar inga betalningar.
    </p>

    <ol style="color: #4b5563; padding-left: 20px; font-size: 14px;">
      <li style="margin-bottom: 8px;">Systembolaget skickar dig en <strong>offert</strong> baserad på importörens uppgifter.</li>
      <li style="margin-bottom: 8px;"><strong>Acceptera offerten</strong> via mail eller på <a href="https://www.systembolaget.se" style="color: #722F37;">Mina Sidor</a> på systembolaget.se.</li>
      <li style="margin-bottom: 8px;"><strong>Betalning</strong> sker enligt Systembolagets vanliga villkor.</li>
      <li style="margin-bottom: 8px;">Du får <strong>meddelande</strong> när vinet finns att hämta i din butik.</li>
    </ol>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px 15px; margin: 20px 0; border-radius: 6px; font-size: 13px; color: #6b7280;">
      <strong>Kontakt vid frågor om leverans eller betalning:</strong><br>
      Kontakta Systembolagets kundservice eller importören direkt. Vinkoll har inte tillgång till status på beställningar efter detta steg.
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">Tack för att du använde Vinkoll! Vi hoppas du hittar fler viner hos oss.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://vinkoll.se" style="display: inline-block; background: #722F37; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Utforska fler viner
      </a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Vinkoll - Hitta ditt nästa favoritvin</p>
  </div>
</body>
</html>
  `;

  const text = `
${greeting},

Importören har bekräftat att de mottagit din beställning av ${wineName}${vintageStr} med referenskod ${referenceCode}.

Vin: ${wineName}${vintageStr}
Antal: ${quantity} flaskor
${priceSek ? `Pris: ${priceSek} kr/fl` : ''}
Referenskod: ${referenceCode}

VAD HÄNDER NU?

Från och med nu hanteras din beställning av Systembolaget och importören. Vinkoll är inte längre inblandad i processen och hanterar inga betalningar.

1. Systembolaget skickar dig en offert baserad på importörens uppgifter.
2. Acceptera offerten via mail eller på Mina Sidor på systembolaget.se.
3. Betalning sker enligt Systembolagets vanliga villkor.
4. Du får meddelande när vinet finns att hämta i din butik.

Vid frågor om leverans eller betalning: kontakta Systembolagets kundservice eller importören direkt. Vinkoll har inte tillgång till status på beställningar efter detta steg.

Tack för att du använde Vinkoll!

Utforska fler viner: https://vinkoll.se

---
Vinkoll - Hitta ditt nästa favoritvin
  `.trim();

  return { subject, html, text };
}

// ============================================================================
// VINKOLL ACCESS — Mediation Engine Email Templates
// ============================================================================

export interface ImporterForwardEmailParams {
  importerContactName: string | null;
  wineName: string;
  wineType: string;
  vintage: number | null;
  grape: string | null;
  region: string | null;
  country: string | null;
  quantity: number;
  priceSek: number | null;
  consumerMessage: string | null; // already PII-sanitized
  respondUrl: string;
}

export function renderImporterForwardEmail(params: ImporterForwardEmailParams): { subject: string; html: string; text: string } {
  const {
    importerContactName,
    wineName,
    wineType,
    vintage,
    grape,
    region,
    country,
    quantity,
    priceSek,
    consumerMessage,
    respondUrl,
  } = params;

  const greeting = importerContactName ? `Hej ${importerContactName}` : 'Hej';
  const vintageStr = vintage ? ` ${vintage}` : '';
  const subject = `Ny förfrågan via Vinkoll: ${wineName}${vintageStr}`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A44 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 2px;">VINKOLL</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Ny vinförfrågan</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${greeting},</p>

    <p>En kund har visat intresse för ett vin i ert sortiment via Vinkoll. Vi skulle uppskatta om ni kan svara på förfrågan.</p>

    <div style="background: #f9fafb; border-left: 4px solid #722F37; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Vin:</strong> ${wineName}${vintageStr}</p>
      <p style="margin: 0 0 8px 0;"><strong>Typ:</strong> ${wineType}</p>
      ${grape ? `<p style="margin: 0 0 8px 0;"><strong>Druva:</strong> ${grape}</p>` : ''}
      ${region ? `<p style="margin: 0 0 8px 0;"><strong>Region:</strong> ${region}${country ? ', ' + country : ''}</p>` : ''}
      <p style="margin: 0 0 8px 0;"><strong>Önskat antal:</strong> ${quantity} flaskor</p>
      ${priceSek ? `<p style="margin: 0 0 8px 0;"><strong>Angivet pris:</strong> ${priceSek} kr/fl</p>` : ''}
      ${consumerMessage ? `<p style="margin: 8px 0 0 0; padding-top: 8px; border-top: 1px solid #e5e7eb;"><strong>Meddelande:</strong> ${consumerMessage}</p>` : ''}
    </div>

    <p>Klicka på knappen nedan för att svara. Det tar bara en minut.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${respondUrl}" style="display: inline-block; background: #722F37; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Svara på förfrågan
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Länken är giltig i 7 dagar. Om ni har frågor, kontakta oss på hej@vinkoll.se.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Vinkoll - Hitta ditt nästa favoritvin</p>
  </div>
</body>
</html>
  `;

  const text = `
${greeting},

En kund har visat intresse för ett vin i ert sortiment via Vinkoll.

Vin: ${wineName}${vintageStr}
Typ: ${wineType}
${grape ? `Druva: ${grape}` : ''}
${region ? `Region: ${region}${country ? ', ' + country : ''}` : ''}
Önskat antal: ${quantity} flaskor
${priceSek ? `Angivet pris: ${priceSek} kr/fl` : ''}
${consumerMessage ? `Meddelande: ${consumerMessage}` : ''}

Svara på förfrågan: ${respondUrl}

Länken är giltig i 7 dagar.

---
Vinkoll - Hitta ditt nästa favoritvin
  `.trim();

  return { subject, html, text };
}

export interface ConsumerResponseEmailParams {
  consumerName: string | null;
  wineName: string;
  vintage: number | null;
  accepted: boolean;
  priceSek: number | null;
  quantity: number | null;
  deliveryDays: number | null;
  importerNote: string | null;
  browseUrl: string;
  referenceCode: string;
}

export function renderConsumerResponseEmail(params: ConsumerResponseEmailParams): { subject: string; html: string; text: string } {
  const {
    consumerName,
    wineName,
    vintage,
    accepted,
    priceSek,
    quantity,
    deliveryDays,
    importerNote,
    browseUrl,
    referenceCode,
  } = params;

  const greeting = consumerName ? `Hej ${consumerName}` : 'Hej';
  const vintageStr = vintage ? ` ${vintage}` : '';

  if (accepted) {
    const subject = `Goda nyheter! ${wineName}${vintageStr} kan levereras`;

    const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A44 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <div style="display: inline-block; background: white; border-radius: 16px; padding: 12px 28px; margin-bottom: 14px;">
      <img src="${browseUrl.split('/').slice(0, 3).join('/')}/vinkoll-logo.png" alt="Vinkoll" style="height: 50px; display: block;" />
    </div>
    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 20px; font-weight: 500;">Goda nyheter om din vinförfrågan!</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${greeting},</p>

    <p>Vi har fått svar på din förfrågan om <strong>${wineName}${vintageStr}</strong> — och importören kan leverera!</p>

    <div style="background: #fdf2f3; border-left: 4px solid #722F37; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Vin:</strong> ${wineName}${vintageStr}</p>
      ${priceSek ? `<p style="margin: 0 0 8px 0;"><strong>Pris:</strong> ${priceSek} kr/flaska</p>` : ''}
      ${quantity ? `<p style="margin: 0 0 8px 0;"><strong>Antal tillgängligt:</strong> ${quantity} flaskor</p>` : ''}
      ${deliveryDays ? `<p style="margin: 0 0 8px 0;"><strong>Leveranstid:</strong> ca ${deliveryDays} dagar</p>` : ''}
      ${importerNote ? `<p style="margin: 8px 0 0 0; padding-top: 8px; border-top: 1px solid #f5c6cb;"><strong>Kommentar:</strong> ${importerNote}</p>` : ''}
    </div>

    <div style="background: #fefce8; border: 1px solid #fde68a; padding: 15px; margin: 20px 0; border-radius: 6px; text-align: center;">
      <p style="margin: 0 0 5px 0; font-size: 12px; color: #92400e; text-transform: uppercase; letter-spacing: 1px;">Din referenskod</p>
      <p style="margin: 0; font-size: 24px; font-weight: 700; color: #78350f; letter-spacing: 2px;">${referenceCode}</p>
      <p style="margin: 5px 0 0 0; font-size: 12px; color: #92400e;">Ange denna kod vid beställning</p>
    </div>

    <h3 style="color: #722F37; margin-top: 25px; font-size: 16px;">Så här beställer du via privatimport</h3>
    <p style="color: #4b5563; font-size: 14px; margin-bottom: 15px;">
      Privatimport innebär att du beställer via Systembolagets webbplats och hämtar ut vinet i din närmaste Systembolagsbutik. Så här gör du:
    </p>
    <ol style="color: #4b5563; padding-left: 20px; font-size: 14px;">
      <li style="margin-bottom: 8px;"><strong>Logga in</strong> på <a href="https://www.systembolaget.se" style="color: #722F37;">systembolaget.se</a> (skapa konto om du inte har ett).</li>
      <li style="margin-bottom: 8px;">Gå direkt till <a href="https://www.systembolaget.se/bestalla-och-handla/privatimport/forfragan/" style="color: #722F37; font-weight: 600;">Systembolagets privatimport-formulär</a> och registrera en ny förfrågan.</li>
      <li style="margin-bottom: 8px;"><strong>Välj säljare/leverantör</strong> — den importör vi kopplat dig till.</li>
      <li style="margin-bottom: 8px;"><strong>Fyll i dryckesinformation:</strong> vinnamn, typ, årgång, volym (750 ml) och antal flaskor.</li>
      <li style="margin-bottom: 8px;"><strong>Ange referenskod ${referenceCode}</strong> i kommentarsfältet så importören vet vilken order det gäller.</li>
      <li style="margin-bottom: 8px;"><strong>Skicka förfrågan.</strong> Systembolaget skickar den vidare till importören.</li>
      <li style="margin-bottom: 8px;"><strong>Acceptera offerten</strong> som du får via mail och på Mina Sidor.</li>
      <li style="margin-bottom: 8px;"><strong>Hämta i butik</strong> — du får meddelande när vinet finns att hämta.</li>
    </ol>

    <div style="background: #fdf2f3; border: 1px solid #f5c6cb; padding: 12px 15px; margin: 20px 0; border-radius: 6px; font-size: 13px; color: #722F37;">
      <strong>Tips:</strong> Ange alltid referenskod <strong>${referenceCode}</strong> i kommentarsfältet på Systembolaget. Det säkerställer att importören kopplar din beställning till rätt erbjudande.
    </div>

    <p style="color: #6b7280; font-size: 13px;">Har du frågor? Svara på detta mail så hjälper vi dig.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://www.systembolaget.se/bestalla-och-handla/privatimport/forfragan/" style="display: inline-block; background: #722F37; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Registrera privatimport
      </a>
    </div>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${browseUrl}" style="color: #722F37; font-size: 14px; text-decoration: underline;">
        Utforska fler viner på Vinkoll
      </a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Vinkoll - Hitta ditt nästa favoritvin</p>
  </div>
</body>
</html>
    `;

    const text = `
${greeting},

Vi har fått svar på din förfrågan om ${wineName}${vintageStr} — och importören kan leverera!

Vin: ${wineName}${vintageStr}
${priceSek ? `Pris: ${priceSek} kr/flaska` : ''}
${quantity ? `Antal tillgängligt: ${quantity} flaskor` : ''}
${deliveryDays ? `Leveranstid: ca ${deliveryDays} dagar` : ''}
${importerNote ? `Kommentar: ${importerNote}` : ''}

DIN REFERENSKOD: ${referenceCode}

SÅ HÄR BESTÄLLER DU VIA PRIVATIMPORT:

Privatimport innebär att du beställer via Systembolagets webbplats och hämtar ut vinet i din närmaste butik.

1. Logga in på systembolaget.se (skapa konto om du inte har ett).
2. Gå till privatimport-formuläret: https://www.systembolaget.se/bestalla-och-handla/privatimport/forfragan/
3. Välj säljare/leverantör — den importör vi kopplat dig till.
4. Fyll i dryckesinformation: vinnamn, typ, årgång, volym (750 ml) och antal.
5. Ange referenskod ${referenceCode} i kommentarsfältet.
6. Skicka förfrågan. Systembolaget skickar den till importören.
7. Acceptera offerten du får via mail och på Mina Sidor.
8. Hämta i butik — du får meddelande när vinet finns att hämta.

TIPS: Ange alltid referenskod ${referenceCode} i kommentarsfältet på Systembolaget. Det säkerställer att importören kopplar din beställning till rätt erbjudande.

Har du frågor? Svara på detta mail så hjälper vi dig.

Utforska fler viner: ${browseUrl}

---
Vinkoll - Hitta ditt nästa favoritvin
    `.trim();

    return { subject, html, text };
  }

  // Declined
  const subject = `Uppdatering om ${wineName}${vintageStr}`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A44 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 2px;">VINKOLL</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Uppdatering om din förfrågan</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${greeting},</p>

    <p>Tyvärr kan importören inte leverera <strong>${wineName}${vintageStr}</strong> just nu.</p>

    ${importerNote ? `
    <div style="background: #f9fafb; border-left: 4px solid #d1d5db; padding: 15px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Anledning:</strong> ${importerNote}</p>
    </div>
    ` : ''}

    <p>Men ge inte upp — vi har fler viner som kan passa dig!</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${browseUrl}" style="display: inline-block; background: #722F37; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Utforska fler viner
      </a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Vinkoll - Hitta ditt nästa favoritvin</p>
  </div>
</body>
</html>
  `;

  const text = `
${greeting},

Tyvärr kan importören inte leverera ${wineName}${vintageStr} just nu.

${importerNote ? `Anledning: ${importerNote}` : ''}

Men ge inte upp — vi har fler viner som kan passa dig!

Utforska fler viner: ${browseUrl}

---
Vinkoll - Hitta ditt nästa favoritvin
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Order Confirmation (sent to both restaurant and supplier)
 */
export function orderConfirmationEmail(params: OrderConfirmationEmailParams): { subject: string; html: string; text: string } {
  const {
    recipientName,
    orderId,
    restaurantName,
    supplierName,
    totalBottles,
    totalValueSek,
    deliveryAddress,
    expectedDelivery,
    items
  } = params;

  const orderUrl = getAppUrl(`/orders/${orderId}`);
  const shortOrderId = orderId.substring(0, 8).toUpperCase();

  const subject = `✅ Order bekräftad #${shortOrderId}`;

  // Build items list HTML
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.wineName}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      ${item.priceSek ? `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.priceSek} kr</td>` : ''}
      ${item.provorder ? `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #059669;">+${item.provorderFee || 500} kr</td>` : (item.priceSek ? '<td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"></td>' : '')}
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${winefeedEmailHeader()}

    <h2 style="color: #7A1B2D; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Tack för din order!</h2>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Hej ${recipientName},</p>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Din order har bekräftats och leverantören har börjat behandla den.</p>

    <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid #E8B4B8; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Order:</strong> #${shortOrderId}</p>
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Restaurang:</strong> ${restaurantName}</p>
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Leverantör:</strong> ${supplierName}</p>
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Antal flaskor:</strong> ${totalBottles}</p>
      ${totalValueSek ? `<p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Totalt:</strong> ${totalValueSek.toLocaleString('sv-SE')} kr</p>` : ''}
      ${deliveryAddress ? `<p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Leveransadress:</strong> ${deliveryAddress}</p>` : ''}
      ${expectedDelivery ? `<p style="margin: 0; color: #4b5563;"><strong>Förväntad leverans:</strong> ${expectedDelivery}</p>` : ''}
    </div>

    ${items.length > 0 ? `
    <h3 style="color: #374151; margin-top: 25px;">Orderrader</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Vin</th>
          <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb;">Antal</th>
          ${items.some(i => i.priceSek) ? '<th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Pris</th>' : ''}
          ${items.some(i => i.provorder) ? '<th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Provorder</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    ` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${orderUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Visa order
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Du får ett nytt mail när ordern skickas.
    </p>

  ${winefeedEmailFooter()}
</body>
</html>
  `;

  // Build items list text
  const itemsText = items.map(item =>
    `- ${item.wineName}: ${item.quantity} fl${item.priceSek ? ` @ ${item.priceSek} kr` : ''}${item.provorder ? ` (+${item.provorderFee || 500} kr provorder)` : ''}`
  ).join('\n');

  const text = `
Order bekräftad #${shortOrderId}

Hej ${recipientName},

Din order har bekräftats och leverantören har börjat behandla den.

Order: #${shortOrderId}
Restaurang: ${restaurantName}
Leverantör: ${supplierName}
Antal flaskor: ${totalBottles}
${totalValueSek ? `Totalt: ${totalValueSek.toLocaleString('sv-SE')} kr` : ''}
${deliveryAddress ? `Leveransadress: ${deliveryAddress}` : ''}
${expectedDelivery ? `Förväntad leverans: ${expectedDelivery}` : ''}

${items.length > 0 ? `Orderrader:\n${itemsText}` : ''}

Visa order: ${orderUrl}

Du får ett nytt mail när ordern skickas.

---
Winefeed - Din B2B-marknadsplats för vin
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Offer Declined (sent to supplier)
 * PILOT-CRITICAL: Suppliers need to know when offers are rejected
 */
export function offerDeclinedEmail(params: OfferDeclinedEmailParams): { subject: string; html: string; text: string } {
  const {
    supplierName,
    restaurantName,
    offerId,
    requestTitle,
    declinedAt,
    reason
  } = params;

  const dashboardUrl = getAppUrl('/supplier/requests');

  const declinedDate = new Date(declinedAt).toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const subject = 'Offert avböjd';

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${winefeedEmailHeader()}

    <h2 style="color: #7A1B2D; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Offert avböjd</h2>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Hej ${supplierName},</p>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Vi vill informera dig om att <strong>${restaurantName}</strong> har avböjt din offert.</p>

    <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid #E8B4B8; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Förfrågan:</strong> ${requestTitle}</p>
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Restaurang:</strong> ${restaurantName}</p>
      <p style="margin: 0; color: #4b5563;"><strong>Avböjd:</strong> ${declinedDate}</p>
    </div>

    ${reason ? `
    <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; margin: 20px 0; border-radius: 6px;">
      <p style="margin: 0; color: #92400e;"><strong>Anledning:</strong> ${reason}</p>
    </div>
    ` : ''}

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Detta är helt normalt -- restauranger får ofta flera offerter och väljer den som passar bäst för deras behov. Vi hoppas att nästa affär går i lås!</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Se nya förfrågningar
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Tips: Snabba svar och konkurrenskraftiga priser ökar chansen att vinna affären.
    </p>

  ${winefeedEmailFooter()}
</body>
</html>
  `;

  const text = `
Offert avböjd

Hej ${supplierName},

Vi vill informera dig om att ${restaurantName} har avböjt din offert.

Förfrågan: ${requestTitle}
Restaurang: ${restaurantName}
Avböjd: ${declinedDate}

${reason ? `Anledning: ${reason}` : ''}

Detta är helt normalt – restauranger får ofta flera offerter och väljer den som passar bäst för deras behov. Vi hoppas att nästa affär går i lås!

Se nya förfrågningar: ${dashboardUrl}

Tips: Snabba svar och konkurrenskraftiga priser ökar chansen att vinna affären.

---
Winefeed - Din B2B-marknadsplats för vin
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Offer Pending Reminder (sent to restaurant)
 * PILOT-CRITICAL: Nudge restaurants to review offers waiting > 48h
 */
export function offerPendingReminderEmail(params: OfferPendingReminderEmailParams): { subject: string; html: string; text: string } {
  const {
    restaurantName,
    offerId,
    offerTitle,
    supplierName,
    hoursWaiting,
    linesCount
  } = params;

  const offerUrl = getAppUrl(`/dashboard/offers/${offerId}`);

  const daysWaiting = Math.floor(hoursWaiting / 24);
  const waitingText = daysWaiting >= 1
    ? `${daysWaiting} ${daysWaiting === 1 ? 'dag' : 'dagar'}`
    : `${hoursWaiting} timmar`;

  const subject = `Påminnelse: Offert från ${supplierName} väntar på ditt svar`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${winefeedEmailHeader()}

    <h2 style="color: #7A1B2D; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Påminnelse</h2>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Hej ${restaurantName},</p>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Du har en offert som har väntat på granskning i <strong>${waitingText}</strong>.</p>

    <div style="background: linear-gradient(135deg, rgba(232,180,184,0.15) 0%, rgba(232,223,196,0.15) 100%); border-left: 4px solid #E8B4B8; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Offert:</strong> ${offerTitle || 'Offert'}</p>
      <p style="margin: 0 0 10px 0; color: #4b5563;"><strong>Från:</strong> ${supplierName}</p>
      <p style="margin: 0; color: #4b5563;"><strong>Antal rader:</strong> ${linesCount} ${linesCount === 1 ? 'vin' : 'viner'}</p>
    </div>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Leverantörer uppskattar snabba svar. Granska offerten och acceptera eller avböj så att de kan planera sin verksamhet.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${offerUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Granska offert
      </a>
    </div>

    <p style="font-size: 13px; color: #6b7280; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Har du redan hanterat denna offert? Ignorera detta meddelande.
    </p>

  ${winefeedEmailFooter()}
</body>
</html>
  `;

  const text = `
Påminnelse: Offert väntar på ditt svar

Hej ${restaurantName},

Du har en offert som har väntat på granskning i ${waitingText}.

Offert: ${offerTitle || 'Offert'}
Från: ${supplierName}
Antal rader: ${linesCount} ${linesCount === 1 ? 'vin' : 'viner'}

Leverantörer uppskattar snabba svar. Granska offerten och acceptera eller avböj så att de kan planera sin verksamhet.

Granska offert: ${offerUrl}

Har du redan hanterat denna offert? Ignorera detta meddelande.

---
Winefeed - Din B2B-marknadsplats för vin
  `.trim();

  return { subject, html, text };
}

// ============================================================================
// VINKOLL ACCESS — Importer Reminder Email (cron: 5 days after forward)
// ============================================================================

export interface ImporterReminderEmailParams {
  importerContactName: string | null;
  wineName: string;
  wineType: string;
  vintage: number | null;
  quantity: number;
  respondUrl: string;
  daysSinceForward: number;
}

export function renderImporterReminderEmail(params: ImporterReminderEmailParams): { subject: string; html: string; text: string } {
  const {
    importerContactName,
    wineName,
    wineType,
    vintage,
    quantity,
    respondUrl,
    daysSinceForward,
  } = params;

  const greeting = importerContactName ? `Hej ${importerContactName}` : 'Hej';
  const vintageStr = vintage ? ` ${vintage}` : '';
  const subject = `Påminnelse: Förfrågan via Vinkoll väntar på ditt svar`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A44 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 2px;">VINKOLL</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Påminnelse om vinförfrågan</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>${greeting},</p>

    <p>Vi skickade en förfrågan till er för <strong>${daysSinceForward} dagar sedan</strong> och har ännu inte fått svar. En kund väntar på besked om:</p>

    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Vin:</strong> ${wineName}${vintageStr}</p>
      <p style="margin: 0 0 8px 0;"><strong>Typ:</strong> ${wineType}</p>
      <p style="margin: 0;"><strong>Önskat antal:</strong> ${quantity} flaskor</p>
    </div>

    <p>Om ni kan leverera eller inte — vi uppskattar ett svar oavsett. Det tar bara en minut.</p>

    <p style="color: #b45309; font-weight: 500;">Förfrågan stängs automatiskt om 2 dagar om inget svar inkommer.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${respondUrl}" style="display: inline-block; background: #722F37; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Svara på förfrågan
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Länken är giltig i 7 dagar. Om ni har frågor, kontakta oss på hej@vinkoll.se.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Vinkoll - Hitta ditt nästa favoritvin</p>
  </div>
</body>
</html>
  `;

  const text = `
${greeting},

Vi skickade en förfrågan till er för ${daysSinceForward} dagar sedan och har ännu inte fått svar.

Vin: ${wineName}${vintageStr}
Typ: ${wineType}
Önskat antal: ${quantity} flaskor

Om ni kan leverera eller inte — vi uppskattar ett svar oavsett. Det tar bara en minut.

Förfrågan stängs automatiskt om 2 dagar om inget svar inkommer.

Svara på förfrågan: ${respondUrl}

Länken är giltig i 7 dagar.

---
Vinkoll - Hitta ditt nästa favoritvin
  `.trim();

  return { subject, html, text };
}

// ============================================================================
// VINKOLL ACCESS — Admin Daily Summary Email (cron)
// ============================================================================

export interface AdminDailySummaryEmailParams {
  newCount: number;
  waitingCount: number;
  respondedCount: number;
  remindedCount: number;
  expiredCount: number;
  adminUrl: string;
}

export function renderAdminDailySummaryEmail(params: AdminDailySummaryEmailParams): { subject: string; html: string; text: string } {
  const {
    newCount,
    waitingCount,
    respondedCount,
    remindedCount,
    expiredCount,
    adminUrl,
  } = params;

  const today = new Date().toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `Vinkoll Access — Daglig sammanfattning ${today}`;

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #722F37 0%, #8B3A44 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 2px;">VINKOLL</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Daglig sammanfattning</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>Hej,</p>

    <p>Här är dagens översikt för Vinkoll Access:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; font-weight: 600;">Nya förfrågningar (ej vidarebefordrade)</td>
        <td style="padding: 12px 8px; text-align: right; font-size: 20px; font-weight: 700; color: ${newCount > 0 ? '#722F37' : '#9ca3af'};">${newCount}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; font-weight: 600;">Väntar på importörsvar</td>
        <td style="padding: 12px 8px; text-align: right; font-size: 20px; font-weight: 700; color: ${waitingCount > 0 ? '#f59e0b' : '#9ca3af'};">${waitingCount}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; font-weight: 600;">Besvarade (konsument ej meddelad)</td>
        <td style="padding: 12px 8px; text-align: right; font-size: 20px; font-weight: 700; color: ${respondedCount > 0 ? '#10b981' : '#9ca3af'};">${respondedCount}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; font-weight: 600;">Påminda importörer idag</td>
        <td style="padding: 12px 8px; text-align: right; font-size: 20px; font-weight: 700; color: ${remindedCount > 0 ? '#f59e0b' : '#9ca3af'};">${remindedCount}</td>
      </tr>
      <tr>
        <td style="padding: 12px 8px; font-weight: 600;">Utgångna idag</td>
        <td style="padding: 12px 8px; text-align: right; font-size: 20px; font-weight: 700; color: ${expiredCount > 0 ? '#ef4444' : '#9ca3af'};">${expiredCount}</td>
      </tr>
    </table>

    ${(newCount > 0 || respondedCount > 0) ? `
    <div style="background: #fdf2f3; border: 1px solid #f5c6cb; padding: 12px 15px; margin: 20px 0; border-radius: 6px; font-size: 14px; color: #722F37;">
      <strong>Kräver åtgärd:</strong> ${newCount > 0 ? `${newCount} nya förfrågningar att vidarebefordra` : ''}${newCount > 0 && respondedCount > 0 ? ' + ' : ''}${respondedCount > 0 ? `${respondedCount} besvarade att meddela konsument` : ''}
    </div>
    ` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${adminUrl}" style="display: inline-block; background: #722F37; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Öppna admin
      </a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Vinkoll - Hitta ditt nästa favoritvin</p>
  </div>
</body>
</html>
  `;

  const text = `
Vinkoll Access — Daglig sammanfattning ${today}

Nya förfrågningar (ej vidarebefordrade): ${newCount}
Väntar på importörsvar: ${waitingCount}
Besvarade (konsument ej meddelad): ${respondedCount}
Påminda importörer idag: ${remindedCount}
Utgångna idag: ${expiredCount}

${(newCount > 0 || respondedCount > 0) ? `KRÄVER ÅTGÄRD: ${newCount > 0 ? `${newCount} nya förfrågningar att vidarebefordra` : ''}${newCount > 0 && respondedCount > 0 ? ' + ' : ''}${respondedCount > 0 ? `${respondedCount} besvarade att meddela konsument` : ''}` : ''}

Öppna admin: ${adminUrl}

---
Vinkoll - Hitta ditt nästa favoritvin
  `.trim();

  return { subject, html, text };
}

// ============================================================================
// Wine Recommendation Email (Sommelier Outreach)
// ============================================================================

export interface WineRecommendationEmailParams {
  restaurantName: string;
  dishSummary: string;
  isExistingCustomer?: boolean;  // true = registered restaurant, false/undefined = cold lead
  wines: Array<{
    name: string;
    producer: string;
    grape: string | null;
    vintage: number | null;
    priceExVat: number;
    reason: string;
    matchedDishes?: string[];
  }>;
}

export function renderWineRecommendationEmail(params: WineRecommendationEmailParams): { subject: string; html: string; text: string } {
  const { restaurantName, dishSummary, wines, isExistingCustomer } = params;

  const subject = isExistingCustomer
    ? `Nya vinförslag till ${restaurantName} — baserat på er meny`
    : `Vinförslag till ${restaurantName} — baserat på er meny`;

  const wineCardsHtml = wines.map(w => {
    const dishTagsHtml = (w.matchedDishes && w.matchedDishes.length > 0)
      ? `<div style="margin-top: 10px;">${w.matchedDishes.map(d =>
          `<span style="display: inline-block; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 4px; padding: 2px 8px; font-size: 11px; margin-right: 6px; margin-bottom: 4px;">${d}</span>`
        ).join('')}</div>`
      : '';
    return `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="font-weight: 600; font-size: 15px; color: #1f2937;">${w.name}${w.vintage ? ` ${w.vintage}` : ''}</div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${w.producer}${w.grape ? ` · ${w.grape}` : ''}</div>
      <div style="font-size: 13px; color: #7A1B2D; font-weight: 500; margin-top: 6px;">${Math.round(w.priceExVat / 100)} kr ex moms</div>
      ${dishTagsHtml}
      <div style="font-size: 13px; color: #4b5563; margin-top: 8px; line-height: 1.5; font-style: italic;">${w.reason}</div>
    </div>`;
  }).join('');

  const wineListText = wines.map(w => {
    const dishLine = (w.matchedDishes && w.matchedDishes.length > 0)
      ? `\n  Passar till: ${w.matchedDishes.join(', ')}`
      : '';
    return `- ${w.name}${w.vintage ? ` ${w.vintage}` : ''} (${w.producer}${w.grape ? `, ${w.grape}` : ''}) — ${Math.round(w.priceExVat / 100)} kr ex moms${dishLine}\n  ${w.reason}`;
  }).join('\n\n');

  const dashboardUrl = getAppUrl('/dashboard');

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${winefeedEmailHeader()}

    <h2 style="color: #7A1B2D; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Vinförslag till er meny</h2>

    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Hej ${restaurantName},</p>

    ${isExistingCustomer ? `
    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Vi har tittat på er meny (${dishSummary}) och hittat nya viner som kan passa:</p>
    ` : `
    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Vi på Winefeed hjälper restauranger hitta rätt vin från Sveriges importörer. Vi har analyserat er meny (${dishSummary}) och valt ut viner som matchar era rätter:</p>
    `}

    <div style="margin: 24px 0;">
      ${wineCardsHtml}
    </div>

    ${isExistingCustomer ? `
    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Alla viner finns i er katalog — klicka nedan för att se detaljer och beställa direkt.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Se vinerna i katalogen
      </a>
    </div>
    ` : `
    <p style="color: #4b5563; line-height: 1.7; font-size: 15px;">Winefeed samlar viner från Sveriges importörer på ett ställe — kostnadsfritt för restauranger. Sök, jämför och skicka förfrågningar direkt till leverantörerna.</p>

    <!-- Services section -->
    <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 28px;">
      <h3 style="color: #7A1B2D; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Så fungerar Winefeed</h3>
      <table style="width: 100%; border-spacing: 0;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width: 40px; vertical-align: top; padding: 8px 12px 8px 0;">
            <div style="width: 32px; height: 32px; background: #fef2f2; border-radius: 50%; text-align: center; line-height: 32px; font-size: 16px;">&#x1F50D;</div>
          </td>
          <td style="vertical-align: top; padding: 8px 0;">
            <div style="font-size: 14px; font-weight: 600; color: #1f2937;">Sök och jämför</div>
            <div style="font-size: 13px; color: #6b7280; line-height: 1.5;">Viner från flera importörer — filtrerade efter druva, region, pris och stil.</div>
          </td>
        </tr>
        <tr>
          <td style="width: 40px; vertical-align: top; padding: 8px 12px 8px 0;">
            <div style="width: 32px; height: 32px; background: #f0fdf4; border-radius: 50%; text-align: center; line-height: 32px; font-size: 16px;">&#x1F4E9;</div>
          </td>
          <td style="vertical-align: top; padding: 8px 0;">
            <div style="font-size: 14px; font-weight: 600; color: #1f2937;">Skicka förfrågan direkt</div>
            <div style="font-size: 13px; color: #6b7280; line-height: 1.5;">Beskriv vad ni söker och få offerter från leverantörer inom 24h.</div>
          </td>
        </tr>
        <tr>
          <td style="width: 40px; vertical-align: top; padding: 8px 12px 8px 0;">
            <div style="width: 32px; height: 32px; background: #eff6ff; border-radius: 50%; text-align: center; line-height: 32px; font-size: 16px;">&#x1F4B0;</div>
          </td>
          <td style="vertical-align: top; padding: 8px 0;">
            <div style="font-size: 14px; font-weight: 600; color: #1f2937;">Gratis för restauranger</div>
            <div style="font-size: 13px; color: #6b7280; line-height: 1.5;">Inga avgifter, inga bindningar. Registrera er och börja utforska.</div>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${getAppUrl('/signup')}" style="display: inline-block; background: #7A1B2D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(122,27,45,0.25);">
        Skapa konto och se vinerna — gratis
      </a>
    </div>
    `}

  ${winefeedEmailFooter()}
</body>
</html>`;

  const text = isExistingCustomer
    ? `Nya vinförslag till ${restaurantName}

Hej ${restaurantName},

Vi har tittat på er meny (${dishSummary}) och hittat nya viner som kan passa:

${wineListText}

Se vinerna i katalogen: ${dashboardUrl}

---
Winefeed – Din B2B-marknadsplats för vin`.trim()
    : `Vinförslag till ${restaurantName}

Hej ${restaurantName},

Vi på Winefeed hjälper restauranger hitta rätt vin från Sveriges importörer. Vi har analyserat er meny (${dishSummary}) och valt ut viner som matchar era rätter:

${wineListText}

Winefeed samlar viner från Sveriges importörer på ett ställe — kostnadsfritt för restauranger. Sök, jämför och skicka förfrågningar direkt till leverantörerna.

Skapa konto och se vinerna (gratis): ${getAppUrl('/signup')}

---
Winefeed – Din B2B-marknadsplats för vin`.trim();

  return { subject, html, text };
}
