/**
 * WINEFEED SERVICE WORKER
 *
 * Handles:
 * - Push notifications
 * - Notification click events
 * - Background sync (future)
 */

// Version for cache busting
const SW_VERSION = '1.0.0';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v' + SW_VERSION);
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v' + SW_VERSION);
  event.waitUntil(self.clients.claim());
});

// Push event - receive push notification
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let payload = {
    title: 'Winefeed',
    body: 'Du har en ny notis',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    url: '/',
    tag: 'default',
    data: {},
  };

  // Parse push data
  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch (e) {
      console.error('[SW] Failed to parse push data:', e);
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    data: {
      url: payload.url,
      ...payload.data,
    },
    vibrate: [100, 50, 100],
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Öppna',
      },
      {
        action: 'dismiss',
        title: 'Avfärda',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Get URL from notification data
  const url = event.notification.data?.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url === fullUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// Message event - communication with main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
