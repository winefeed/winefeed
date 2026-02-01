/**
 * NOTIFICATION SERVICE
 *
 * Central service for sending notifications via:
 * - Push (Web Push API)
 * - Email (Resend)
 *
 * Features:
 * - Event-driven notifications
 * - User preference awareness
 * - Logging to notification_log
 * - Fail-safe (doesn't block on errors)
 */

import webpush from 'web-push';
import { getSupabaseAdmin } from './supabase-server';
import { sendEmail, getRestaurantRecipients, getSupplierEmail, getAppUrl } from './email-service';
import {
  offerCreatedEmail,
  offerAcceptedEmail,
  orderConfirmationEmail,
  newQuoteRequestEmail,
  OfferCreatedEmailParams,
  OfferAcceptedEmailParams,
  OrderConfirmationEmailParams,
  NewQuoteRequestEmailParams
} from './email-templates';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@winefeed.se';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Notification event types
export type NotificationEventType =
  | 'NEW_OFFER'
  | 'OFFER_ACCEPTED'
  | 'ORDER_CONFIRMED'
  | 'NEW_REQUEST_MATCH'
  | 'OFFER_EXPIRING';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface UserPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  notify_new_offer: boolean;
  notify_offer_accepted: boolean;
  notify_order_confirmed: boolean;
  notify_offer_expiring: boolean;
  notify_new_request_match: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  push_enabled: true,
  email_enabled: true,
  notify_new_offer: true,
  notify_offer_accepted: true,
  notify_order_confirmed: true,
  notify_offer_expiring: true,
  notify_new_request_match: true,
};

/**
 * Get user notification preferences
 */
async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) {
    return DEFAULT_PREFERENCES;
  }

  return {
    push_enabled: data.push_enabled ?? true,
    email_enabled: data.email_enabled ?? true,
    notify_new_offer: data.notify_new_offer ?? true,
    notify_offer_accepted: data.notify_offer_accepted ?? true,
    notify_order_confirmed: data.notify_order_confirmed ?? true,
    notify_offer_expiring: data.notify_offer_expiring ?? true,
    notify_new_request_match: data.notify_new_request_match ?? true,
  };
}

/**
 * Check if user wants this notification type
 */
function shouldNotify(prefs: UserPreferences, eventType: NotificationEventType, channel: 'push' | 'email'): boolean {
  // Check channel enabled
  if (channel === 'push' && !prefs.push_enabled) return false;
  if (channel === 'email' && !prefs.email_enabled) return false;

  // Check event type enabled
  switch (eventType) {
    case 'NEW_OFFER': return prefs.notify_new_offer;
    case 'OFFER_ACCEPTED': return prefs.notify_offer_accepted;
    case 'ORDER_CONFIRMED': return prefs.notify_order_confirmed;
    case 'OFFER_EXPIRING': return prefs.notify_offer_expiring;
    case 'NEW_REQUEST_MATCH': return prefs.notify_new_request_match;
    default: return true;
  }
}

/**
 * Get push subscriptions for a user
 */
async function getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching push subscriptions:', error);
    return [];
  }

  return data || [];
}

/**
 * Send push notification to a user
 */
async function sendPushNotification(
  userId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not configured, skipping push notification');
    return { success: false, sent: 0, failed: 0 };
  }

  const subscriptions = await getUserPushSubscriptions(userId);

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const supabase = getSupabaseAdmin();

  for (const sub of subscriptions) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload)
      );

      sent++;
    } catch (error: any) {
      console.error(`Push failed for subscription ${sub.id}:`, error);
      failed++;

      // Remove invalid subscriptions (410 Gone or 404 Not Found)
      if (error.statusCode === 410 || error.statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id);
        console.log(`Removed invalid subscription ${sub.id}`);
      }
    }
  }

  return { success: sent > 0, sent, failed };
}

/**
 * Log notification to database
 */
