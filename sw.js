/**
 * TypeByAman Remote — Progressive Web App Service Worker
 * Author: Aman Kumar | github.com/Amankr0075
 */

const CACHE_NAME = 'typebyaman-remote-v1';
const ASSETS_TO_CACHE = [
  './remote.html',
  './manifest.webmanifest',
  './lib/jsqr.js',
  './assets/icon48.png',
  './assets/icon128.png',
  './assets/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  // Let WebSocket and external MQTT pass directly
  if (event.request.url.startsWith('ws:') || event.request.url.startsWith('wss:')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch update in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./remote.html');
        }
      });
    })
  );
});
