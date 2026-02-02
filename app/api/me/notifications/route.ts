/**
 * USER NOTIFICATION PREFERENCES API
 *
 * GET /api/me/notifications - Get current notification settings
 * PATCH /api/me/notifications - Update notification settings
 *
 * Security: Requires authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Default settings for new users
const DEFAULT_SETTINGS = {
  push_enabled: true,
  email_enabled: true,
  notify_new_offer: true,
  notify_offer_accepted: true,
  notify_order_confirmed: true,
  notify_offer_expiring: true,
  notify_offer_reminder: true,
  notify_new_request_match: true,
  email_frequency: 'immediate' as const,
};

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    // Fetch user's notification preferences
    const { data: preferences, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (new user)
      throw new Error(`Failed to fetch preferences: ${error.message}`);
    }

    // If no preferences exist, return defaults
    if (!preferences) {
      return NextResponse.json({
        ...DEFAULT_SETTINGS,
        user_id: userId,
        is_default: true,
      });
    }

    // Map to frontend format
    return NextResponse.json({
      email_new_offer: preferences.notify_new_offer ?? true,
      email_offer_reminder: preferences.notify_offer_reminder ?? true,
      email_order_status: preferences.notify_order_confirmed ?? true,
      email_frequency: preferences.email_frequency ?? 'immediate',
      push_enabled: preferences.push_enabled ?? true,
      // Include all fields for completeness
      notify_new_offer: preferences.notify_new_offer,
      notify_offer_accepted: preferences.notify_offer_accepted,
      notify_order_confirmed: preferences.notify_order_confirmed,
      notify_offer_expiring: preferences.notify_offer_expiring,
      notify_new_request_match: preferences.notify_new_request_match,
    });
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing authentication context' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Map frontend fields to database fields
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Map the UI fields to DB fields
    if (typeof body.email_new_offer === 'boolean') {
      updates.notify_new_offer = body.email_new_offer;
    }
    if (typeof body.email_offer_reminder === 'boolean') {
      updates.notify_offer_reminder = body.email_offer_reminder;
    }
    if (typeof body.email_order_status === 'boolean') {
      updates.notify_order_confirmed = body.email_order_status;
    }
    if (body.email_frequency && ['immediate', 'daily', 'weekly'].includes(body.email_frequency)) {
      updates.email_frequency = body.email_frequency;
    }
    if (typeof body.push_enabled === 'boolean') {
      updates.push_enabled = body.push_enabled;
    }

    // Also accept direct DB field names
    const directFields = [
      'notify_new_offer',
      'notify_offer_accepted',
      'notify_order_confirmed',
      'notify_offer_expiring',
      'notify_offer_reminder',
      'notify_new_request_match',
      'email_enabled',
    ];

    for (const field of directFields) {
      if (typeof body[field] === 'boolean') {
        updates[field] = body[field];
      }
    }

    // Upsert preferences (create if not exists, update if exists)
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...updates,
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save preferences: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      preferences: {
        email_new_offer: data.notify_new_offer,
        email_offer_reminder: data.notify_offer_reminder,
        email_order_status: data.notify_order_confirmed,
        email_frequency: data.email_frequency,
        push_enabled: data.push_enabled,
      },
    });
  } catch (error: any) {
    console.error('Error saving notification preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
