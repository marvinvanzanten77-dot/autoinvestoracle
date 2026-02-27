/**
 * Push Notification API Endpoints
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * Subscribe user to push notifications
 * POST /api/push/subscribe
 */
export async function handlePushSubscribe(req: any, res: any) {
  try {
    const { userId, subscription } = req.body;

    if (!userId || !subscription) {
      return res.status(400).json({ error: 'Missing userId or subscription' });
    }

    // Save subscription in database
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        auth_key: subscription.keys?.auth,
        p256dh_key: subscription.keys?.p256dh,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('[Push] DB error:', error);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    console.log('[Push] Subscription saved for user:', userId);
    res.status(200).json({ message: 'Subscribed successfully' });
  } catch (err) {
    console.error('[Push] Subscribe error:', err);
    res.status(500).json({ error: 'Subscription failed' });
  }
}

/**
 * Unsubscribe user from push notifications
 * POST /api/push/unsubscribe
 */
export async function handlePushUnsubscribe(req: any, res: any) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[Push] DB error:', error);
      return res.status(500).json({ error: 'Failed to delete subscription' });
    }

    console.log('[Push] Unsubscribed user:', userId);
    res.status(200).json({ message: 'Unsubscribed successfully' });
  } catch (err) {
    console.error('[Push] Unsubscribe error:', err);
    res.status(500).json({ error: 'Unsubscription failed' });
  }
}

/**
 * Check subscription status
 * GET /api/push/status/:userId
 */
export async function handlePushStatus(req: any, res: any) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('user_id, created_at, updated_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      return res.status(200).json({ subscribed: false });
    }

    res.status(200).json({
      subscribed: !!data,
      createdAt: data?.created_at,
      updatedAt: data?.updated_at
    });
  } catch (err) {
    console.error('[Push] Status error:', err);
    res.status(500).json({ error: 'Status check failed' });
  }
}

/**
 * Get all subscriptions for sending notifications
 * Used by cron jobs and background tasks
 */
export async function getPushSubscriptions(userIds?: string[]) {
  try {
    let query = supabase
      .from('push_subscriptions')
      .select('*');

    if (userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Push] Get subscriptions error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[Push] Get subscriptions error:', err);
    return [];
  }
}
