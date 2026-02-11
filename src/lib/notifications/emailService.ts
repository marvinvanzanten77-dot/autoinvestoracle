/**
 * EMAIL SERVICE
 * 
 * Handles sending notifications via email to users.
 * 
 * FEATURES:
 * - Fetches user email from Supabase user_profiles table
 * - Checks notification preferences before sending
 * - Supports multiple providers: Resend, SendGrid, stub mode
 * - Respects user opt-in/opt-out preferences
 * 
 * SETUP:
 * 1. Set EMAIL_PROVIDER env var: 'resend' | 'sendgrid' | 'stub'
 * 2. Set EMAIL_PROVIDER_KEY with API key
 * 3. Set SUPABASE_URL and SUPABASE_ANON_KEY
 * 
 * PROVIDERS:
 * - Resend: https://resend.com (recommended, easier API)
 * - SendGrid: https://sendgrid.com (legacy, feature-rich)
 * - Stub: Console logging only (development)
 */

import { createClient } from '@supabase/supabase-js';

export type EmailNotification = {
  userId: string;
  userEmail: string;
  subject: string;
  type: 'execution' | 'alert' | 'summary' | 'error';
  body: {
    title: string;
    message: string;
    details?: Record<string, any>;
    actionUrl?: string;
  };
};

/**
 * Send execution notification email
 * Called after successful trade execution
 */
export async function sendExecutionEmail(params: {
  userId: string;
  userEmail: string;
  asset: string;
  action: 'buy' | 'sell' | 'close_position' | 'rebalance';
  amount: number;
  currency: string;
  orderId: string;
  confidence: number;
}): Promise<{ success: boolean; messageId?: string }> {
  const notification: EmailNotification = {
    userId: params.userId,
    userEmail: params.userEmail,
    subject: `✅ Order Executed: ${params.action} ${params.asset}`,
    type: 'execution',
    body: {
      title: `Trade Execution Notification`,
      message: `Your ${params.action} order for ${params.asset} has been successfully executed on Bitvavo.`,
      details: {
        action: params.action,
        asset: params.asset,
        amount: params.amount,
        currency: params.currency,
        orderId: params.orderId,
        confidence: `${params.confidence}%`,
        timestamp: new Date().toISOString()
      },
      actionUrl: `https://auto-invest-oracle.vercel.app/dashboard?orderid=${params.orderId}`
    }
  };

  return await sendEmail(notification);
}

/**
 * Send alert email (e.g., volatility spike, high confidence opportunity)
 */
export async function sendAlertEmail(params: {
  userId: string;
  userEmail: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  details?: Record<string, any>;
}): Promise<{ success: boolean; messageId?: string }> {
  const notification: EmailNotification = {
    userId: params.userId,
    userEmail: params.userEmail,
    subject: `⚠️ Market Alert: ${params.title}`,
    type: 'alert',
    body: {
      title: params.title,
      message: params.message,
      details: params.details
    }
  };

  return await sendEmail(notification);
}

/**
 * Send daily summary email
 */
export async function sendDailySummaryEmail(params: {
  userId: string;
  userEmail: string;
  portfolioValue: number;
  portfolioChange24h: number;
  topAssets: Array<{ asset: string; change: number }>;
  executions: number;
  alerts: number;
}): Promise<{ success: boolean; messageId?: string }> {
  const notification: EmailNotification = {
    userId: params.userId,
    userEmail: params.userEmail,
    subject: `📊 Daily Summary - Portfolio Update`,
    type: 'summary',
    body: {
      title: 'Daily Portfolio Summary',
      message: `Your portfolio is valued at €${params.portfolioValue.toFixed(2)} (${params.portfolioChange24h > 0 ? '+' : ''}${params.portfolioChange24h.toFixed(2)}% in 24h)`,
      details: {
        portfolioValue: params.portfolioValue,
        portfolioChange24h: params.portfolioChange24h,
        topAssets: params.topAssets,
        executions: params.executions,
        alerts: params.alerts
      }
    }
  };

  return await sendEmail(notification);
}

/**
 * Core email sending function
 * 
 * PROCESS:
 * 1. Fetch user email from Supabase user_profiles
 * 2. Check notification preferences
 * 3. If opted-in, send via configured provider
 * 4. Log result
 * 
 * PROVIDERS SUPPORTED:
 * - 'resend': Uses Resend API (default, recommended)
 * - 'sendgrid': Uses SendGrid API
 * - 'stub': Console logging only (development)
 */
