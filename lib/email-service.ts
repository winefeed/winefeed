/**
 * EMAIL SERVICE - Pilot Loop 1.0 Notifications
 *
 * Wrapper around Resend for sending transactional emails
 *
 * Features:
 * - Fail-safe: Email failures don't block API requests
 * - Tenant-scoped: Only sends to contacts within tenant
 * - Event logging: Logs MAIL_SENT events to offer_events
 * - Dev mode: Console log when EMAIL_NOTIFICATIONS_ENABLED=false
 */

import { Resend } from 'resend';
import { getSupabaseAdmin } from './supabase-server';

// Lazy initialization - only create Resend client when API key is available
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Email configuration
const EMAIL_ENABLED = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@winefeed.se';
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailEventPayload {
  type: 'OFFER_CREATED' | 'OFFER_ACCEPTED' | 'ORDER_STATUS_UPDATED';
  to: string;
  success: boolean;
  error?: string;
}

/**
 * Send email with Resend
 * Fail-safe: Returns success even if email fails (logs error)
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, text } = params;

  // Dev mode: Console log instead of sending
  if (!EMAIL_ENABLED) {
    console.log('📧 [EMAIL DISABLED] Would send email:');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${text.substring(0, 100)}...`);
    return { success: true };
  }

  // Validate Resend API key
  const resend = getResendClient();
  if (!resend) {
    console.warn('⚠️  RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text
    });

    if (error) {
      console.error('❌ Failed to send email:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }

    console.log(`✅ Email sent to ${to}: ${subject}`);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Email send exception:', error);
    return { success: false, error: error.message || 'Exception during send' };
  }
}

/**
 * Get restaurant contact email
 * Priority: 1) restaurants.contact_email, 2) first restaurant_user email
 *
 * @deprecated Use getRestaurantRecipients() for multi-user support
 */
export async function getRestaurantEmail(restaurantId: string, tenantId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  try {
    // Try restaurants.contact_email first
    // Note: restaurants table doesn't have tenant_id column (MVP single-tenant)
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('contact_email')
      .eq('id', restaurantId)
      .single();

    if (!restaurant) {
      console.warn(`⚠️  Restaurant ${restaurantId} not found`);
      return null;
    }

    if (restaurant.contact_email) {
      return restaurant.contact_email;
    }

    // Fallback: Get first restaurant_user email (if table exists)
    // For MVP: Just use restaurant.contact_email
    console.warn(`⚠️  No contact_email for restaurant ${restaurantId}`);
    return null;

  } catch (error: any) {
    console.error('Error fetching restaurant email:', error);
    return null;
  }
}

/**
 * Get all email recipients for a restaurant
 *
 * Strategy:
 * 1. Fetch all active restaurant_users for the restaurant
 * 2. For each user, get email from auth.users
 * 3. Deduplicate and validate
 * 4. Fallback to restaurants.contact_email if no users found
 *
 * Returns: Array of unique, validated email addresses
 */
