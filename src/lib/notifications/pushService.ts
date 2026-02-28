/**
 * Push Notification Service
 * Beheert Web Push Notifications en Service Worker registratie
 */

export interface PushNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string }>;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported = false;

  private constructor() {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialiseer service worker en push notifications
   */
  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.log('[Push] Push notifications niet ondersteund op dit device');
      return false;
    }

    try {
      // Registreer service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      console.log('[Push] Service Worker geregistreerd');
      return true;
    } catch (err) {
      console.error('[Push] Service Worker registratie mislukt:', err);
      return false;
    }
  }

  /**
   * Request toestemming voor push notifications
   */
  async requestPermission(): Promise<NotificationPermission | null> {
    if (!this.isSupported) return null;

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      console.log('[Push] Push notifications geweigerd door user');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission request resultaat:', permission);
      return permission;
    } catch (err) {
      console.error('[Push] Permission request error:', err);
      return null;
    }
  }

  /**
   * Check of push notifications geactiveerd zijn
   */
  isEnabled(): boolean {
    return Notification.permission === 'granted';
  }

  /**
   * Abonneer op push notifications
   */
  async subscribe(userId: string): Promise<string | null> {
    if (!this.isSupported || !this.registration) {
      console.log('[AIO Push] Push niet ondersteund in deze browser');
      return null;
    }

    try {
      console.log('[AIO Push] subscribe() - step 1: requesting PushManager subscription');
      console.log('[AIO Push] VAPID key present:', !!process.env.VITE_VAPID_PUBLIC_KEY);
      
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.VITE_VAPID_PUBLIC_KEY
      });

      console.log('[AIO Push] subscribe() - step 2: PushManager subscription successful', {
        endpoint: subscription.endpoint,
        endpointLength: subscription.endpoint.length,
        keys: Object.keys(subscription.toJSON().keys || {})
      });

      // Stuur subscription naar backend
      const subscriptionPayload = subscription.toJSON();
      console.log('[AIO Push] subscribe() - step 3: sending to backend', {
        userId,
        hasEndpoint: !!subscriptionPayload.endpoint,
        hasKeys: !!subscriptionPayload.keys
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: subscriptionPayload
        })
      });

      console.log('[AIO Push] subscribe() - step 4: backend response', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('[AIO Push] ✅ subscribe() SUCCESS', {
          userId,
          subscriptionId: responseData.subscriptionId,
          message: responseData.message
        });
        return userId;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AIO Push] ❌ subscribe() FAILED - backend error', {
          step: 'backend response',
          status: response.status,
          error: errorData.error || 'Unknown error',
          details: errorData.details || 'No details provided'
        });
        return null;
      }
    } catch (err) {
      console.error('[AIO Push] ❌ subscribe() FAILED - exception', {
        step: 'subscription process',
        error: err,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'Unknown',
        stack: err instanceof Error ? err.stack : undefined,
        isSupported: this.isSupported,
        hasRegistration: !!this.registration
      });
      return null;
    }
  }

  /**
   * Unsubscribe van push notifications
   */
  async unsubscribe(userId: string): Promise<boolean> {
    if (!this.registration) {
      console.log('[AIO Push] unsubscribe() - no registration');
      return false;
    }

    try {
      console.log('[AIO Push] unsubscribe() - step 1: getting current subscription');
      const subscription = await this.registration.pushManager.getSubscription();
      
      if (!subscription) {
        console.log('[AIO Push] unsubscribe() - no active subscription found');
        return true; // Already unsubscribed
      }

      console.log('[AIO Push] unsubscribe() - step 2: found subscription, unsubscribing from browser');
      await subscription.unsubscribe();
      
      console.log('[AIO Push] unsubscribe() - step 3: notifying backend');
      // Notify backend
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        console.log('[AIO Push] ✅ unsubscribe() SUCCESS', { userId });
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[AIO Push] unsubscribe() - backend error but local unsubscribe OK', {
          backendStatus: response.status,
          backendError: errorData.error
        });
        return true; // Local unsubscribe succeeded
      }
    } catch (err) {
      console.error('[AIO Push] ❌ unsubscribe() FAILED', {
        step: 'unsubscription process',
        error: err,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'Unknown'
      });
      return false;
    }
  }

  /**
   * Check of user al geabonneerd is
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      return subscription !== null;
    } catch (err) {
      console.error('[Push] Subscription check error:', err);
      return false;
    }
  }

  /**
   * Toon lokale notification (test)
   */
  async showNotification(options: PushNotificationOptions): Promise<void> {
    if (!this.registration || !this.isEnabled()) {
      console.log('[Push] Cannot show notification - not enabled');
      return;
    }

    try {
      await this.registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.png',
        badge: options.badge || '/favicon.png',
        tag: options.tag || 'default',
        requireInteraction: options.requireInteraction || false,
        data: options.data || {}
      });
    } catch (err) {
      console.error('[Push] Show notification error:', err);
    }
  }

  /**
   * Get subscription status
   */
  getSupported(): boolean {
    return this.isSupported;
  }
}

export default PushNotificationService;
