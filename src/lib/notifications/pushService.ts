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

      // Step 4: Check VAPID key and convert to Uint8Array
      console.log('[AIO Push] subscribe() - step 4: VAPID key check and conversion');
      const vapidKeyString = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      console.log('[AIO Push] vapid key present:', !!vapidKeyString);
      
      if (!vapidKeyString) {
        console.error('[AIO Push] ❌ VAPID key missing or undefined - ensure VITE_VAPID_PUBLIC_KEY is set in .env');
        return null;
      }
      
      // Convert base64 VAPID key string to Uint8Array
      // Handle both standard base64 and URL-safe base64 encoding
      let vapidKey: Uint8Array;
      try {
        // Convert URL-safe base64 (- and _) to standard base64 (+ and /)
        let standardBase64 = vapidKeyString
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        
        // Add proper padding if needed (base64 should be multiple of 4)
        while (standardBase64.length % 4) {
          standardBase64 += '=';
        }
        
        console.log('[AIO Push] VAPID key format check:', {
          original: vapidKeyString.substring(0, 20) + '...',
          hasUrlSafeChars: /[-_]/.test(vapidKeyString),
          lengthBefore: vapidKeyString.length,
          lengthAfter: standardBase64.length,
          paddingAdded: standardBase64.length - vapidKeyString.length
        });
        
        const binaryString = atob(standardBase64);
        let bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // P-256 VAPID keys can be:
        // - 65 bytes: 0x04 (uncompressed prefix) + 32 bytes X + 32 bytes Y
        // - 64 bytes: 32 bytes X + 32 bytes Y (raw coordinates, need 0x04 prefix)
        // - 33 bytes: 0x02/0x03 (compressed, not typically used for VAPID)
        
        const initialLength = bytes.length;
        console.log('[AIO Push] VAPID key initial decode:', {
          initialLength,
          startsWith0x04: bytes[0] === 0x04,
          firstByte: bytes[0]?.toString(16).padStart(2, '0'),
          firstBytes: Array.from(bytes.slice(0, 4)).map(b => b.toString(16)).join(' ')
        });
        
        // If we got 64 bytes (raw coordinates without 0x04 prefix), add the prefix
        if (bytes.length === 64 && bytes[0] !== 0x04) {
          console.log('[AIO Push] ⚠️ Raw P-256 coordinates detected (64 bytes, no 0x04 prefix) - prepending 0x04');
          const newBytes = new Uint8Array(65);
          newBytes[0] = 0x04;
          newBytes.set(bytes, 1);
          bytes = newBytes;
        }
        
        vapidKey = bytes;
        
        const isValidLength = vapidKey.length === 65;
        console.log('[AIO Push] VAPID key after normalization:', {
          finalLength: vapidKey.length,
          isValidP256: isValidLength,
          isUncompressed: bytes[0] === 0x04,
          firstBytes: Array.from(bytes.slice(0, 4)).map(b => b.toString(16)).join(' '),
          warningMsg: !isValidLength ? `⚠️ Expected 65 bytes for P-256, got ${vapidKey.length}` : undefined
        });
        
        if (!isValidLength) {
          console.warn('[AIO Push] ⚠️ VAPID key length invalid - subscribe() will likely fail');
        }
      } catch (decodeErr) {
        console.error('[AIO Push] ❌ Failed to decode VAPID key from base64:', {
          error: decodeErr,
          vapidLength: vapidKeyString.length,
          vapidSample: vapidKeyString.substring(0, 30) + '...',
          message: decodeErr instanceof Error ? decodeErr.message : String(decodeErr)
        });
        return null;
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

      // Step 7: Send to backend with JWT Authorization header
      const subscriptionPayload = subscription.toJSON();
      console.log('[AIO Push] subscribe() - step 7: sending to backend', {
        userId,
        hasEndpoint: !!subscriptionPayload.endpoint,
        hasKeys: !!subscriptionPayload.keys
      });

      // Get JWT token from Supabase session (stored in localStorage by Supabase)
      let authToken = '';
      try {
        const supabaseAuth = localStorage.getItem('sb-djmfutyxmyhujcygdliy-auth-token');
        if (supabaseAuth) {
          const authData = JSON.parse(supabaseAuth);
          authToken = authData.session?.access_token || '';
        }
      } catch (tokenErr) {
        console.warn('[AIO Push] Could not retrieve auth token from localStorage:', tokenErr);
      }

      if (!authToken) {
        console.error('[AIO Push] ❌ No authorization token available - cannot subscribe');
        return null;
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
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
      
      // Get JWT token for authorization
      let authToken = '';
      try {
        const supabaseAuth = localStorage.getItem('sb-djmfutyxmyhujcygdliy-auth-token');
        if (supabaseAuth) {
          const authData = JSON.parse(supabaseAuth);
          authToken = authData.session?.access_token || '';
        }
      } catch (tokenErr) {
        console.warn('[AIO Push] Could not retrieve auth token for unsubscribe:', tokenErr);
      }

      // Notify backend
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
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
