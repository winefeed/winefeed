/**
 * PENDING OFFER REMINDERS - "Poor Man's Cron"
 *
 * Sends reminder emails to restaurants with pending offers > 48h
 * Triggered when dashboard loads (via stats API)
 *
 * Features:
 * - Idempotent: Uses reminder_sent_at to prevent duplicate sends
 * - Rate limited: Max 5 reminders per run to avoid email spamming
 * - Fail-safe: Errors don't block the calling endpoint
 */

import { createClient } from '@supabase/supabase-js';
import { sendEmail, getRestaurantRecipients } from './email-service';
import { offerPendingReminderEmail } from './email-templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const REMINDER_THRESHOLD_HOURS = 48;
const MAX_REMINDERS_PER_RUN = 5;

export interface ReminderResult {
  sent: number;
  errors: number;
  skipped: number;
}

/**
 * Process pending offer reminders
 * Call this from stats API or any dashboard-related endpoint
 */
export async function processPendingOfferReminders(tenantId: string): Promise<ReminderResult> {
  const result: ReminderResult = { sent: 0, errors: 0, skipped: 0 };

  try {
    const thresholdTime = new Date(Date.now() - REMINDER_THRESHOLD_HOURS * 60 * 60 * 1000);

    // Find pending offers older than 48h without reminder
    const { data: pendingOffers, error } = await supabase
      .from('offers')
      .select(`
        id,
        title,
        created_at,
        supplier_id,
        request_id,
        requests!inner(restaurant_id, fritext),
        suppliers!inner(namn)
      `)
      .in('status', ['SENT', 'VIEWED', 'pending'])
      .lt('created_at', thresholdTime.toISOString())
      .is('reminder_sent_at', null)
      .limit(MAX_REMINDERS_PER_RUN);

    if (error) {
      console.error('Error fetching pending offers for reminders:', error);
      return result;
    }

    if (!pendingOffers || pendingOffers.length === 0) {
      return result;
    }

    console.log(`📧 [REMINDER] Found ${pendingOffers.length} offers pending > 48h`);

    for (const offer of pendingOffers) {
      try {
        const requestData = offer.requests as any;
        const supplierData = offer.suppliers as any;
        const restaurantId = requestData?.restaurant_id;

        if (!restaurantId) {
          result.skipped++;
          continue;
        }

        // Get restaurant recipients
        const recipients = await getRestaurantRecipients(restaurantId, tenantId);

        if (recipients.length === 0) {
          console.warn(`⚠️  No recipients for restaurant ${restaurantId}`);
          result.skipped++;
          continue;
        }

        // Fetch restaurant name
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', restaurantId)
          .single();

        // Calculate hours waiting
        const hoursWaiting = Math.floor(
          (Date.now() - new Date(offer.created_at).getTime()) / (1000 * 60 * 60)
        );

        // Get offer line count
        const { count: linesCount } = await supabase
          .from('offer_lines')
          .select('id', { count: 'exact', head: true })
          .eq('offer_id', offer.id);

        // Generate email
        const emailContent = offerPendingReminderEmail({
          restaurantName: restaurant?.name || 'Kära kund',
          offerId: offer.id,
          offerTitle: offer.title || requestData?.fritext?.substring(0, 50) || 'Offert',
          supplierName: supplierData?.namn || 'Leverantör',
          hoursWaiting,
          linesCount: linesCount || 1
        });

        // Send to first recipient (primary contact)
        const emailResult = await sendEmail({
          to: recipients[0],
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });

        if (emailResult.success) {
          // Mark reminder as sent
          await supabase
            .from('offers')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', offer.id);

          result.sent++;
          console.log(`✅ Reminder sent for offer ${offer.id.substring(0, 8)}`);
        } else {
          console.error(`❌ Failed to send reminder for offer ${offer.id}: ${emailResult.error}`);
          result.errors++;
        }
      } catch (offerError: any) {
        console.error(`Error processing offer ${offer.id}:`, offerError);
        result.errors++;
      }
    }

    if (result.sent > 0) {
      console.log(`📧 [REMINDER] Sent ${result.sent} reminders, ${result.errors} errors, ${result.skipped} skipped`);
    }

    return result;
  } catch (error: any) {
    console.error('Error in processPendingOfferReminders:', error);
    return result;
  }
}
