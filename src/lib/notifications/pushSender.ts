/**
 * Push notification sender - voor use in cron jobs
 * Verzendt push notifications naar geabonneerde users
 */

import { createClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Configure web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'noreply@autoinvestoracle.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface PushNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string }>;
}

/**
 * Verzendt push notification naar specifieke user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    // Fetch user subscription
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, auth_key, p256dh_key')
      .eq('user_id', userId)
      .single();

    if (error || !subscription) {
      console.log(`[Push] No subscription found for user ${userId}`);
      return false;
    }

    // Build subscription object
    const sub = {
      endpoint: subscription.endpoint,
      keys: {
        auth: subscription.auth_key,
        p256dh: subscription.p256dh_key
      }
    };

    // Send push
    await webpush.sendNotification(sub, JSON.stringify(payload));
    console.log(`[Push] Notification sent to user ${userId}`);
    return true;
  } catch (err: any) {
    if (err.statusCode === 410) {
      // Subscription expired - delete it
      console.log(`[Push] Subscription expired for user ${userId}`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);
      return false;
    }

    console.error(`[Push] Error sending notification to ${userId}:`, err.message);
    return false;
  }
}

/**
 * Verzendt push notifications naar meerdere users
 */
export async function sendPushNotificationBatch(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<number> {
  let successCount = 0;

  for (const userId of userIds) {
    const success = await sendPushNotification(userId, payload);
    if (success) successCount++;
  }

  return successCount;
}

/**
 * Verzendt trading alert via push notification
 */
export async function sendTradingAlert(userId: string, action: string, asset: string, details?: string) {
  return sendPushNotification(userId, {
    title: '📈 Trading Alert',
    body: `${action} signal detected for ${asset}${details ? ': ' + details : ''}`,
    tag: `trading-${action}-${asset}`,
    requireInteraction: true,
    data: {
      type: 'trading-alert',
      action,
      asset,
      timestamp: new Date().toISOString()
    },
    actions: [
      { action: 'open', title: 'View Details' },
      { action: 'close', title: 'Dismiss' }
    ]
  });
}

/**
 * Verzendt observation update via push notification
 */
export async function sendObservationNotification(userId: string, observation: string, context?: string) {
  return sendPushNotification(userId, {
    title: '🤖 Market Observation',
    body: observation,
    tag: 'observation',
    data: {
      type: 'observation',
      context,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Verzendt agent status update
 */
export async function sendAgentStatusNotification(userId: string, status: string, message: string) {
  return sendPushNotification(userId, {
    title: 'Agent Status Update',
    body: message,
    tag: 'agent-status',
    data: {
      type: 'agent-status',
      status,
      timestamp: new Date().toISOString()
    }
  });
}
