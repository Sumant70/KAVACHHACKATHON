// Firebase Cloud Messaging Service Worker for KAVACH
// Handles background push notifications when browser tab is inactive, minimized, or closed
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyC5P63wx77UpADqArWEELBZDa8DIy4iuxc",
  authDomain: "kavach-wildlife-alert.firebaseapp.com",
  projectId: "kavach-wildlife-alert",
  storageBucket: "kavach-wildlife-alert.firebasestorage.app",
  messagingSenderId: "342826294293",
  appId: "1:342826294293:web:1cba7f3dfede990492021c",
  measurementId: "G-LC5FN83JBJ"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Received background message:', payload);

  const animal = payload.data?.animal || payload.data?.species || 'Wildlife';
  const confidence = payload.data?.confidence || '';
  const risk = payload.data?.risk_level || 'HIGH';
  const location = payload.data?.village_name || 'Sanctuary Zone';

  const title = payload.notification?.title || `🚨 WILDLIFE ALERT: ${animal.toUpperCase()} DETECTED`;
  const body = payload.notification?.body || `⚠️ ${risk} Risk | Conf: ${confidence}% | ${location}. Tap to view immediate threat telemetry.`;

  const notificationOptions = {
    body: body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.event_id || `wildlife-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 600],
    data: {
      url: payload.data?.url || payload.data?.click_action || '/alert-device',
      eventId: payload.data?.event_id
    }
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] Notification click event received:', event);
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/alert-device';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If KAVACH window is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes('/alert-device') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