async function logNotification(
  userId: string | null,
  eventType: NotificationEventType,
  channel: 'push' | 'email',
  status: 'sent' | 'failed' | 'pending',
  recipient?: string,
  subject?: string,
  errorMessage?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    await supabase.from('notification_log').insert({
      user_id: userId,
      event_type: eventType,
      channel,
      status,
      recipient,
      subject,
      error_message: errorMessage,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error('Failed to log notification:', error);
  }
}

// ============================================
// PUBLIC NOTIFICATION FUNCTIONS
// ============================================

/**
 * Notify restaurant about new offer
 */
export async function notifyNewOffer(params: {
  restaurantId: string;
  restaurantName: string;
  tenantId: string;
  offerId: string;
  offerTitle: string;
  supplierName: string;
  requestId: string;
  requestTitle: string;
  linesCount: number;
}): Promise<void> {
  const {
    restaurantId,
    restaurantName,
    tenantId,
    offerId,
    offerTitle,
    supplierName,
    requestId,
    requestTitle,
    linesCount,
  } = params;

  // Get restaurant user IDs for push
  const supabase = getSupabaseAdmin();
  const { data: restaurantUsers } = await supabase
    .from('restaurant_users')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true);

  // Send push notifications
  for (const user of restaurantUsers || []) {
    const prefs = await getUserPreferences(user.id);

    if (shouldNotify(prefs, 'NEW_OFFER', 'push')) {
      const pushPayload: NotificationPayload = {
        title: 'Ny offert mottagen!',
        body: `${supplierName} har svarat på din förfrågan`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        url: `/offers/${offerId}`,
        tag: `offer-${offerId}`,
        data: { offerId, requestId },
      };

      const result = await sendPushNotification(user.id, pushPayload);
      await logNotification(
        user.id,
        'NEW_OFFER',
        'push',
        result.success ? 'sent' : 'failed',
        undefined,
        pushPayload.title,
        undefined,
        { offerId, sent: result.sent, failed: result.failed }
      );
    }
  }

  // Send email
  const recipients = await getRestaurantRecipients(restaurantId, tenantId);

  for (const email of recipients) {
    // Check first user's preferences for email (simplified)
    const firstUser = restaurantUsers?.[0];
    if (firstUser) {
      const prefs = await getUserPreferences(firstUser.id);
      if (!shouldNotify(prefs, 'NEW_OFFER', 'email')) continue;
    }

    const emailParams: OfferCreatedEmailParams = {
      restaurantName,
      requestTitle,
      requestId,
      offerId,
      offerTitle,
      supplierName,
      linesCount,
    };

    const { subject, html, text } = offerCreatedEmail(emailParams);
    const result = await sendEmail({ to: email, subject, html, text });

    await logNotification(
      firstUser?.id || null,
      'NEW_OFFER',
      'email',
      result.success ? 'sent' : 'failed',
      email,
      subject,
      result.error,
      { offerId }
    );
  }
}

/**
 * Notify supplier about accepted offer
 */
export async function notifyOfferAccepted(params: {
  supplierId: string;
  supplierName: string;
  tenantId: string;
  offerId: string;
  offerTitle: string;
  restaurantName: string;
  requestId: string | null;
  acceptedAt: string;
}): Promise<void> {
  const {
    supplierId,
    supplierName,
    tenantId,
    offerId,
    offerTitle,
    restaurantName,
    requestId,
    acceptedAt,
  } = params;

  // Get supplier user IDs for push
  const supabase = getSupabaseAdmin();
  const { data: supplierUsers } = await supabase
    .from('supplier_users')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('is_active', true);

  // Send push notifications
  for (const user of supplierUsers || []) {
    const prefs = await getUserPreferences(user.id);

    if (shouldNotify(prefs, 'OFFER_ACCEPTED', 'push')) {
      const pushPayload: NotificationPayload = {
        title: 'Offert accepterad!',
        body: `${restaurantName} har accepterat din offert`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        url: `/supplier/offers/${offerId}`,
        tag: `offer-accepted-${offerId}`,
        data: { offerId },
      };

      const result = await sendPushNotification(user.id, pushPayload);
      await logNotification(
        user.id,
        'OFFER_ACCEPTED',
        'push',
        result.success ? 'sent' : 'failed',
        undefined,
        pushPayload.title,
        undefined,
        { offerId }
      );
    }
  }

  // Send email
  const email = await getSupplierEmail(supplierId, tenantId);

  if (email) {
    const firstUser = supplierUsers?.[0];
    if (firstUser) {
      const prefs = await getUserPreferences(firstUser.id);
      if (!shouldNotify(prefs, 'OFFER_ACCEPTED', 'email')) return;
    }

    const emailParams: OfferAcceptedEmailParams = {
      supplierName,
      restaurantName,
      offerId,
      requestId,
      offerTitle,
      acceptedAt,
    };

    const { subject, html, text } = offerAcceptedEmail(emailParams);
    const result = await sendEmail({ to: email, subject, html, text });

    await logNotification(
      firstUser?.id || null,
      'OFFER_ACCEPTED',
      'email',
      result.success ? 'sent' : 'failed',
      email,
      subject,
      result.error,
      { offerId }
    );
  }
}

/**
 * Notify both parties about confirmed order
 */