async function sendEmail(notification: EmailNotification): Promise<{ success: boolean; messageId?: string }> {
  const emailProviderKey = process.env.EMAIL_PROVIDER_KEY;
  const emailProviderType = process.env.EMAIL_PROVIDER || 'resend'; // Default to resend

  try {
    // STEP 1: Fetch user's current email from Supabase
    let userEmail = notification.userEmail;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('user_id', notification.userId)
          .single();

        if (profile?.email) {
          userEmail = profile.email;
        }
      } catch (err) {
        // If fetch fails, use provided email
        console.warn('[EmailService] Failed to fetch user email from Supabase, using provided email');
      }
    }

    // STEP 2: Check if user has opted in to this notification type
    const isEnabled = await isEmailNotificationEnabled(notification.userId, notification.type);
    if (!isEnabled) {
      console.log(`[EmailService] User ${notification.userId} has opted out of ${notification.type} emails`);
      return { success: true, messageId: 'opted_out' };
    }

    // STEP 3: Log email attempt
    console.log('[EmailService] Sending email:', {
      userId: notification.userId,
      to: userEmail,
      subject: notification.subject,
      type: notification.type,
      provider: emailProviderType,
      hasKey: !!emailProviderKey
    });

    // STEP 4: Send via configured provider
    if (emailProviderType === 'stub' || !emailProviderKey) {
      console.log('[EmailService - STUB] Email logged:', {
        to: userEmail,
        subject: notification.subject,
        timestamp: new Date().toISOString()
      });
      return {
        success: true,
        messageId: `stub_${Date.now()}`
      };
    }

    // RESEND: https://resend.com (recommended)
    if (emailProviderType === 'resend') {
      return await sendViaResend(notification, userEmail, emailProviderKey);
    }

    // SENDGRID: https://sendgrid.com
    if (emailProviderType === 'sendgrid') {
      return await sendViaSendGrid(notification, userEmail, emailProviderKey);
    }

    // Unknown provider
    console.warn(`[EmailService] Unknown provider: ${emailProviderType}`);
    return { success: false };
  } catch (error) {
    console.error('[EmailService] Error sending email:', error);
    return { success: false };
  }
}

/**
 * Send email via Resend API
 */
async function sendViaResend(
  notification: EmailNotification,
  userEmail: string,
  apiKey: string
): Promise<{ success: boolean; messageId?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: 'notifications@auto-invest-oracle.com',
        to: userEmail,
        subject: notification.subject,
        html: buildEmailHtml(notification),
        replyTo: 'support@auto-invest-oracle.com'
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('[EmailService] Resend API error:', err);
      return { success: false };
    }

    const result = await response.json();
    console.log('[EmailService] Email sent via Resend:', {
      messageId: result.id,
      to: userEmail,
      subject: notification.subject
    });
    return { success: true, messageId: result.id };
  } catch (err) {
    console.error('[EmailService] Resend error:', err);
    return { success: false };
  }
}

/**
 * Send email via SendGrid API
 */
async function sendViaSendGrid(
  notification: EmailNotification,
  userEmail: string,
  apiKey: string
): Promise<{ success: boolean; messageId?: string }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: userEmail }] }],
        from: { email: 'notifications@auto-invest-oracle.com' },
        subject: notification.subject,
        content: [{ type: 'text/html', value: buildEmailHtml(notification) }]
      })
    });

    if (!response.ok) {
      console.error('[EmailService] SendGrid error:', response.statusText);
      return { success: false };
    }

    console.log('[EmailService] Email sent via SendGrid:', {
      to: userEmail,
      subject: notification.subject
    });
    return { success: true, messageId: `sg_${Date.now()}` };
  } catch (err) {
    console.error('[EmailService] SendGrid error:', err);
    return { success: false };
  }
}

/**
 * Build HTML email template
 */
function buildEmailHtml(notification: EmailNotification): string {
  const { title, message, details } = notification.body;

  const detailsHtml = details
    ? `
    <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 12px;">
      <h3 style="margin-top: 0; color: #374151;">Details:</h3>
      <table style="width: 100%; font-size: 14px; color: #555;">
        ${Object.entries(details)
          .map(
            ([key, value]) => `
          <tr>
            <td style="padding: 6px 0; font-weight: 500; color: #374151;">${key}:</td>
            <td style="padding: 6px 0; text-align: right;">
              ${Array.isArray(value) ? JSON.stringify(value) : String(value)}
            </td>
          </tr>
        `
          )
          .join('')}
      </table>
    </div>
  `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #1e40af; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">${title}</h1>
        </div>
        <div class="content">
          <p>${message}</p>
          ${detailsHtml}
          ${
            notification.body.actionUrl
              ? `<a href="${notification.body.actionUrl}" class="button">View in Dashboard</a>`
              : ''
          }
          <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #666; font-size: 12px; margin-top: 12px;">
            This is an automated notification from Auto Invest Oracle.
            <br>
            <a href="https://auto-invest-oracle.vercel.app/settings" style="color: #1e40af;">Manage notification preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Check if user has opted in to email notifications
 * 
 * Fetches from Supabase notification_preferences table
 * Falls back to 'true' (opt-in by default) if:
 * - Preferences don't exist yet (new user)
 * - Supabase is unavailable
 * 
 * PARAMETERS:
 * - userId: User ID to check
 * - notificationType: 'execution' | 'alert' | 'summary'
 */
export async function isEmailNotificationEnabled(
  userId: string,
  notificationType: string
): Promise<boolean> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      // No Supabase config - allow emails by default
      return true;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch user's notification preferences
    const { data: prefs, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Preferences don't exist (new user) - opt-in by default
      if (error.code === 'PGRST116') {
        console.log(`[EmailService] No preferences for user ${userId}, allowing emails (opt-in by default)`);
        return true;
      }
      console.warn('[EmailService] Error fetching notification preferences:', error);
      return true; // Allow if error
    }

    // Check preference based on notification type
    if (notificationType === 'execution' && !prefs.email_on_execution) {
      return false;
    }
    if (notificationType === 'alert' && !prefs.email_on_alert) {
      return false;
    }
    if (notificationType === 'summary' && !prefs.email_on_daily_summary) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn('[EmailService] Error checking notification preferences:', error);
    return true; // Allow if error
  }
}
