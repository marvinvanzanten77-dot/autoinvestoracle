/**
 * Service Worker voor Web Push Notifications
 * Handles push events en notification interactions
 */

// Cache versie
const CACHE_NAME = 'auto-invest-oracle-v1';

// Installation
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(clients.claim());
});

// Push notification ontvangen
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event.data);

  if (!event.data) {
    console.log('[SW] No data in push event');
    return;
  }

  let notificationData;
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'Auto Invest Oracle',
      body: event.data.text()
    };
  }

  const options = {
    body: notificationData.body || 'Nieuwe update',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: notificationData.tag || 'auto-invest-oracle',
    requireInteraction: notificationData.requireInteraction || false,
    data: notificationData.data || {},
    actions: notificationData.actions || [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'close',
        title: 'Sluiten'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'Auto Invest Oracle',
      options
    )
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open app op notification click
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check of app al open is
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Open app als deze niet open is
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Notification close handling
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// Background sync (optional - voor offline scenarios)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});
