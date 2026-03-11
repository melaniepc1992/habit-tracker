/*
  Habit Tracker — Service Worker v3
  ════════════════════════════════════
  · Cache-first, 100% offline
  · Scope relativo (./) para GitHub Pages en subdirectorio
  · Bloquea todo fetch cross-origin
  · Sin telemetría ni conexiones externas
*/

const CACHE_NAME = 'habit-tracker-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
  // Los iconos son opcionales - se generan via Canvas si faltan
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll con fallback individual para no fallar si falta un asset
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Bloquear cross-origin estrictamente
  if (url.origin !== self.location.origin) {
    event.respondWith(new Response('', { status: 403, statusText: 'Blocked: cross-origin' }));
    return;
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

self.addEventListener('push', event => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'Habit Tracker', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Habit Tracker', {
      body:     data.body || '¡No olvides tus hábitos de hoy!',
      icon:     './icon-192.png',
      badge:    './icon-192.png',
      vibrate:  [100, 50, 100],
      tag:      'habit-reminder',
      renotify: false
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
