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
 * Verzendt markt update notification
 */
export async function sendMarketUpdateNotification(
  userId: string,
  marketContext: string,
  volatilityLevel: string,
  momentum: string,
  priceChanges?: Record<string, number>
) {
  const volatilityEmoji = {
    'laag-volatiel': '😌',
    'matig-volatiel': '📊',
    'hoog-volatiel': '⚡'
  };

  const emoji = volatilityEmoji[volatilityLevel as keyof typeof volatilityEmoji] || '📈';

  return sendPushNotification(userId, {
    title: `${emoji} Market Update`,
    body: `${marketContext} • Volatility: ${volatilityLevel} • Momentum: ${momentum}`,
    tag: 'market-update',
    data: {
      type: 'market-update',
      marketContext,
      volatilityLevel,
      momentum,
      priceChanges: priceChanges || {},
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Verzendt account analyse notification
 */
export async function sendAccountUpdateNotification(
  userId: string,
  portfolioChange: number,
  totalBalance: number,
  changePercentage: number,
  topAsset?: string
) {
  const trendEmoji = portfolioChange >= 0 ? '📈' : '📉';
  const direction = portfolioChange >= 0 ? 'up' : 'down';
  const changeStr = portfolioChange >= 0 ? `+€${portfolioChange.toFixed(2)}` : `€${portfolioChange.toFixed(2)}`;

  return sendPushNotification(userId, {
    title: `${trendEmoji} Account Update`,
    body: `Portfolio ${direction} ${changeStr} (${changePercentage >= 0 ? '+' : ''}${changePercentage.toFixed(1)}%) • Total: €${totalBalance.toFixed(2)}${topAsset ? ` • Top: ${topAsset}` : ''}`,
    tag: 'account-update',
    data: {
      type: 'account-update',
      portfolioChange,
      totalBalance,
      changePercentage,
      topAsset,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Verzendt action suggestion notification
 */
export async function sendActionSuggestionNotification(
  userId: string,
  action: 'BUY' | 'SELL' | 'REBALANCE' | 'HOLD' | 'STOP-LOSS',
  asset: string,
  reason: string,
  confidence: number
) {
  const actionEmoji = {
    BUY: '🟢',
    SELL: '🔴',
    REBALANCE: '⚖️',
    HOLD: '⏸️',
    'STOP-LOSS': '⛔'
  };

  const emoji = actionEmoji[action];
  
  return sendPushNotification(userId, {
    title: `${emoji} Action Suggested: ${action}`,
    body: `${asset} - ${reason} (Confidence: ${confidence}%)`,
    tag: `action-${action}-${asset}`,
    requireInteraction: true,
    data: {
      type: 'action-suggestion',
      action,
      asset,
      reason,
      confidence,
      timestamp: new Date().toISOString()
    },
    actions: [
      { action: 'execute', title: 'Execute' },
      { action: 'review', title: 'Review' },
      { action: 'dismiss', title: 'Dismiss' }
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
