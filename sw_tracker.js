/* Service Worker para Tracker Independiente • Player Stats */
const CACHE_NAME = 'playerstats-tracker-v2';
const ASSETS_TO_CACHE = [
  './tracker.html',
  './manifest_tracker.json',
  './icons/icon-tracker-192.png',
  './icons/icon-tracker-512.png',
  './js/icons.js',
  './js/firebase-app-compat.js',
  './js/firebase-firestore-compat.js',
  './js/cloud.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(() => {})
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
  // Ignorar peticiones a firebase/firestore en vivo para que siempre vayan directas a la red
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebaseio.com') ||
      event.request.method !== 'GET') {
    return;
  }

  // Network First, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          }).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