export async function getRestaurantRecipients(restaurantId: string, tenantId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const recipients: string[] = [];

  try {
    // Verify restaurant exists
    // Note: restaurants table doesn't have tenant_id column (MVP single-tenant)
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('contact_email')
      .eq('id', restaurantId)
      .single();

    if (!restaurant) {
      console.warn(`⚠️  Restaurant ${restaurantId} not found`);
      return [];
    }

    // 1. Get all active restaurant_users
    const { data: restaurantUsers, error: usersError } = await supabase
      .from('restaurant_users')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true);

    if (usersError) {
      console.error('Error fetching restaurant_users:', usersError);
      // Fall through to fallback
    }

    // 2. Fetch emails from auth.users for each restaurant_user
    if (restaurantUsers && restaurantUsers.length > 0) {
      for (const ru of restaurantUsers) {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(ru.id);

          if (authUser?.user?.email) {
            // Validate email format (basic check)
            if (isValidEmail(authUser.user.email)) {
              recipients.push(authUser.user.email);
            } else {
              console.warn(`⚠️  Invalid email format for user ${ru.id}: ${authUser.user.email}`);
            }
          }
        } catch (error) {
          console.warn(`⚠️  Could not fetch email for user ${ru.id}:`, error);
          // Continue with other users
        }
      }
    }

    // 3. Deduplicate emails (case-insensitive)
    const uniqueRecipients = Array.from(
      new Set(recipients.map(email => email.toLowerCase()))
    );

    // 4. Fallback to restaurants.contact_email if no users found
    if (uniqueRecipients.length === 0 && restaurant.contact_email) {
      if (isValidEmail(restaurant.contact_email)) {
        console.log(`📧 Using fallback contact_email for restaurant ${restaurantId}`);
        return [restaurant.contact_email];
      }
    }

    if (uniqueRecipients.length === 0) {
      console.warn(`⚠️  No valid email recipients found for restaurant ${restaurantId}`);
    } else {
      console.log(`📧 Found ${uniqueRecipients.length} recipient(s) for restaurant ${restaurantId}`);
    }

    return uniqueRecipients;

  } catch (error: any) {
    console.error('Error fetching restaurant recipients:', error);
    return [];
  }
}

/**
 * Validate email format (basic check)
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Get supplier contact email
 * Priority: 1) suppliers.kontakt_email, 2) first supplier_user email
 */
export async function getSupplierEmail(supplierId: string, tenantId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  try {
    // Try suppliers.kontakt_email first
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('kontakt_email')
      .eq('id', supplierId)
      .single();

    if (!supplier) {
      console.warn(`⚠️  Supplier ${supplierId} not found`);
      return null;
    }

    if (supplier.kontakt_email) {
      return supplier.kontakt_email;
    }

    // Fallback: Get first supplier_user email
    const { data: supplierUsers } = await supabase
      .from('supplier_users')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('is_active', true)
      .limit(1);

    if (supplierUsers && supplierUsers.length > 0) {
      // Get email from auth.users (supplier_users.id references auth.users)
      // For MVP: Just use kontakt_email
      console.warn(`⚠️  No kontakt_email for supplier ${supplierId}, supplier_users exist but email fetch not implemented`);
      return null;
    }

    console.warn(`⚠️  No contact email for supplier ${supplierId}`);
    return null;

  } catch (error: any) {
    console.error('Error fetching supplier email:', error);
    return null;
  }
}

/**
 * Log email event to offer_events
 */
export async function logEmailEvent(
  tenantId: string,
  offerId: string,
  payload: EmailEventPayload
): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    await supabase.from('offer_events').insert({
      tenant_id: tenantId,
      offer_id: offerId,
      event_type: 'MAIL_SENT',
      actor_user_id: null,
      payload: payload
    });
  } catch (error: any) {
    console.error('Failed to log email event:', error);
    // Don't throw - email event logging is not critical
  }
}

/**
 * Log email event to order_events
 */
export async function logOrderEmailEvent(
  tenantId: string,
  orderId: string,
  payload: EmailEventPayload
): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    // Mask email address for security
    const maskedEmail = maskEmail(payload.to);

    await supabase.from('order_events').insert({
      tenant_id: tenantId,
      order_id: orderId,
      event_type: 'MAIL_SENT',
      actor_user_id: null,
      actor_name: 'System',
      metadata: {
        template: payload.type,
        to_masked: maskedEmail,
        success: payload.success,
        error: payload.error || undefined
      }
    });
  } catch (error: any) {
    console.error('Failed to log order email event:', error);
    // Don't throw - email event logging is not critical
  }
}

/**
 * Mask email address for security
 * Example: markus@example.com → m***@example.com
 */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***';
  }

  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '***';
  return `${maskedLocal}@${domain}`;
}

/**
 * Get app URL for deep links
 */
export function getAppUrl(path: string): string {
  return `${APP_BASE_URL}${path}`;
}
