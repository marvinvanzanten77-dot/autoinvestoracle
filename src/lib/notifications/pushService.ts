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
    console.log('[AIO Push] initialize() START - checking browser support');
    console.log('[AIO Push] browser support flags:', {
      serviceWorkerSupport: 'serviceWorker' in navigator,
      pushManagerSupport: 'PushManager' in window,
      notificationSupport: 'Notification' in window,
      isSupported: this.isSupported
    });

    if (!this.isSupported) {
      console.error('[AIO Push] ❌ Push notifications not supported on this device');
      return false;
    }

    try {
      console.log('[AIO Push] initialize() - registering service worker from /service-worker.js');
      
      // Check if service worker already registered
      const existingReg = await navigator.serviceWorker.getRegistration('/');
      if (existingReg) {
        console.log('[AIO Push] Service Worker already registered:', {
          scope: existingReg.scope,
          active: !!existingReg.active,
          installing: !!existingReg.installing
        });
        this.registration = existingReg;
        return true;
      }

      // Registreer service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      
      console.log('[AIO Push] ✅ Service Worker registered successfully:', {
        scope: this.registration.scope,
        active: !!this.registration.active,
        installing: !!this.registration.installing,
        waiting: !!this.registration.waiting
      });
      
      return true;
    } catch (err) {
      console.error('[AIO Push] ❌ Service Worker registration failed:', {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'Unknown',
        code: (err as any)?.code,
        stack: err instanceof Error ? err.stack : undefined,
        filePath: '/service-worker.js'
      });
      return false;
    }
  }

  /**
   * Request toestemming voor push notifications
   */
  async requestPermission(): Promise<NotificationPermission | null> {
    console.log('[AIO Push] requestPermission() START');
    
    if (!this.isSupported) {
      console.error('[AIO Push] ❌ Cannot request permission - push not supported');
      return null;
    }

    const currentPermission = Notification.permission;
    console.log('[AIO Push] current notification permission:', currentPermission);

    if (currentPermission === 'granted') {
      console.log('[AIO Push] ✅ Permission already granted');
      return 'granted';
    }

    if (currentPermission === 'denied') {
      console.error('[AIO Push] ❌ Push notifications denied by user - cannot request again', {
        previous: 'denied'
      });
      return 'denied';
    }

    // currentPermission === 'default', request it
    try {
      console.log('[AIO Push] Requesting notification permission from user...');
      const permission = await Notification.requestPermission();
      
      console.log('[AIO Push] ✅ Permission request completed:', {
        result: permission,
        now: Notification.permission
      });
      
      return permission;
    } catch (err) {
      console.error('[AIO Push] ❌ Permission request error:', {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'Unknown',
        stack: err instanceof Error ? err.stack : undefined
      });
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
    console.log('[AIO Push] subscribe() START - validating environment');
    
    // Check browser support
    if (!this.isSupported) {
      console.error('[AIO Push] ❌ Browser support check FAILED - push not supported');
      console.log('[AIO Push] support check:', {
        serviceWorkerSupport: 'serviceWorker' in navigator,
        pushManagerSupport: 'PushManager' in window,
        notificationSupport: 'Notification' in window
      });
      return null;
    }
    
    // Check service worker registration
    if (!this.registration) {
      console.error('[AIO Push] ❌ No service worker registration');
      
      // Attempt to get registration directly
      try {
        const existingReg = await navigator.serviceWorker.getRegistration();
        if (existingReg) {
          console.log('[AIO Push] 📍 Found existing service worker registration:', {
            scope: existingReg.scope,
            active: !!existingReg.active,
            installing: !!existingReg.installing,
            waiting: !!existingReg.waiting
          });
        } else {
          console.error('[AIO Push] ❌ navigator.serviceWorker.getRegistration() returned null - no service worker registered');
        }
      } catch (regErr) {
        console.error('[AIO Push] Error checking service worker registration:', regErr);
      }
      return null;
    }

    try {
      // Step 1: Verify service worker is ready
      console.log('[AIO Push] subscribe() - step 1: service worker ready check');
      console.log('[AIO Push] service worker ready:', {
        scope: this.registration.scope,
        active: !!this.registration.active,
        installing: !!this.registration.installing,
        waiting: !!this.registration.waiting
      });

      // Step 2: Verify pushManager exists
      console.log('[AIO Push] subscribe() - step 2: pushManager exists check');
      const hasPushManager = !!this.registration.pushManager;
      console.log('[AIO Push] pushManager exists:', hasPushManager);
      
      if (!hasPushManager) {
        console.error('[AIO Push] ❌ pushManager not available on service worker registration');
        return null;
      }

      // Step 3: Check notification permission
      console.log('[AIO Push] subscribe() - step 3: notification permission check');
      const permission = Notification.permission;
      console.log('[AIO Push] notification permission:', permission);
      
      if (permission !== 'granted') {
        console.error('[AIO Push] ❌ Notification permission not granted', {
          current: permission,
          expected: 'granted'
        });
        return null;
      }

      // Step 4: Check VAPID key
      console.log('[AIO Push] subscribe() - step 4: VAPID key check');
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      console.log('[AIO Push] vapid key present:', !!vapidKey);
      if (vapidKey) {
        console.log('[AIO Push] vapid key length:', vapidKey.length);
      } else {
        console.error('[AIO Push] ❌ VAPID key missing or undefined - ensure VITE_VAPID_PUBLIC_KEY is set in .env');
      }

      // Step 5: Wrap subscribe call with detailed error handling
      console.log('[AIO Push] subscribe() - step 5: calling pushManager.subscribe()');
      let subscription: PushSubscription;
      
      try {
        subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey
        });
        console.log('[AIO Push] ✅ pushManager.subscribe() succeeded');
      } catch (subscribeErr) {
        console.error('[AIO Push] ❌ pushManager.subscribe() failed with error:', {
          error: subscribeErr,
          message: subscribeErr instanceof Error ? subscribeErr.message : String(subscribeErr),
          name: subscribeErr instanceof Error ? subscribeErr.name : 'Unknown',
          code: (subscribeErr as any)?.code,
          stack: subscribeErr instanceof Error ? subscribeErr.stack : undefined
        });
        return null;
      }

      console.log('[AIO Push] subscribe() - step 6: subscription object created', {
        endpoint: subscription.endpoint,
        endpointLength: subscription.endpoint.length,
        keys: Object.keys(subscription.toJSON().keys || {})
      });

      // Step 7: Send to backend
      const subscriptionPayload = subscription.toJSON();
      console.log('[AIO Push] subscribe() - step 7: sending to backend', {
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

      console.log('[AIO Push] subscribe() - step 8: backend response', {
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
