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
      // Request permission
      const permission = await pushService.requestPermission();
      
      if (permission === 'granted') {
        // Subscribe
        const result = await pushService.subscribe(userId);
        
        if (result) {
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
          setError('Subscription failed');
        }
      } else if (permission === 'denied') {
        setError('Je hebt push notifications geweigerd in je browser');
      }
    } catch (err) {
      console.error('[Push Subscribe] Failed:', {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        type: err instanceof Error ? err.name : typeof err
      });
      setError(`Melding mislukt: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!userId || !isSupported) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await pushService.unsubscribe(userId);
      
      if (result) {
        setIsEnabled(false);
        setIsSubscribed(false);
        onStatusChange?.(false);
      } else {
        setError('Unsubscription failed');
      }
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError('Failed to disable notifications');
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
