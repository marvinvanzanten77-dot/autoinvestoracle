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
      console.log('[Push] Push niet ondersteund');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.VITE_VAPID_PUBLIC_KEY
      });

      // Stuur subscription naar backend
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: subscription.toJSON()
        })
      });

      if (response.ok) {
        console.log('[Push] Subscription succesvol geregistreerd');
        return userId;
      } else {
        console.error('[Push] Subscription registration failed');
        return null;
      }
    } catch (err) {
      console.error('[Push] Subscription error:', err);
      return null;
    }
  }

  /**
   * Unsubscribe van push notifications
   */
  async unsubscribe(userId: string): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify backend
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });

        console.log('[Push] Unsubscribed successfully');
        return true;
      }
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
    }

    return false;
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