export async function notifyOrderConfirmed(params: {
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  supplierId: string;
  supplierName: string;
  tenantId: string;
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
}): Promise<void> {
  const {
    orderId,
    restaurantId,
    restaurantName,
    supplierId,
    supplierName,
    tenantId,
    totalBottles,
    totalValueSek,
    deliveryAddress,
    expectedDelivery,
    items,
  } = params;

  const supabase = getSupabaseAdmin();

  // Notify restaurant
  const { data: restaurantUsers } = await supabase
    .from('restaurant_users')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true);

  for (const user of restaurantUsers || []) {
    const prefs = await getUserPreferences(user.id);

    if (shouldNotify(prefs, 'ORDER_CONFIRMED', 'push')) {
      const pushPayload: NotificationPayload = {
        title: 'Order bekräftad!',
        body: `Din order från ${supplierName} är bekräftad`,
        icon: '/icons/icon-192x192.png',
        url: `/orders/${orderId}`,
        tag: `order-${orderId}`,
      };

      await sendPushNotification(user.id, pushPayload);
    }
  }

  // Email to restaurant
  const restaurantEmails = await getRestaurantRecipients(restaurantId, tenantId);
  for (const email of restaurantEmails) {
    const emailParams: OrderConfirmationEmailParams = {
      recipientName: restaurantName,
      orderId,
      restaurantName,
      supplierName,
      totalBottles,
      totalValueSek,
      deliveryAddress,
      expectedDelivery,
      items,
    };

    const { subject, html, text } = orderConfirmationEmail(emailParams);
    await sendEmail({ to: email, subject, html, text });
  }

  // Notify supplier
  const { data: supplierUsers } = await supabase
    .from('supplier_users')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('is_active', true);

  for (const user of supplierUsers || []) {
    const prefs = await getUserPreferences(user.id);

    if (shouldNotify(prefs, 'ORDER_CONFIRMED', 'push')) {
      const pushPayload: NotificationPayload = {
        title: 'Ny order mottagen!',
        body: `${restaurantName} har lagt en order`,
        icon: '/icons/icon-192x192.png',
        url: `/supplier/orders/${orderId}`,
        tag: `order-${orderId}`,
      };

      await sendPushNotification(user.id, pushPayload);
    }
  }

  // Email to supplier
  const supplierEmail = await getSupplierEmail(supplierId, tenantId);
  if (supplierEmail) {
    const emailParams: OrderConfirmationEmailParams = {
      recipientName: supplierName,
      orderId,
      restaurantName,
      supplierName,
      totalBottles,
      totalValueSek,
      deliveryAddress,
      expectedDelivery,
      items,
    };

    const { subject, html, text } = orderConfirmationEmail(emailParams);
    await sendEmail({ to: supplierEmail, subject, html, text });
  }
}

/**
 * Notify supplier about new matching request (push only)
 */
export async function notifyNewRequestMatch(params: {
  supplierId: string;
  supplierName: string;
  tenantId: string;
  requestId: string;
  restaurantName: string;
  fritext: string;
  antalFlaskor?: number;
  budgetPerFlaska?: number;
  leveransOrt?: string;
  expiresAt?: string;
  wineCount?: number;
}): Promise<void> {
  const {
    supplierId,
    supplierName,
    tenantId,
    requestId,
    restaurantName,
    fritext,
    antalFlaskor,
    budgetPerFlaska,
    leveransOrt,
    expiresAt,
    wineCount,
  } = params;

  const supabase = getSupabaseAdmin();
  const { data: supplierUsers } = await supabase
    .from('supplier_users')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('is_active', true);

  // Push only (per spec)
  for (const user of supplierUsers || []) {
    const prefs = await getUserPreferences(user.id);

    if (shouldNotify(prefs, 'NEW_REQUEST_MATCH', 'push')) {
      const pushPayload: NotificationPayload = {
        title: 'Ny förfrågan!',
        body: `${restaurantName} söker vin som matchar din katalog`,
        icon: '/icons/icon-192x192.png',
        url: `/supplier/requests/${requestId}`,
        tag: `request-${requestId}`,
        data: { requestId },
      };

      const result = await sendPushNotification(user.id, pushPayload);
      await logNotification(
        user.id,
        'NEW_REQUEST_MATCH',
        'push',
        result.success ? 'sent' : 'failed',
        undefined,
        pushPayload.title,
        undefined,
        { requestId }
      );
    }
  }
}

/**
 * Notify restaurant about expiring offer
 */
export async function notifyOfferExpiring(params: {
  restaurantId: string;
  restaurantName: string;
  tenantId: string;
  offerId: string;
  offerTitle: string;
  supplierName: string;
  expiresAt: string;
}): Promise<void> {
  const {
    restaurantId,
    restaurantName,
    tenantId,
    offerId,
    offerTitle,
    supplierName,
    expiresAt,
  } = params;

  const supabase = getSupabaseAdmin();
  const { data: restaurantUsers } = await supabase
    .from('restaurant_users')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true);

  const expiryDate = new Date(expiresAt).toLocaleString('sv-SE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Push
  for (const user of restaurantUsers || []) {
    const prefs = await getUserPreferences(user.id);

    if (shouldNotify(prefs, 'OFFER_EXPIRING', 'push')) {
      const pushPayload: NotificationPayload = {
        title: 'Offert löper ut snart!',
        body: `Offert från ${supplierName} går ut ${expiryDate}`,
        icon: '/icons/icon-192x192.png',
        url: `/offers/${offerId}`,
        tag: `offer-expiring-${offerId}`,
      };

      await sendPushNotification(user.id, pushPayload);
    }
  }

  // Email
  const recipients = await getRestaurantRecipients(restaurantId, tenantId);
  for (const email of recipients) {
    const subject = `Offert löper ut snart: ${offerTitle}`;
    const html = `
      <p>Hej ${restaurantName},</p>
      <p>En offert från <strong>${supplierName}</strong> löper ut <strong>${expiryDate}</strong>.</p>
      <p><a href="${getAppUrl(`/offers/${offerId}`)}">Granska offerten</a></p>
    `;
    const text = `Offert från ${supplierName} löper ut ${expiryDate}. Granska: ${getAppUrl(`/offers/${offerId}`)}`;

    await sendEmail({ to: email, subject, html, text });
  }
}
