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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🍷 Winefeed</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Din vinmarknadsplats</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #667eea; margin-top: 0;">Ny offert mottagen!</h2>

    <p>Hej ${restaurantName},</p>

    <p>Du har fått en ny offert från <strong>${supplierName}</strong> på din förfrågan:</p>

    <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Förfrågan:</strong> ${requestTitle || 'Din förfrågan'}</p>
      <p style="margin: 0 0 10px 0;"><strong>Offert:</strong> ${offerTitle || 'Offert från ' + supplierName}</p>
      <p style="margin: 0;"><strong>Antal rader:</strong> ${linesCount} ${linesCount === 1 ? 'rad' : 'rader'}</p>
    </div>

    <p>Granska offerten och acceptera om den passar era behov.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${offerUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Visa offert
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Du kan också se alla offerter för din förfrågan här:<br>
      <a href="${requestUrl}" style="color: #667eea;">${requestUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Winefeed - Din B2B-marknadsplats för vin</p>
  </div>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Grattis!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Din offert har accepterats</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #10b981; margin-top: 0;">Offert accepterad!</h2>

    <p>Hej ${supplierName},</p>

    <p><strong>${restaurantName}</strong> har accepterat din offert!</p>

    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Offert:</strong> ${offerTitle || offerId.substring(0, 8)}</p>
      <p style="margin: 0 0 10px 0;"><strong>Restaurang:</strong> ${restaurantName}</p>
      <p style="margin: 0;"><strong>Accepterad:</strong> ${acceptedDate}</p>
    </div>

    <p>Offerten är nu låst och du kan inte längre redigera den. Kontakta restaurangen för att koordinera leverans.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${offerUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Visa accepterad offert
      </a>
    </div>

    ${requestUrl ? `
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Se original förfrågan:<br>
      <a href="${requestUrl}" style="color: #10b981;">${requestUrl}</a>
    </p>
    ` : ''}
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Winefeed - Din B2B-marknadsplats för vin</p>
  </div>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🍷 Winefeed</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">B2B-marknadsplats för vin</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #667eea; margin-top: 0;">${roleIcon} Välkommen!</h2>

    <p>Hej,</p>

    <p>Du har blivit inbjuden att gå med i Winefeed som <strong>${roleText}</strong> för <strong>${entityName}</strong>.</p>

    <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${recipientEmail}</p>
      <p style="margin: 0 0 10px 0;"><strong>Roll:</strong> ${roleText === 'restaurang' ? 'Restaurang' : 'Leverantör'}</p>
      <p style="margin: 0;"><strong>Organisation:</strong> ${entityName}</p>
    </div>

    <p>Klicka på knappen nedan för att acceptera inbjudan och skapa ditt konto:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Acceptera inbjudan
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <strong>Viktigt:</strong> Denna inbjudan är giltig till <strong>${expiryDate}</strong>.<br>
      Om du inte accepterar inbjudan innan dess måste du be om en ny.
    </p>

    <p style="font-size: 14px; color: #6b7280;">
      Länken fungerar endast en gång. Om du har problem, kontakta den som bjöd in dig.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Winefeed - Din B2B-marknadsplats för vin</p>
    <p style="margin: 5px 0 0 0;">Om du inte förväntade dig detta mejl, ignorera det bara.</p>
  </div>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, ${statusInfo.color} 0%, ${statusInfo.color}dd 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${statusInfo.icon} Order uppdaterad</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Status: ${statusInfo.label}</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: ${statusInfo.color}; margin-top: 0;">Orderstatus uppdaterad</h2>

    <p>Hej ${restaurantName || 'där'},</p>

    <p>Din order har uppdaterats till ny status:</p>

    <div style="background: #f9fafb; border-left: 4px solid ${statusInfo.color}; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Order ID:</strong> <span style="font-family: monospace; font-size: 12px;">${orderId.substring(0, 16)}...</span></p>
      <p style="margin: 0;"><strong>Ny status:</strong> <span style="color: ${statusInfo.color}; font-weight: 600;">${statusInfo.icon} ${statusInfo.label}</span></p>
    </div>

    ${newStatus === 'DELIVERED' ? `
    <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 6px;">
      <p style="margin: 0; color: #065f46;"><strong>✅ Leveransen är slutförd!</strong></p>
      <p style="margin: 10px 0 0 0; color: #065f46; font-size: 14px;">Vänligen verifiera att du mottagit varorna i gott skick.</p>
    </div>
    ` : ''}

    ${newStatus === 'SHIPPED' ? `
    <p>Din order är nu på väg! Du kommer få ett nytt meddelande när leveransen är slutförd.</p>
    ` : ''}

    ${newStatus === 'IN_FULFILLMENT' ? `
    <p>Din order bearbetas nu för leverans. Du kommer få ett meddelande när ordern skickas.</p>
    ` : ''}

    ${newStatus === 'CANCELLED' ? `
    <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin: 20px 0; border-radius: 6px;">
      <p style="margin: 0; color: #991b1b;"><strong>❌ Ordern har avbrutits</strong></p>
      <p style="margin: 10px 0 0 0; color: #991b1b; font-size: 14px;">Kontakta leverantören om du har frågor.</p>
    </div>
    ` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${orderUrl}" style="display: inline-block; background: ${statusInfo.color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Visa order
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Se fullständig orderhistorik och detaljer:<br>
      <a href="${orderUrl}" style="color: ${statusInfo.color}; word-break: break-all;">${orderUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Winefeed - Din B2B-marknadsplats för vin</p>
  </div>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">📬 Ny förfrågan!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">En restaurang vill ha din offert</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #d97706; margin-top: 0;">Hej ${supplierName}!</h2>

    <p><strong>${restaurantName}</strong> har skickat en förfrågan som matchar din katalog.</p>

    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Förfrågan:</strong> ${fritext}</p>
      ${wineCount ? `<p style="margin: 0 0 10px 0;"><strong>Antal viner:</strong> ${wineCount} st</p>` : ''}
      ${antalFlaskor ? `<p style="margin: 0 0 10px 0;"><strong>Antal flaskor:</strong> ${antalFlaskor}</p>` : ''}
      ${budgetPerFlaska ? `<p style="margin: 0 0 10px 0;"><strong>Budget:</strong> ${budgetPerFlaska} kr/flaska</p>` : ''}
      ${leveransOrt ? `<p style="margin: 0 0 10px 0;"><strong>Leveransort:</strong> ${leveransOrt}</p>` : ''}
    </div>

    ${hasProvorder ? `
    <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 6px;">
      <p style="margin: 0; color: #065f46;"><strong>✅ Provorder accepterad</strong></p>
      <p style="margin: 10px 0 0 0; color: #065f46; font-size: 14px;">Kunden godkänner extra avgift på ${provorderFeeTotal} kr för småorder.</p>
    </div>
    ` : ''}

    ${expiryDate ? `
    <p style="color: #b45309; font-weight: 500;">⏰ Svara senast: ${expiryDate}</p>
    ` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${requestUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Visa förfrågan & skicka offert
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Gå direkt till din leverantörsportal:<br>
      <a href="${getAppUrl('/supplier/requests')}" style="color: #f59e0b;">Se alla förfrågningar</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Winefeed - Din B2B-marknadsplats för vin</p>
  </div>
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✅ Order bekräftad!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Order #${shortOrderId}</p>
  </div>

  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #10b981; margin-top: 0;">Tack för din order!</h2>

    <p>Hej ${recipientName},</p>

    <p>Din order har bekräftats och leverantören har börjat behandla den.</p>

    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Order:</strong> #${shortOrderId}</p>
      <p style="margin: 0 0 10px 0;"><strong>Restaurang:</strong> ${restaurantName}</p>
      <p style="margin: 0 0 10px 0;"><strong>Leverantör:</strong> ${supplierName}</p>
      <p style="margin: 0 0 10px 0;"><strong>Antal flaskor:</strong> ${totalBottles}</p>
      ${totalValueSek ? `<p style="margin: 0 0 10px 0;"><strong>Totalt:</strong> ${totalValueSek.toLocaleString('sv-SE')} kr</p>` : ''}
      ${deliveryAddress ? `<p style="margin: 0 0 10px 0;"><strong>Leveransadress:</strong> ${deliveryAddress}</p>` : ''}
      ${expectedDelivery ? `<p style="margin: 0;"><strong>Förväntad leverans:</strong> ${expectedDelivery}</p>` : ''}
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
      <a href="${orderUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Visa order
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Du får ett nytt mail när ordern skickas.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>Winefeed - Din B2B-marknadsplats för vin</p>
  </div>
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
