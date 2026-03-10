/*
  Habit Tracker — Service Worker
  ════════════════════════════════
  Estrategia: Cache-first, offline-first.
  · Solo cachea recursos del mismo origen.
  · No hace fetch a ningún recurso externo.
  · Si el fetch falla, sirve desde caché.
  · No loguea ni envía datos a ningún servidor.
*/

const CACHE_NAME = 'habit-tracker-v2';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
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

  // Bloquea cualquier petición cross-origin
  if (url.origin !== self.location.origin) {
    event.respondWith(new Response('', { status: 403, statusText: 'Blocked' }));
    return;
  }
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
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
  try { data = event.data.json(); } catch { data = { title: 'Habit Tracker', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Habit Tracker', {
      body: data.body || '¡No olvides tus hábitos de hoy!',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [100, 50, 100],
      tag: 'habit-reminder',
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
