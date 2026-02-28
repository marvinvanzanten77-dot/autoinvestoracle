import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { PushNotificationService } from '../lib/notifications/pushService';

interface NotificationManagerProps {
  userId?: string;
  onStatusChange?: (enabled: boolean) => void;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ 
  userId, 
  onStatusChange 
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pushService = PushNotificationService.getInstance();

  // Initialize push service
  useEffect(() => {
    const init = async () => {
      try {
        const supported = pushService.getSupported();
        setIsSupported(supported);

        if (supported) {
          const initialized = await pushService.initialize();
          if (initialized) {
            const enabled = pushService.isEnabled();
            setIsEnabled(enabled);

            if (enabled) {
              const subscribed = await pushService.isSubscribed();
              setIsSubscribed(subscribed);
            }
          }
        }
      } catch (err) {
        console.error('Push notification init error:', err);
        setError('Push notifications not available');
      }
    };

    init();
  }, []);

  const handleSubscribe = async () => {
    if (!userId || !isSupported) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('[AIO Notif] handleSubscribe() - step 1: requesting permission', { userId });
      
      // Request permission
      const permission = await pushService.requestPermission();
      console.log('[AIO Notif] handleSubscribe() - step 2: permission response', { permission });
      
      if (permission === 'granted') {
        console.log('[AIO Notif] handleSubscribe() - step 3: calling subscribe');
        // Subscribe
        const result = await pushService.subscribe(userId);
        
        if (result) {
          console.log('[AIO Notif] ✅ handleSubscribe() SUCCESS');
          setIsEnabled(true);
          setIsSubscribed(true);
          onStatusChange?.(true);
          
          // Show test notification
          setTimeout(() => {
            pushService.showNotification({
              title: 'Auto Invest Oracle',
              body: 'Push notifications zijn nu geactiveerd! Je ontvangt meldingen wanneer de agent handelt.',
              tag: 'welcome',
              requireInteraction: false
            });
          }, 500);
        } else {
          const msg = '[AIO Notif] Abonnement mislukt - check browser console voor details';
          console.error('[AIO Notif] handleSubscribe() FAILED - subscribe returned null');
          setError(msg);
        }
      } else if (permission === 'denied') {
        const msg = 'Je hebt push notifications geweigerd in je browser';
        console.warn('[AIO Notif] handleSubscribe() - permission denied', { permission });
        setError(msg);
      } else {
        const msg = '[AIO Notif] Toestemming niet verleend';
        console.warn('[AIO Notif] handleSubscribe() - permission not granted', { permission });
        setError(msg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorName = err instanceof Error ? err.name : 'Unknown';
      const errorStack = err instanceof Error ? err.stack : undefined;
      
      console.error('[AIO Notif] ❌ handleSubscribe() EXCEPTION', {
        step: 'handleSubscribe catch block',
        error: err,
        message: errorMsg,
        name: errorName,
        stack: errorStack,
        userId,
        isSupported
      });
      
      // Show user a more helpful error message
      const userMsg = errorMsg.includes('VAPID') 
        ? 'VAPID configuratie fout - neem contact op met support'
        : errorMsg.includes('permission')
        ? 'Browsertoestemming fout'
        : `Melding mislukt: ${errorMsg}`;
      
      setError(userMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!userId || !isSupported) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('[AIO Notif] handleUnsubscribe() - starting', { userId });
      const result = await pushService.unsubscribe(userId);
      
      if (result) {
        console.log('[AIO Notif] ✅ handleUnsubscribe() SUCCESS');
        setIsEnabled(false);
        setIsSubscribed(false);
        onStatusChange?.(false);
      } else {
        console.error('[AIO Notif] handleUnsubscribe() FAILED - unsubscribe returned false');
        setError('Kon meldingen niet uitschakelen - check browser console');
      }
    } catch (err) {
      console.error('[AIO Notif] ❌ handleUnsubscribe() EXCEPTION', {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'Unknown'
      });
      setError('Fout bij uitschakelen - probeer opnieuw');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported || !userId) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
      
      {isEnabled && isSubscribed ? (
        <button
          onClick={handleUnsubscribe}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
          title="Push notifications enabled"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Bell size={16} />
          )}
          <span className="text-sm">Meldingen aan</span>
        </button>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          title="Enable push notifications"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <BellOff size={16} />
          )}
          <span className="text-sm">Meldingen uit</span>
        </button>
      )}
    </div>
  );
};

export default NotificationManager;
