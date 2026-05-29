const CACHE_NAME = 'objectif-cache-v9';
const FILES_TO_CACHE = [
  '/static/app.js',
  '/static/manifest.json',
  '/static/icons/favicon.ico',
  '/static/icons/web-app-manifest-192x192.png',
  '/static/icons/web-app-manifest-512x512.png'
];

// Installation : mettre en cache les fichiers
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE).catch(error => {
        console.error('Erreur cache service worker :', error);
      });
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage ancien cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
